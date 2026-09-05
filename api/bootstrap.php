<?php
declare(strict_types=1);

function loadAppConfig(): array
{
    $path = __DIR__ . '/config.local.php';
    if (!is_file($path)) {
        throw new RuntimeException('Falta api/config.local.php.');
    }
    $config = require $path;
    if (!is_array($config) || empty($config['database'])) {
        throw new RuntimeException('La configuración privada no es válida.');
    }
    return $config;
}

function openDatabase(array $config): PDO
{
    $db = $config['database'];
    foreach (['host', 'name', 'user', 'password'] as $key) {
        if (!array_key_exists($key, $db) || str_contains((string)$db[$key], 'MYSQL')) {
            throw new RuntimeException('La conexión MySQL no está configurada.');
        }
    }
    $charset = $db['charset'] ?? 'utf8mb4';
    $dsn = sprintf('mysql:host=%s;dbname=%s;charset=%s', $db['host'], $db['name'], $charset);
    $pdo = new PDO($dsn, $db['user'], $db['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_STRINGIFY_FETCHES => false,
    ]);
    $pdo->exec("SET time_zone = '+00:00'");
    return $pdo;
}

function sendJson(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    exit;
}

function sendData(mixed $data, int $status = 200): never
{
    sendJson(['ok' => true, 'data' => $data], $status);
}

function failRequest(string $message, int $status = 400): never
{
    sendJson(['ok' => false, 'error' => $message], $status);
}

function configureHttpSecurity(array $config): void
{
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: no-referrer');
    header('Cache-Control: no-store');

    $origin = rtrim((string)($_SERVER['HTTP_ORIGIN'] ?? ''), '/');
    $trusted = rtrim((string)($config['security']['trusted_origin'] ?? ''), '/');
    $currentHost = strtolower((string)($_SERVER['HTTP_HOST'] ?? ''));
    $originHost = strtolower((string)(parse_url($origin, PHP_URL_HOST) ?? ''));
    $sameHost = $origin !== '' && $originHost !== '' && $originHost === preg_replace('/:\d+$/', '', $currentHost);

    if ($origin !== '' && !$sameHost && ($trusted === '' || !hash_equals($trusted, $origin))) {
        failRequest('Origen no autorizado.', 403);
    }
    if ($origin !== '' && ($sameHost || ($trusted !== '' && hash_equals($trusted, $origin)))) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
    }
}

function readJsonBody(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || strlen($raw) > 1_000_000) {
        failRequest('Solicitud demasiado grande.', 413);
    }
    try {
        $decoded = json_decode($raw ?: '{}', true, 64, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        failRequest('El cuerpo de la solicitud no contiene JSON válido.');
    }
    return is_array($decoded) ? $decoded : [];
}

function bearerToken(): string
{
    $header = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? '');
    if ($header === '' && function_exists('getallheaders')) {
        $headers = getallheaders();
        $header = (string)($headers['Authorization'] ?? $headers['authorization'] ?? '');
    }
    return preg_match('/^Bearer\s+([A-Za-z0-9_-]{32,})$/', $header, $match) ? $match[1] : '';
}

function clientIp(): string
{
    return substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45);
}

function clientUserAgent(): string
{
    return substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 500);
}

function randomToken(int $bytes = 32): string
{
    return rtrim(strtr(base64_encode(random_bytes($bytes)), '+/', '-_'), '=');
}

function currentUser(PDO $pdo): array
{
    $token = bearerToken();
    if ($token === '') {
        failRequest('Sesión requerida.', 401);
    }
    $statement = $pdo->prepare(
        "SELECT u.id, u.email, u.display_name, u.primary_area_id, u.must_change_password,
                s.id AS session_id, s.expires_at
           FROM auth_sessions s
           INNER JOIN app_users u ON u.id = s.user_id
          WHERE s.token_hash = :token_hash
            AND s.revoked_at IS NULL
            AND s.expires_at > UTC_TIMESTAMP(6)
            AND u.status = 'ACTIVE'
          LIMIT 1"
    );
    $statement->execute(['token_hash' => hash('sha256', $token)]);
    $user = $statement->fetch();
    if (!$user) {
        failRequest('La sesión expiró o fue revocada.', 401);
    }
    return $user;
}

function isSuperAdmin(PDO $pdo, int $userId): bool
{
    $statement = $pdo->prepare(
        "SELECT 1 FROM user_roles ur
         INNER JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = :user_id AND ur.is_active = 1 AND r.code = 'SUPER_ADMIN' AND r.is_active = 1 LIMIT 1"
    );
    $statement->execute(['user_id' => $userId]);
    return (bool)$statement->fetchColumn();
}

