<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require dirname(__DIR__) . '/api/bootstrap.php';

$email = mb_strtolower(trim((string)($argv[1] ?? '')));
$name = trim((string)($argv[2] ?? ''));
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $name === '') {
    fwrite(STDERR, "Uso: php private-tools/create_admin.php correo@oleolab.mx \"Nombre completo\"\n");
    exit(1);
}

fwrite(STDOUT, 'Contraseña segura del administrador: ');
if (PHP_OS_FAMILY !== 'Windows') {
    shell_exec('stty -echo');
}
$password = rtrim((string)fgets(STDIN), "\r\n");
if (PHP_OS_FAMILY !== 'Windows') {
    shell_exec('stty echo');
    fwrite(STDOUT, "\n");
}
if (strlen($password) < 12) {
    fwrite(STDERR, "La contraseña debe tener al menos 12 caracteres.\n");
    exit(1);
}

try {
    $pdo = openDatabase(loadAppConfig());
    $areaId = $pdo->query("SELECT id FROM areas WHERE code='ADMIN' LIMIT 1")->fetchColumn();
    if (!$areaId) throw new RuntimeException('No existe el área ADMIN. Importe primero el esquema.');
    $roleId = $pdo->query("SELECT id FROM roles WHERE code='SUPER_ADMIN' AND is_active=1 LIMIT 1")->fetchColumn();
    if (!$roleId) throw new RuntimeException('No existe el rol SUPER_ADMIN. Importe primero el esquema.');
    $check = $pdo->prepare("SELECT COUNT(*) FROM user_roles WHERE role_id=:role AND is_active=1");
    $check->execute(['role'=>$roleId]);
    if ($check->fetchColumn() > 0) {
        throw new RuntimeException('Ya existe un superadministrador activo.');
    }
    $algorithm = defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_BCRYPT;
    $hash = password_hash($password, $algorithm);
    $pdo->beginTransaction();
    $insert = $pdo->prepare("INSERT INTO app_users (primary_area_id,email,display_name,password_hash,status,must_change_password) VALUES (:area,:email,:name,:hash,'ACTIVE',0)");
    $insert->execute(['area'=>$areaId,'email'=>$email,'name'=>$name,'hash'=>$hash]);
    $userId = (int)$pdo->lastInsertId();
    $pdo->prepare("INSERT INTO user_roles (user_id,role_id,is_active,assigned_by) VALUES (:user,:role,1,:assigned_by)")->execute(['user'=>$userId,'role'=>$roleId,'assigned_by'=>$userId]);
    $pdo->commit();
    fwrite(STDOUT, "Superadministrador creado correctamente.\n");
} catch (Throwable $error) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    fwrite(STDERR, $error->getMessage() . "\n");
    exit(1);
}