function requirePermission(PDO $pdo, int $userId, string $moduleCode, string $actionCode): void
{
    if (isSuperAdmin($pdo, $userId)) {
        return;
    }
    $deny = $pdo->prepare(
        "SELECT 1 FROM user_permission_overrides uo
         INNER JOIN permissions p ON p.id = uo.permission_id
         INNER JOIN app_modules m ON m.id = p.module_id
         WHERE uo.user_id = :user_id AND m.code = :module AND p.action_code = :action AND uo.decision = 'DENY' LIMIT 1"
    );
    $deny->execute(['user_id' => $userId, 'module' => $moduleCode, 'action' => $actionCode]);
    if ($deny->fetchColumn()) {
        failRequest('No tienes permiso para realizar esta operación.', 403);
    }

    $permission = $pdo->prepare(
        "SELECT 1
           FROM user_roles ur
           INNER JOIN role_permissions rp ON rp.role_id = ur.role_id
           INNER JOIN permissions p ON p.id = rp.permission_id
           INNER JOIN app_modules m ON m.id = p.module_id
          WHERE ur.user_id = :user_id AND ur.is_active = 1
            AND m.code = :module AND m.is_active = 1 AND p.action_code = :action
          UNION
         SELECT 1
           FROM user_permission_overrides uo
           INNER JOIN permissions p ON p.id = uo.permission_id
           INNER JOIN app_modules m ON m.id = p.module_id
          WHERE uo.user_id = :user_id_2 AND m.code = :module_2
            AND p.action_code = :action_2 AND uo.decision = 'ALLOW'
          LIMIT 1"
    );
    $permission->execute([
        'user_id' => $userId, 'module' => $moduleCode, 'action' => $actionCode,
        'user_id_2' => $userId, 'module_2' => $moduleCode, 'action_2' => $actionCode,
    ]);
    if (!$permission->fetchColumn()) {
        failRequest('No tienes permiso para realizar esta operación.', 403);
    }
}

function writeAudit(PDO $pdo, int $userId, string $action, string $entity, string|int|null $entityId, array $after = [], ?string $reason = null): void
{
    $statement = $pdo->prepare(
        "INSERT INTO audit_log (actor_user_id, area_id, action_code, entity_type, entity_id, reason, after_data, ip_address)
         VALUES (:user_id, (SELECT primary_area_id FROM app_users WHERE id=:area_user), :action, :entity, :entity_id, :reason, :after_data, INET6_ATON(:ip))"
    );
    $statement->execute([
        'user_id' => $userId, 'area_user' => $userId, 'action' => $action, 'entity' => $entity,
        'entity_id' => $entityId === null ? null : (string)$entityId,
        'reason' => $reason,
        'after_data' => $after ? json_encode($after, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) : null,
        'ip' => clientIp(),
    ]);
}

function requiredString(array $payload, string $key, string $label, int $maxLength = 190): string
{
    $value = trim((string)($payload[$key] ?? ''));
    if ($value === '') {
        failRequest("Falta {$label}.");
    }
    return mb_substr($value, 0, $maxLength);
}

function positiveNumber(array $payload, string $key, string $label): float
{
    $value = filter_var($payload[$key] ?? null, FILTER_VALIDATE_FLOAT);
    if ($value === false || $value <= 0) {
        failRequest("{$label} debe ser mayor que cero.");
    }
    return (float)$value;
}

function safeRows(PDO $pdo, string $sql, array $params = []): array
{
    try {
        $statement = $pdo->prepare($sql);
        $statement->execute($params);
        return $statement->fetchAll() ?: [];
    } catch (PDOException $error) {
        error_log('Oleolab bootstrap query: ' . $error->getMessage());
        return [];
    }
}

function safeScalar(PDO $pdo, string $sql, array $params = []): int|float
{
    try {
        $statement = $pdo->prepare($sql);
        $statement->execute($params);
        return (float)($statement->fetchColumn() ?: 0);
    } catch (PDOException $error) {
        error_log('Oleolab metric query: ' . $error->getMessage());
        return 0;
    }
}

function findOne(PDO $pdo, string $sql, array $params, string $errorMessage): array
{
    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    $row = $statement->fetch();
    if (!$row) {
        failRequest($errorMessage, 422);
    }
    return $row;
}

function provisionalNumber(string $prefix): string
{
    return $prefix . '-TMP-' . strtoupper(bin2hex(random_bytes(5)));
}

function finalNumber(string $prefix, int $id): string
{
    return sprintf('%s-%s-%06d', $prefix, gmdate('Y'), $id);
}
