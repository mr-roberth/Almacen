<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/v13.php';
require __DIR__ . '/v14.php';

try {
    $config = loadAppConfig();
    configureHttpSecurity($config);
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
    $pdo = openDatabase($config);

    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
        if (($_GET['action'] ?? '') === 'health') {
            $pdo->query('SELECT 1')->fetchColumn();
            sendData(['status' => 'ok', 'database' => 'connected', 'utc' => gmdate(DATE_ATOM)]);
        }
        if (($_GET['action'] ?? '') === 'maintenanceEvidence') {
            $user = currentUser($pdo);
            streamMaintenanceEvidence($pdo, $user, (int)($_GET['id'] ?? 0));
        }
        failRequest('Ruta no encontrada.', 404);
    }
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        failRequest('Método no permitido.', 405);
    }

    if (($_GET['action'] ?? '') === 'uploadMaintenanceEvidence') {
        $user = currentUser($pdo);
        uploadMaintenanceEvidence($pdo, $user);
    }

    $request = readJsonBody();
    $action = trim((string)($request['action'] ?? ''));
    $payload = is_array($request['payload'] ?? null) ? $request['payload'] : [];

    switch ($action) {
        case 'health':
            sendData(['status' => 'ok', 'utc' => gmdate(DATE_ATOM)]);
        case 'login':
            handleLogin($pdo, $config, $payload);
        case 'logout':
            handleLogout($pdo);
        case 'bootstrap':
            $user = currentUser($pdo);
            sendData(buildBootstrap($pdo, $user));
        case 'trace':
            $user = currentUser($pdo);
            sendData(traceLot($pdo, $user, $payload));
        case 'createOperation':
            $user = currentUser($pdo);
            sendData(createOperation($pdo, $user, $payload, $config), 201);
        default:
            failRequest('Acción no reconocida.', 404);
    }
} catch (RuntimeException $error) {
    error_log('Oleolab configuration: ' . $error->getMessage());
    failRequest('La API aún no está configurada.', 503);
} catch (PDOException $error) {
    error_log('Oleolab database: ' . $error->getMessage());
    failRequest('No fue posible completar la operación en la base de datos.', 500);
} catch (Throwable $error) {
    error_log('Oleolab API: ' . $error->getMessage());
    failRequest('Ocurrió un error interno.', 500);
}

function handleLogin(PDO $pdo, array $config, array $payload): never
{
    $email = mb_strtolower(requiredString($payload, 'email', 'el correo', 190));
    $password = (string)($payload['password'] ?? '');
    if ($password === '') {
        failRequest('Falta la contraseña.');
    }
    $statement = $pdo->prepare(
        "SELECT id, email, display_name, password_hash, status, failed_login_count, locked_until
         FROM app_users WHERE email = :email LIMIT 1"
    );
    $statement->execute(['email' => $email]);
    $user = $statement->fetch();

    $locked = $user && $user['locked_until'] && strtotime((string)$user['locked_until']) > time();
    if ($locked) {
        failRequest('La cuenta está bloqueada temporalmente. Intenta más tarde.', 423);
    }
    if (!$user || $user['status'] !== 'ACTIVE' || !password_verify($password, (string)$user['password_hash'])) {
        if ($user) {
            $attempts = (int)$user['failed_login_count'] + 1;
            $maxAttempts = (int)($config['security']['max_login_attempts'] ?? 5);
            $lockMinutes = (int)($config['security']['lock_minutes'] ?? 15);
            $lockedUntil = $attempts >= $maxAttempts
                ? (new DateTimeImmutable('now', new DateTimeZone('UTC')))->modify("+{$lockMinutes} minutes")->format('Y-m-d H:i:s.u')
                : null;
            $update = $pdo->prepare(
                "UPDATE app_users
                    SET failed_login_count = :attempts, locked_until = :locked_until
                  WHERE id = :id"
            );
            $update->execute(['attempts' => $attempts, 'locked_until' => $lockedUntil, 'id' => $user['id']]);
        }
        $event = $pdo->prepare("INSERT INTO auth_events (user_id, event_type, ip_address, user_agent) VALUES (:user_id, 'LOGIN_FAILED', INET6_ATON(:ip), :agent)");
        $event->execute(['user_id' => $user['id'] ?? null, 'ip' => clientIp(), 'agent' => clientUserAgent()]);
        failRequest('Correo o contraseña incorrectos.', 401);
    }

    $token = randomToken();
    $ttl = max(900, min(86400, (int)($config['security']['session_ttl_seconds'] ?? 28800)));
    $expiresAt = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->modify("+{$ttl} seconds")->format('Y-m-d H:i:s.u');
    $pdo->beginTransaction();
    $pdo->prepare("UPDATE app_users SET failed_login_count = 0, locked_until = NULL, last_login_at = UTC_TIMESTAMP(6) WHERE id = :id")->execute(['id' => $user['id']]);
    $pdo->prepare("INSERT INTO auth_sessions (user_id, token_hash, expires_at, ip_address, user_agent) VALUES (:user_id, :token_hash, :expires_at, INET6_ATON(:ip), :agent)")
        ->execute(['user_id' => $user['id'], 'token_hash' => hash('sha256', $token), 'expires_at' => $expiresAt, 'ip' => clientIp(), 'agent' => clientUserAgent()]);
    $pdo->prepare("INSERT INTO auth_events (user_id, event_type, ip_address, user_agent) VALUES (:user_id, 'LOGIN_OK', INET6_ATON(:ip), :agent)")
        ->execute(['user_id' => $user['id'], 'ip' => clientIp(), 'agent' => clientUserAgent()]);
    $pdo->commit();
    sendData(['token' => $token, 'expires_at' => $expiresAt]);
}

function handleLogout(PDO $pdo): never
{
    $user = currentUser($pdo);
    $tokenHash = hash('sha256', bearerToken());
    $pdo->beginTransaction();
    $pdo->prepare("UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP(6) WHERE token_hash = :token_hash AND revoked_at IS NULL")
        ->execute(['token_hash' => $tokenHash]);
    $pdo->prepare("INSERT INTO auth_events (user_id, event_type, ip_address, user_agent) VALUES (:user_id, 'LOGOUT', INET6_ATON(:ip), :agent)")
        ->execute(['user_id' => $user['id'], 'ip' => clientIp(), 'agent' => clientUserAgent()]);
    $pdo->commit();
    sendData(['logged_out' => true]);
}

function buildBootstrap(PDO $pdo, array $user): array
{
    $isAdmin = isSuperAdmin($pdo, (int)$user['id']);
    $roleRows = safeRows($pdo, "SELECT r.code,r.name FROM user_roles ur INNER JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = :id AND ur.is_active = 1 ORDER BY r.id LIMIT 1", ['id' => $user['id']]);
    $areaRows = safeRows($pdo, "SELECT a.id,a.code,a.name FROM app_users u LEFT JOIN areas a ON a.id=u.primary_area_id WHERE u.id=:id LIMIT 1", ['id'=>$user['id']]);
    $area = $areaRows[0] ?? ['id'=>null,'code'=>'SIN_AREA','name'=>'Sin área asignada'];
    $modules = $isAdmin ? ['*'] : frontendModules($pdo, (int)$user['id']);
    $actions = $isAdmin ? ['*'] : frontendActions($pdo, (int)$user['id']);

    $result = [
        'user' => [
            'id' => (int)$user['id'], 'name' => $user['display_name'], 'email' => $user['email'],
            'role' => $roleRows[0]['name'] ?? 'Usuario', 'roleCode'=>$roleRows[0]['code'] ?? '', 'modules' => $modules, 'actions'=>$actions,
            'areaId'=>$area['id'] === null ? null : (int)$area['id'], 'areaCode'=>$area['code'], 'areaName'=>$area['name'],
            'isSuperAdmin'=>$isAdmin, 'canManageArea'=>$isAdmin || isAreaLeader($pdo,(int)$user['id']),
            'mustChangePassword' => (bool)$user['must_change_password'],
        ],
        'areaDashboard' => buildAreaDashboard($pdo, $area),
        'lookups' => buildLookups($pdo, $user, $isAdmin),
        'metrics' => [
            'inventorySkus' => safeScalar($pdo, "SELECT COUNT(DISTINCT item_id) FROM vw_inventory_on_hand"),
            'criticalShortages' => safeScalar($pdo, "SELECT COUNT(*) FROM mrp_requirements WHERE status = 'SHORTAGE'"),
            'pendingQuality' => safeScalar($pdo, "SELECT COUNT(*) FROM quality_requests WHERE status NOT IN ('COMPLETED','CANCELLED')"),
            'ordersAtRisk' => safeScalar($pdo, "SELECT COUNT(*) FROM production_orders WHERE status IN ('MATERIAL_CHECK','ON_HOLD')"),
        ],
        'coverage' => buildCoverage($pdo),
        'alerts' => $isAdmin?safeRows($pdo, "SELECT id, LOWER(severity) AS severity, title, message, DATE_FORMAT(detected_at, '%d %b · %H:%i') AS time FROM alerts WHERE status IN ('OPEN','ACKNOWLEDGED') ORDER BY FIELD(severity,'CRITICAL','WARNING','INFO'), detected_at DESC LIMIT 30"):safeRows($pdo, "SELECT id, LOWER(severity) AS severity, title, message, DATE_FORMAT(detected_at, '%d %b · %H:%i') AS time FROM alerts WHERE status IN ('OPEN','ACKNOWLEDGED') AND (area_id IS NULL OR area_id=:area) ORDER BY FIELD(severity,'CRITICAL','WARNING','INFO'), detected_at DESC LIMIT 30",['area'=>$area['id']]),
        'appointments' => safeRows($pdo, "SELECT a.appointment_number AS id, DATE_FORMAT(a.scheduled_start, '%H:%i') AS time, CASE WHEN a.delivery_type = 'RETURN' THEN 'Devolución' ELSE 'Entrada' END AS type, COALESCE(s.trade_name,s.legal_name) AS supplier, CONCAT(CASE a.expected_item_type WHEN 'RAW_FRUIT' THEN 'Aguacate en fruta' WHEN 'RAW_OTHER' THEN 'Materia prima o aceite' WHEN 'PACKAGING' THEN 'Material de empaque' WHEN 'SPARE_PART' THEN 'Refacciones' WHEN 'CONSUMABLE' THEN 'Consumibles' ELSE 'Carga mixta' END,COALESCE(CONCAT(' · ',a.notes),'')) AS material, 'Por asignar' AS dock, a.status FROM inbound_appointments a INNER JOIN suppliers s ON s.id = a.supplier_id WHERE DATE(a.scheduled_start) BETWEEN UTC_DATE() AND DATE_ADD(UTC_DATE(), INTERVAL 7 DAY) ORDER BY a.scheduled_start LIMIT 100"),
        'inventory' => safeRows($pdo, "SELECT i.sku, i.name AS item, i.item_type AS type, w.name AS warehouse, COALESCE(l.lot_code,'Sin lote') AS lot, a.on_hand_qty AS onHand, a.reserved_qty AS reserved, a.available_qty AS available, u.code AS uom, CASE WHEN a.available_qty <= 0 THEN 'Sin disponible' WHEN a.available_qty <= i.reorder_point THEN 'Crítico' ELSE 'Disponible' END AS status FROM vw_inventory_availability a INNER JOIN items i ON i.id=a.item_id INNER JOIN warehouses w ON w.id=a.warehouse_id INNER JOIN units_of_measure u ON u.id=a.uom_id LEFT JOIN inventory_lots l ON l.id=a.inventory_lot_id ORDER BY i.name, w.name, l.lot_code LIMIT 2000"),
        'movements' => safeRows($pdo, "SELECT m.movement_number AS id, DATE_FORMAT(m.movement_at,'%Y-%m-%d %H:%i') AS date, m.movement_type AS type, i.sku,i.name AS item, COALESCE(l.lot_code,'Sin lote') AS lot, ml.quantity_delta AS qty, u.code AS uom, CONCAT(w.name,' / ',wl.name) AS location, COALESCE(usr.display_name,'Sistema') AS user, m.status FROM inventory_movement_lines ml INNER JOIN inventory_movements m ON m.id=ml.movement_id INNER JOIN items i ON i.id=ml.item_id INNER JOIN warehouses w ON w.id=ml.warehouse_id INNER JOIN warehouse_locations wl ON wl.id=ml.location_id INNER JOIN units_of_measure u ON u.id=ml.uom_id LEFT JOIN inventory_lots l ON l.id=ml.inventory_lot_id LEFT JOIN app_users usr ON usr.id=m.posted_by ORDER BY m.movement_at DESC, ml.line_no LIMIT 500"),
        'receipts' => safeRows($pdo, "SELECT r.receipt_number AS id, COALESCE(p.prelot_code,'Sin pre-lote') AS prelot, COALESCE(s.trade_name,s.legal_name) AS supplier, i.name AS item, CONCAT(COALESCE(rl.ordered_qty,0),' ',u.code) AS expected, CONCAT(rl.received_qty,' ',u.code) AS received, COALESCE(l.quality_status,'PENDING') AS quality, r.status FROM goods_receipts r INNER JOIN suppliers s ON s.id=r.supplier_id INNER JOIN goods_receipt_lines rl ON rl.receipt_id=r.id INNER JOIN items i ON i.id=rl.item_id INNER JOIN units_of_measure u ON u.id=rl.uom_id LEFT JOIN pre_lots p ON p.id=r.prelot_id LEFT JOIN inventory_lots l ON l.id=rl.inventory_lot_id ORDER BY r.arrived_at DESC LIMIT 500"),
        'quality' => safeRows($pdo, "SELECT q.request_number AS id, DATE_FORMAT(q.requested_at,'%d %b · %H:%i') AS requested, q.request_type AS type, COALESCE(r.receipt_number,q.target_type,'Sin referencia') AS reference, COALESCE(i.name,'Pendiente de identificar') AS item, COALESCE(l.lot_code,'Sin lote') AS lot, COALESCE(u.display_name,'Sin asignar') AS owner, q.status FROM quality_requests q LEFT JOIN goods_receipt_lines rl ON rl.id=q.receipt_line_id LEFT JOIN goods_receipts r ON r.id=rl.receipt_id LEFT JOIN inventory_lots l ON l.id=q.inventory_lot_id LEFT JOIN items i ON i.id=l.item_id LEFT JOIN app_users u ON u.id=q.assigned_to ORDER BY q.requested_at DESC LIMIT 500"),
        'forecast' => buildForecast($pdo),
        'mrp' => safeRows($pdo, "SELECT i.name AS item, i.sku, r.gross_requirement AS required, GREATEST(r.on_hand_qty-r.reserved_qty,0) AS available, r.scheduled_receipts AS incoming, GREATEST(r.net_requirement,0) AS shortage, r.requirement_date AS needDate, CASE WHEN r.net_requirement > 0 THEN 'Comprar o programar' ELSE 'Sin acción' END AS action, r.status FROM mrp_requirements r INNER JOIN items i ON i.id=r.item_id INNER JOIN mrp_runs run ON run.id=r.mrp_run_id WHERE run.id=(SELECT MAX(id) FROM mrp_runs WHERE status='COMPLETED') ORDER BY r.requirement_date,i.name LIMIT 2000"),
        'production' => safeRows($pdo, "SELECT o.order_number AS id, i.name AS item, COALESCE(c.trade_name,c.legal_name,'Sin cliente') AS customer, CONCAT(o.planned_qty,' ',u.code) AS planned, CONCAT(o.completed_qty,' ',u.code) AS completed, CONCAT(DATE_FORMAT(o.planned_start,'%d %b'),'–',DATE_FORMAT(o.planned_end,'%d %b')) AS date, CASE WHEN o.status IN ('MATERIAL_CHECK','ON_HOLD') THEN 'No completo' ELSE 'Completo' END AS material, o.status FROM production_orders o INNER JOIN items i ON i.id=o.finished_item_id INNER JOIN units_of_measure u ON u.id=o.uom_id LEFT JOIN customers c ON c.id=o.customer_id ORDER BY o.planned_start DESC LIMIT 500"),
        'shipments' => safeRows($pdo, "SELECT s.shipment_number AS id, COALESCE(o.order_number,'Sin pedido') AS `order`, COALESCE(c.trade_name,c.legal_name) AS customer, COALESCE(DATE_FORMAT(a.scheduled_start,'%d %b · %H:%i'),'Sin cita') AS scheduled, COUNT(sl.id) AS packages, s.status AS progress, 'Por asignar' AS dock, s.status FROM shipments s INNER JOIN customers c ON c.id=s.customer_id LEFT JOIN outbound_appointments a ON a.id=s.outbound_appointment_id LEFT JOIN shipment_lines sl ON sl.shipment_id=s.id LEFT JOIN sales_order_lines sol ON sol.id=sl.sales_order_line_id LEFT JOIN sales_orders o ON o.id=sol.sales_order_id GROUP BY s.id,o.order_number,c.trade_name,c.legal_name,a.scheduled_start,s.status ORDER BY a.scheduled_start DESC LIMIT 500"),
        'returns' => safeRows($pdo, "SELECT r.return_number AS id, 'Cliente' AS type, COALESCE(c.trade_name,c.legal_name) AS partner, COALESCE(r.customer_claim_ref,'Sin referencia') AS reference, i.name AS item, COALESCE(l.lot_code,'Sin lote') AS lot, CONCAT(rl.return_qty,' ',u.code) AS qty, r.return_reason AS reason, r.status FROM customer_returns r INNER JOIN customers c ON c.id=r.customer_id INNER JOIN customer_return_lines rl ON rl.customer_return_id=r.id INNER JOIN items i ON i.id=rl.item_id INNER JOIN units_of_measure u ON u.id=rl.uom_id LEFT JOIN inventory_lots l ON l.id=rl.original_lot_id ORDER BY r.created_at DESC LIMIT 500"),
        'counts' => safeRows($pdo, "SELECT c.count_number AS id, w.name AS warehouse,w.warehouse_type AS warehouseType, c.count_type AS scope, COALESCE(DATE_FORMAT(c.started_at,'%d %b · %H:%i'),DATE_FORMAT(c.created_at,'%d %b · %H:%i')) AS planned, COALESCE(u.display_name,'Sin asignar') AS owner, CASE WHEN COUNT(cl.id)=0 THEN 'Pendiente' ELSE CONCAT(SUM(CASE WHEN ABS(cl.variance_qty)>0.000001 THEN 1 ELSE 0 END),' de ',COUNT(cl.id),' partidas con diferencia') END AS variance, c.status FROM inventory_counts c INNER JOIN warehouses w ON w.id=c.warehouse_id LEFT JOIN app_users u ON u.id=c.created_by LEFT JOIN inventory_count_lines cl ON cl.inventory_count_id=c.id GROUP BY c.id,w.name,w.warehouse_type,c.count_type,c.started_at,c.created_at,u.display_name,c.status ORDER BY c.created_at DESC LIMIT 500"),
        'auditSchedules' => buildInventoryAuditSchedules($pdo),
        'inventoryAuditDetails' => buildInventoryAuditDetails($pdo),
        'maintenance' => buildMaintenanceWork($pdo, $user),
        'maintenanceUpdates' => buildMaintenanceUpdates($pdo, $user),
        'maintenanceEvidence' => buildMaintenanceEvidence($pdo, $user),
        'initialInventory' => safeRows($pdo, "SELECT s.session_number AS id,w.name AS warehouse,w.warehouse_type AS warehouseType,DATE_FORMAT(s.inventory_date,'%d %b %Y') AS inventoryDate,COUNT(l.id) AS lines,COALESCE(SUM(l.counted_qty),0) AS quantity,COALESCE(u.display_name,'Sistema') AS user,s.status FROM initial_inventory_sessions s INNER JOIN warehouses w ON w.id=s.warehouse_id LEFT JOIN initial_inventory_lines l ON l.initial_inventory_id=s.id LEFT JOIN app_users u ON u.id=s.created_by GROUP BY s.id,s.session_number,w.name,w.warehouse_type,s.inventory_date,u.display_name,s.status ORDER BY s.created_at DESC LIMIT 500"),
        'users' => buildUserList($pdo, $user, $isAdmin),
        'purchaseDashboard' => buildPurchaseDashboard($pdo),
        'audit' => safeRows($pdo, "SELECT DATE_FORMAT(a.occurred_at,'%d %b · %H:%i:%s') AS date,COALESCE(u.display_name,'Sistema') AS user,COALESCE(ar.name,'Sin área') AS area,a.action_code AS action,a.entity_type AS entity,COALESCE(a.entity_id,'—') AS reference,COALESCE(a.reason,'Cambio registrado') AS detail FROM audit_log a LEFT JOIN app_users u ON u.id=a.actor_user_id LEFT JOIN areas ar ON ar.id=a.area_id ORDER BY a.occurred_at DESC LIMIT 1000"),
    ];
    $result=array_merge($result,buildV14Bootstrap($pdo,$user,$isAdmin));
    $result['lookups']=array_merge($result['lookups'],buildV14Lookups($pdo,$user,$isAdmin));
    applyV14DataScope($pdo,$user,$isAdmin,$result);
    $dataPermissions=[
        'appointments'=>'APPOINTMENTS','receipts'=>'RECEIVING','quality'=>'QUALITY','inventory'=>'INVENTORY','movements'=>'INVENTORY',
        'forecast'=>'FORECAST','mrp'=>'MRP','production'=>'PRODUCTION','shipments'=>'SHIPPING','returns'=>'RETURNS','counts'=>'COUNTS','auditSchedules'=>'COUNTS','inventoryAuditDetails'=>'COUNTS',
        'initialInventory'=>'INITIAL_INVENTORY','maintenance'=>'MAINTENANCE','maintenanceUpdates'=>'MAINTENANCE','maintenanceEvidence'=>'MAINTENANCE',
        'purchaseDashboard'=>'PURCHASING','audit'=>'AUDIT_LOG'
    ];
    $warehouseView=$isAdmin||hasAnyPermissionV14($pdo,(int)$user['id'],['WAREHOUSE_RAW','WAREHOUSE_PACKAGING','WAREHOUSE_SPARES','WAREHOUSE_FINISHED'],'VIEW');
    foreach($dataPermissions as $key=>$moduleCode)if(!$isAdmin&&!userHasPermission($pdo,(int)$user['id'],$moduleCode,'VIEW')){
        if($warehouseView&&in_array($key,['counts','auditSchedules','inventoryAuditDetails','initialInventory'],true))continue;
        $result[$key]=[];
    }
    if(!$isAdmin){$result['users']=[];$result['audit']=[];}
    return $result;
}

function frontendModules(PDO $pdo, int $userId): array
{
    $map = ['DASHBOARD'=>'dashboard','PURCHASING'=>'purchasing','APPOINTMENTS'=>'purchasing','RECEIVING'=>'warehouseRaw','QUALITY'=>'quality','INVENTORY'=>'movements','INITIAL_INVENTORY'=>'warehouseAudits','COUNTS'=>'warehouseAudits','FORECAST'=>'forecast','MRP'=>'mrp','PRODUCTION'=>'filling','FILLING'=>'filling','EXTRACTION'=>'extraction','SHIPPING'=>'shipping','RETURNS'=>'returns','MAINTENANCE'=>'maintenance','WAREHOUSE_RAW'=>'warehouseRaw','WAREHOUSE_PACKAGING'=>'warehousePackaging','WAREHOUSE_SPARES'=>'warehouseSpares','WAREHOUSE_FINISHED'=>'warehouseFinished','QUALITY_ANALYTICS'=>'quality'];
    $rows = safeRows($pdo, "SELECT DISTINCT m.code FROM app_modules m INNER JOIN permissions p ON p.module_id=m.id AND p.action_code='VIEW' WHERE m.is_active=1 AND (EXISTS (SELECT 1 FROM user_roles ur INNER JOIN role_permissions rp ON rp.role_id=ur.role_id WHERE ur.user_id=:role_user AND ur.is_active=1 AND rp.permission_id=p.id) OR EXISTS (SELECT 1 FROM user_permission_overrides ua WHERE ua.user_id=:allow_user AND ua.permission_id=p.id AND ua.decision='ALLOW')) AND NOT EXISTS (SELECT 1 FROM user_permission_overrides ud WHERE ud.user_id=:deny_user AND ud.permission_id=p.id AND ud.decision='DENY')", ['role_user'=>$userId,'allow_user'=>$userId,'deny_user'=>$userId]);
    $modules = ['dashboard'];
    foreach ($rows as $row) {
        if (isset($map[$row['code']])) $modules[] = $map[$row['code']];
        if ($row['code'] === 'INVENTORY') $modules[] = 'movements';
        if ($row['code'] === 'COUNTS') $modules[] = 'warehouseAudits';
        if (in_array($row['code'],['WAREHOUSE_RAW','WAREHOUSE_PACKAGING','WAREHOUSE_SPARES','WAREHOUSE_FINISHED'],true)) $modules[] = 'warehouseAudits';
    }
    return array_values(array_unique($modules));
}

function frontendActions(PDO $pdo, int $userId): array
{
    $rows=safeRows($pdo,"SELECT DISTINCT m.code AS module_code,p.action_code
        FROM permissions p
        INNER JOIN app_modules m ON m.id=p.module_id AND m.is_active=1
        WHERE (
            EXISTS (SELECT 1 FROM user_roles ur INNER JOIN role_permissions rp ON rp.role_id=ur.role_id WHERE ur.user_id=:role_user AND ur.is_active=1 AND rp.permission_id=p.id)
            OR EXISTS (SELECT 1 FROM user_permission_overrides ua WHERE ua.user_id=:allow_user AND ua.permission_id=p.id AND ua.decision='ALLOW')
        )
        AND NOT EXISTS (SELECT 1 FROM user_permission_overrides ud WHERE ud.user_id=:deny_user AND ud.permission_id=p.id AND ud.decision='DENY')
        ORDER BY m.code,p.action_code",['role_user'=>$userId,'allow_user'=>$userId,'deny_user'=>$userId]);
    return array_values(array_map(static fn(array $row): string=>$row['module_code'].'.'.$row['action_code'],$rows));
}

function buildCoverage(PDO $pdo): array
{
    $rows = safeRows($pdo, "SELECT i.item_type, AVG(CASE WHEN i.reorder_point<=0 THEN 100 ELSE LEAST(100,GREATEST(0,COALESCE(s.available_qty,0)/i.reorder_point*100)) END) AS value FROM items i LEFT JOIN (SELECT item_id,SUM(available_qty) AS available_qty FROM vw_inventory_availability GROUP BY item_id) s ON s.item_id=i.id WHERE i.is_active=1 GROUP BY i.item_type");
    $labels = ['FINISHED_GOOD'=>'Producto terminado','PACKAGING'=>'Materiales de empaque','RAW_FRUIT'=>'Materia prima fruta','SPARE_PART'=>'Refacciones críticas'];
    $result = [];
    foreach ($rows as $row) if (isset($labels[$row['item_type']])) {
        $value = round((float)$row['value']);
        $result[] = ['name'=>$labels[$row['item_type']], 'value'=>$value, 'tone'=>$value<50?'red':($value<75?'amber':'green')];
    }
    return $result;
}

function buildForecast(PDO $pdo): array
{
    return safeRows($pdo, "SELECT COALESCE(c.trade_name,c.legal_name,'General') AS customer,i.sku,i.name AS item,COALESCE(orig.forecast_qty,0) AS original,cur.forecast_qty AS current,(cur.forecast_qty-COALESCE(orig.forecast_qty,0)) AS delta,CASE WHEN cur.forecast_qty>COALESCE(orig.forecast_qty,0) THEN 'Mayor necesidad de materiales' WHEN cur.forecast_qty<COALESCE(orig.forecast_qty,0) THEN 'Liberación de material' ELSE 'Sin cambio' END AS impact,'Pendiente MRP' AS status FROM forecast_versions cv INNER JOIN forecast_lines cur ON cur.forecast_version_id=cv.id INNER JOIN items i ON i.id=cur.finished_item_id LEFT JOIN customers c ON c.id=cur.customer_id LEFT JOIN forecast_versions ov ON ov.forecast_plan_id=cv.forecast_plan_id AND ov.version_type='ORIGINAL' LEFT JOIN forecast_lines orig ON orig.forecast_version_id=ov.id AND orig.finished_item_id=cur.finished_item_id AND orig.customer_id<=>cur.customer_id AND orig.period_start=cur.period_start WHERE cv.is_current=1 ORDER BY cur.period_start,c.legal_name,i.name LIMIT 2000");
}

function traceLot(PDO $pdo, array $user, array $payload): array
{
    requirePermission($pdo, (int)$user['id'], 'EXTRACTION', 'VIEW');
    $lotCode = requiredString($payload, 'lot_code', 'el código de lote', 100);
    $lot = findOne(
        $pdo,
        "SELECT l.id, l.lot_code, i.sku, i.name AS item, l.quality_status, l.lot_status,
                l.received_date, COALESCE(s.trade_name,s.legal_name) AS supplier,
                o.origin_name AS origin, p.prelot_code
           FROM inventory_lots l
           INNER JOIN items i ON i.id=l.item_id
           LEFT JOIN suppliers s ON s.id=l.supplier_id
           LEFT JOIN supplier_origins o ON o.id=l.origin_id
           LEFT JOIN pre_lots p ON p.id=l.prelot_id
          WHERE l.lot_code=:lot_code LIMIT 1",
        ['lot_code'=>$lotCode],
        'No existe un lote con ese código.'
    );
    $edges = safeRows(
        $pdo,
        "WITH RECURSIVE
         ancestors(lot_id) AS (
             SELECT :seed_up
             UNION DISTINCT
             SELECT e.parent_lot_id FROM vw_lot_traceability_edges e INNER JOIN ancestors a ON e.child_lot_id=a.lot_id
         ),
         descendants(lot_id) AS (
             SELECT :seed_down
             UNION DISTINCT
             SELECT e.child_lot_id FROM vw_lot_traceability_edges e INNER JOIN descendants d ON e.parent_lot_id=d.lot_id
         ),
         related(lot_id) AS (
             SELECT lot_id FROM ancestors UNION SELECT lot_id FROM descendants
         )
         SELECT DISTINCT e.batch_code,e.parent_lot_code,e.child_lot_code,e.parent_qty_used,e.contribution_pct,e.created_at
           FROM vw_lot_traceability_edges e
          WHERE e.parent_lot_id IN (SELECT lot_id FROM related)
             OR e.child_lot_id IN (SELECT lot_id FROM related)
          ORDER BY e.created_at,e.batch_code,e.parent_lot_code,e.child_lot_code",
        ['seed_up'=>$lot['id'],'seed_down'=>$lot['id']]
    );
    unset($lot['id']);
    return ['lot'=>$lot,'edges'=>$edges];
}

function createOperation(PDO $pdo, array $user, array $payload, array $config): array
{
    $type = requiredString($payload, 'operation_type', 'el tipo de operación', 30);
    $result=match ($type) {
        'appointment' => createAppointment($pdo, $user, $payload),
        'receipt' => createReceipt($pdo, $user, $payload),
        'movement' => createMovement($pdo, $user, $payload),
        'quality' => createQualityRequest($pdo, $user, $payload),
        'qualityDecision' => createQualityDecision($pdo, $user, $payload),
        'count' => createInventoryCount($pdo, $user, $payload),
        'return' => createCustomerReturn($pdo, $user, $payload),
        'user' => createUser($pdo, $user, $payload),
        'supplier' => createSupplier($pdo, $user, $payload),
        'origin' => createSupplierOrigin($pdo, $user, $payload),
        'warehouse' => createWarehouse($pdo, $user, $payload),
        'location' => createWarehouseLocation($pdo, $user, $payload),
        'item' => createItem($pdo, $user, $payload),
        'customer' => createCustomer($pdo, $user, $payload),
        'bom' => createBomComponent($pdo, $user, $payload),
        'area' => createArea($pdo, $user, $payload),
        'role' => createRole($pdo, $user, $payload),
        'technician' => createTechnician($pdo, $user, $payload),
        'initialInventory' => createInitialInventory($pdo, $user, $payload),
        'physicalCount' => createPhysicalCount($pdo, $user, $payload),
        'auditSchedule' => createInventoryAuditSchedule($pdo, $user, $payload),
        'forecastImport' => importForecast($pdo, $user, $payload),
        'maintenanceRequest' => createMaintenanceWorkRequest($pdo, $user, $payload, $config),
        'maintenanceAssignment' => assignMaintenanceTechnicians($pdo, $user, $payload, $config),
        'maintenanceUpdate' => updateMaintenanceWork($pdo, $user, $payload, $config),
        'warehouseItem' => createAreaItemV14($pdo, $user, $payload),
        'appointmentV14' => createAppointmentV14($pdo, $user, $payload),
        'receiptV14' => createReceiptV14($pdo, $user, $payload),
        'productionOrder' => createProductionOrderV14($pdo, $user, $payload),
        'productionCompletion' => createProductionCompletionV14($pdo, $user, $payload),
        'extractionBatch' => createExtractionV14($pdo, $user, $payload),
        'qualityDecisionV14' => saveQualityDecisionV14($pdo, $user, $payload),
        'qualityCancel' => cancelQualityRequestV14($pdo, $user, $payload),
        'technicianV14' => registerTechnicianV14($pdo, $user, $payload),
        default => failRequest('Tipo de operación no soportado.', 422),
    };
    if(in_array($type,['movement','receiptV14','qualityDecision','qualityDecisionV14','initialInventory','physicalCount','productionCompletion','extractionBatch'],true))$result['mrpRunsUpdated']=recalculateCurrentForecasts($pdo,(int)$user['id']);
    return $result;
}

function createAppointment(PDO $pdo, array $user, array $payload): array
{
    requireArea($pdo,$user,['COMPRAS','LOGISTICA']);
    requirePermission($pdo, (int)$user['id'], 'APPOINTMENTS', 'CREATE');
    $supplier = findOne($pdo, "SELECT id FROM suppliers WHERE supplier_code=:code AND is_active=1", ['code'=>requiredString($payload,'supplier_code','el proveedor',40)], 'El proveedor no existe o está inactivo.');
    $start = new DateTimeImmutable(requiredString($payload,'scheduled_at','la fecha y hora'), new DateTimeZone('America/Mexico_City'));
    $duration = max(15, min(480, (int)($payload['duration'] ?? 60)));
    $end = $start->modify("+{$duration} minutes");
    $deliveryMap = ['Recolección de fruta'=>'COLLECTION','Entrega de proveedor'=>'SUPPLIER_DELIVERY','Devolución'=>'RETURN'];
    $delivery = $deliveryMap[(string)($payload['delivery_type'] ?? '')] ?? 'SUPPLIER_DELIVERY';
    $itemType = in_array(($payload['expected_item_type'] ?? ''), ['RAW_FRUIT','PACKAGING','SPARE_PART','RAW_OTHER','MIXED'], true) ? $payload['expected_item_type'] : 'MIXED';
    $pdo->beginTransaction();
    $statement = $pdo->prepare("INSERT INTO inbound_appointments (appointment_number,supplier_id,delivery_type,scheduled_start,scheduled_end,expected_item_type,status,notes,created_by) VALUES (:number,:supplier,:delivery,:start,:end,:item_type,'PLANNED',:notes,:user)");
    $statement->execute(['number'=>provisionalNumber('CIT'),'supplier'=>$supplier['id'],'delivery'=>$delivery,'start'=>$start->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s'),'end'=>$end->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s'),'item_type'=>$itemType,'notes'=>requiredString($payload,'material','el material esperado',500),'user'=>$user['id']]);
    $id = (int)$pdo->lastInsertId(); $number = finalNumber('CIT',$id);
    $pdo->prepare("UPDATE inbound_appointments SET appointment_number=:number WHERE id=:id")->execute(['number'=>$number,'id'=>$id]);
    writeAudit($pdo,(int)$user['id'],'CREATE','inbound_appointment',$id,['appointment_number'=>$number]);
    $pdo->commit();
    return ['id'=>$id,'number'=>$number];
}

function createReceipt(PDO $pdo, array $user, array $payload): array
{
    requireArea($pdo,$user,['ALMACEN']);
    requirePermission($pdo, (int)$user['id'], 'RECEIVING', 'CREATE');
    $supplierCode=requiredString($payload,'supplier_code','el proveedor',40); $originCode=requiredString($payload,'origin_code','el origen',12);
    $master=findOne($pdo,"SELECT s.id AS supplier_id,s.short_code,o.id AS origin_id,o.origin_code FROM suppliers s INNER JOIN supplier_origins o ON o.supplier_id=s.id WHERE s.supplier_code=:supplier AND o.origin_code=:origin AND s.is_active=1 AND o.is_active=1",['supplier'=>$supplierCode,'origin'=>$originCode],'El proveedor o el origen no existe.');
    $item=findOne($pdo,"SELECT id,base_uom_id,lot_controlled,item_type FROM items WHERE sku=:sku AND is_active=1",['sku'=>requiredString($payload,'sku','el SKU',80)],'El SKU no existe o está inactivo.');
    $warehouse=findOne($pdo,"SELECT w.id AS warehouse_id,l.id AS location_id FROM warehouses w INNER JOIN warehouse_locations l ON l.warehouse_id=w.id WHERE w.code=:warehouse AND l.code=:location AND w.is_active=1 AND l.is_active=1",['warehouse'=>requiredString($payload,'warehouse_code','el almacén',30),'location'=>requiredString($payload,'location_code','la ubicación',50)],'El almacén o la ubicación no existe.');
    $expected=positiveNumber($payload,'expected_weight','El peso esperado'); $received=positiveNumber($payload,'received_weight','El peso recibido');
    $appointmentId=null; if (!empty($payload['appointment'])) { $appointment=findOne($pdo,"SELECT id FROM inbound_appointments WHERE appointment_number=:number",['number'=>trim((string)$payload['appointment'])],'La cita indicada no existe.'); $appointmentId=$appointment['id']; }
    $today=(new DateTimeImmutable('now', new DateTimeZone('America/Mexico_City')))->format('Y-m-d');
    $pdo->beginTransaction();
    $sequence=$pdo->prepare("INSERT INTO prelot_sequences (supplier_id,origin_id,lot_date,next_value) VALUES (:supplier,:origin,:date,LAST_INSERT_ID(1)) ON DUPLICATE KEY UPDATE next_value=LAST_INSERT_ID(next_value+1)");
    $sequence->execute(['supplier'=>$master['supplier_id'],'origin'=>$master['origin_id'],'date'=>$today]);
    $seq=(int)$pdo->lastInsertId();
    $prelotCode=strtoupper($master['short_code'].'-'.$master['origin_code'].'-'.str_replace('-','',$today).'-'.str_pad((string)$seq,3,'0',STR_PAD_LEFT));
    $pdo->prepare("INSERT INTO pre_lots (prelot_code,supplier_id,origin_id,appointment_id,planned_arrival_date,daily_sequence,expected_weight_kg,status,confirmed_at,created_by) VALUES (:code,:supplier,:origin,:appointment,:date,:seq,:weight,'RECEIVED',UTC_TIMESTAMP(6),:user)")
        ->execute(['code'=>$prelotCode,'supplier'=>$master['supplier_id'],'origin'=>$master['origin_id'],'appointment'=>$appointmentId,'date'=>$today,'seq'=>$seq,'weight'=>$expected,'user'=>$user['id']]);
    $prelotId=(int)$pdo->lastInsertId();
    $pdo->prepare("INSERT INTO inventory_lots (item_id,lot_code,prelot_id,supplier_id,origin_id,received_date,quality_status,lot_status,created_by) VALUES (:item,:code,:prelot,:supplier,:origin,:date,'PENDING','BLOCKED',:user)")
        ->execute(['item'=>$item['id'],'code'=>$prelotCode,'prelot'=>$prelotId,'supplier'=>$master['supplier_id'],'origin'=>$master['origin_id'],'date'=>$today,'user'=>$user['id']]);
    $lotId=(int)$pdo->lastInsertId();
    $pdo->prepare("INSERT INTO goods_receipts (receipt_number,appointment_id,prelot_id,supplier_id,warehouse_id,arrived_at,gross_weight_kg,tare_weight_kg,status,received_by) VALUES (:number,:appointment,:prelot,:supplier,:warehouse,UTC_TIMESTAMP(6),:weight,0,'WAITING_QUALITY',:user)")
        ->execute(['number'=>provisionalNumber('REC'),'appointment'=>$appointmentId,'prelot'=>$prelotId,'supplier'=>$master['supplier_id'],'warehouse'=>$warehouse['warehouse_id'],'weight'=>$received,'user'=>$user['id']]);
    $receiptId=(int)$pdo->lastInsertId(); $receiptNumber=finalNumber('REC',$receiptId);
    $pdo->prepare("UPDATE goods_receipts SET receipt_number=:number WHERE id=:id")->execute(['number'=>$receiptNumber,'id'=>$receiptId]);
    $pdo->prepare("INSERT INTO goods_receipt_lines (receipt_id,line_no,item_id,inventory_lot_id,uom_id,ordered_qty,received_qty,notes) VALUES (:receipt,1,:item,:lot,:uom,:expected,:received,:notes)")
        ->execute(['receipt'=>$receiptId,'item'=>$item['id'],'lot'=>$lotId,'uom'=>$item['base_uom_id'],'expected'=>$expected,'received'=>$received,'notes'=>mb_substr(trim((string)($payload['notes']??'')),0,500)]);
    $lineId=(int)$pdo->lastInsertId();
    $qualityType=$item['item_type']==='RAW_FRUIT'?'INBOUND_FRUIT':'INBOUND_MATERIAL';
    $pdo->prepare("INSERT INTO quality_requests (request_number,request_type,receipt_line_id,inventory_lot_id,requested_by,status) VALUES (:number,:type,:line,:lot,:user,'REQUESTED')")
        ->execute(['number'=>provisionalNumber('CAL'),'type'=>$qualityType,'line'=>$lineId,'lot'=>$lotId,'user'=>$user['id']]);
    $qualityId=(int)$pdo->lastInsertId(); $qualityNumber=finalNumber('CAL',$qualityId);
    $pdo->prepare("UPDATE quality_requests SET request_number=:number WHERE id=:id")->execute(['number'=>$qualityNumber,'id'=>$qualityId]);
    $pdo->prepare("INSERT INTO inventory_movements (movement_number,movement_type,source_type,source_id,source_reference,status,movement_at,reason,created_by) VALUES (:number,'RECEIPT','goods_receipt',:source_id,:source_reference,'DRAFT',UTC_TIMESTAMP(6),'Recepción física pendiente de liberación de Calidad',:user)")
        ->execute(['number'=>provisionalNumber('MOV'),'source_id'=>$receiptId,'source_reference'=>$receiptNumber,'user'=>$user['id']]);
    $movementId=(int)$pdo->lastInsertId(); $movementNumber=finalNumber('MOV',$movementId);
    $pdo->prepare("UPDATE inventory_movements SET movement_number=:number WHERE id=:id")->execute(['number'=>$movementNumber,'id'=>$movementId]);
    $pdo->prepare("INSERT INTO inventory_movement_lines (movement_id,line_no,item_id,inventory_lot_id,warehouse_id,location_id,uom_id,quantity_delta,notes) VALUES (:movement,1,:item,:lot,:warehouse,:location,:uom,:qty,'Entrada física en cuarentena')")
        ->execute(['movement'=>$movementId,'item'=>$item['id'],'lot'=>$lotId,'warehouse'=>$warehouse['warehouse_id'],'location'=>$warehouse['location_id'],'uom'=>$item['base_uom_id'],'qty'=>$received]);
    if ($appointmentId !== null) {
        $pdo->prepare("UPDATE inbound_appointments SET actual_arrival_at=COALESCE(actual_arrival_at,UTC_TIMESTAMP(6)),status='IN_INSPECTION' WHERE id=:id")
            ->execute(['id'=>$appointmentId]);
    }
    writeAudit($pdo,(int)$user['id'],'CREATE','goods_receipt',$receiptId,['receipt_number'=>$receiptNumber,'prelot'=>$prelotCode,'quality_request'=>$qualityNumber,'inventory_movement'=>$movementNumber]);
    $pdo->commit();
    $post=$pdo->prepare("CALL sp_post_inventory_movement(:movement,:user)");
    $post->execute(['movement'=>$movementId,'user'=>$user['id']]);
    $post->closeCursor();
    return ['id'=>$receiptId,'number'=>$receiptNumber,'prelot'=>$prelotCode,'quality_request'=>$qualityNumber,'inventory_movement'=>$movementNumber];
}

function createQualityRequest(PDO $pdo, array $user, array $payload): array
{
    requireArea($pdo,$user,['CALIDAD','ALMACEN']);
    requirePermission($pdo,(int)$user['id'],'QUALITY','CREATE'); $reference=requiredString($payload,'reference','la recepción o lote',100);
    $target=safeRows($pdo,"SELECT rl.id AS receipt_line_id,l.id AS lot_id FROM goods_receipts r INNER JOIN goods_receipt_lines rl ON rl.receipt_id=r.id LEFT JOIN inventory_lots l ON l.id=rl.inventory_lot_id WHERE r.receipt_number=:ref UNION SELECT NULL,id FROM inventory_lots WHERE lot_code=:ref2 LIMIT 1",['ref'=>$reference,'ref2'=>$reference]);
    $requestType='OTHER'; $type=(string)($payload['quality_type']??''); if (str_contains($type,'fruta')) $requestType='INBOUND_FRUIT'; elseif(str_contains($type,'empaque'))$requestType='INBOUND_MATERIAL'; elseif(str_contains($type,'proceso'))$requestType='IN_PROCESS'; elseif(str_contains($type,'terminado'))$requestType='FINISHED_GOOD'; elseif(str_contains($type,'Devolución'))$requestType='CUSTOMER_RETURN';
    $pdo->beginTransaction();
    $pdo->prepare("INSERT INTO quality_requests (request_number,request_type,receipt_line_id,inventory_lot_id,target_type,requested_by,status,disposition_reason) VALUES (:number,:type,:line,:lot,:target,:user,'REQUESTED',:tests)")
        ->execute(['number'=>provisionalNumber('CAL'),'type'=>$requestType,'line'=>$target[0]['receipt_line_id']??null,'lot'=>$target[0]['lot_id']??null,'target'=>$reference,'user'=>$user['id'],'tests'=>requiredString($payload,'tests','las pruebas solicitadas',1000)]);
    $id=(int)$pdo->lastInsertId(); $number=finalNumber('CAL',$id); $pdo->prepare("UPDATE quality_requests SET request_number=:number WHERE id=:id")->execute(['number'=>$number,'id'=>$id]);
    writeAudit($pdo,(int)$user['id'],'CREATE','quality_request',$id,['request_number'=>$number]); $pdo->commit(); return ['id'=>$id,'number'=>$number];
}

function createQualityDecision(PDO $pdo, array $user, array $payload): array
{
    requireArea($pdo,$user,['CALIDAD']);
    $disposition = requiredString($payload, 'disposition', 'el dictamen', 25);
    if (!in_array($disposition, ['APPROVED','CONDITIONAL','REJECTED'], true)) {
        failRequest('El dictamen no es válido.', 422);
    }
    requirePermission($pdo, (int)$user['id'], 'QUALITY', $disposition === 'REJECTED' ? 'REJECT' : 'APPROVE');
    $request = findOne(
        $pdo,
        "SELECT q.id,q.status,q.inventory_lot_id,q.receipt_line_id,rl.receipt_id,rl.received_qty
           FROM quality_requests q
           LEFT JOIN goods_receipt_lines rl ON rl.id=q.receipt_line_id
          WHERE q.request_number=:number LIMIT 1",
        ['number'=>requiredString($payload,'request_number','el folio de solicitud',50)],
        'La solicitud de Calidad no existe.'
    );
    if (in_array($request['status'], ['COMPLETED','CANCELLED'], true)) {
        failRequest('La solicitud ya está cerrada.', 409);
    }
    $reason = requiredString($payload, 'reason', 'la justificación', 1000);
    $pdo->beginTransaction();
    $pdo->prepare("UPDATE quality_requests SET status='COMPLETED',disposition=:disposition,disposition_reason=:reason,completed_at=UTC_TIMESTAMP(6),decided_by=:user,decided_at=UTC_TIMESTAMP(6) WHERE id=:id")
        ->execute(['disposition'=>$disposition,'reason'=>$reason,'user'=>$user['id'],'id'=>$request['id']]);
    $pdo->prepare("INSERT INTO quality_status_history (quality_request_id,from_status,to_status,notes,changed_by) VALUES (:request,:from_status,'COMPLETED',:notes,:user)")
        ->execute(['request'=>$request['id'],'from_status'=>$request['status'],'notes'=>$reason,'user'=>$user['id']]);
    if ($request['inventory_lot_id'] !== null) {
        $pdo->prepare("UPDATE inventory_lots SET quality_status=:quality,lot_status=:lot_status WHERE id=:id")
            ->execute(['quality'=>$disposition,'lot_status'=>$disposition==='REJECTED'?'BLOCKED':'OPEN','id'=>$request['inventory_lot_id']]);
    }
    if ($request['receipt_line_id'] !== null) {
        $received=(float)$request['received_qty'];
        $pdo->prepare("UPDATE goods_receipt_lines SET accepted_qty=:accepted,rejected_qty=:rejected WHERE id=:id")
            ->execute(['accepted'=>$disposition==='REJECTED'?0:$received,'rejected'=>$disposition==='REJECTED'?$received:0,'id'=>$request['receipt_line_id']]);
    }
    if ($request['receipt_id'] !== null) {
        $receiptStatus=$disposition==='REJECTED'?'REJECTED':($disposition==='CONDITIONAL'?'PARTIALLY_ACCEPTED':'ACCEPTED');
        $pdo->prepare("UPDATE goods_receipts SET status=:status WHERE id=:id")->execute(['status'=>$receiptStatus,'id'=>$request['receipt_id']]);
    }
    writeAudit($pdo,(int)$user['id'],$disposition==='REJECTED'?'REJECT':'APPROVE','quality_request',$request['id'],['disposition'=>$disposition],$reason);
    $pdo->commit();
    return ['id'=>(int)$request['id'],'disposition'=>$disposition];
}

function createInventoryCount(PDO $pdo, array $user, array $payload): array
{
    requireArea($pdo,$user,['ALMACEN']);
    requirePermission($pdo,(int)$user['id'],'COUNTS','CREATE'); $warehouse=findOne($pdo,"SELECT id FROM warehouses WHERE code=:code AND is_active=1",['code'=>requiredString($payload,'warehouse_code','el almacén',30)],'El almacén no existe.');
    $types=['Cíclico'=>'CYCLE','Total'=>'FULL','Selectivo'=>'SPOT']; $type=$types[(string)($payload['count_type']??'')]??'SPOT';
    $pdo->beginTransaction(); $pdo->prepare("INSERT INTO inventory_counts (count_number,warehouse_id,count_type,status,created_by) VALUES (:number,:warehouse,:type,'PLANNED',:user)")->execute(['number'=>provisionalNumber('CON'),'warehouse'=>$warehouse['id'],'type'=>$type,'user'=>$user['id']]);
    $id=(int)$pdo->lastInsertId();$number=finalNumber('CON',$id);$pdo->prepare("UPDATE inventory_counts SET count_number=:number WHERE id=:id")->execute(['number'=>$number,'id'=>$id]);writeAudit($pdo,(int)$user['id'],'CREATE','inventory_count',$id,['count_number'=>$number]);$pdo->commit();return ['id'=>$id,'number'=>$number];
}

function createMovement(PDO $pdo, array $user, array $payload): array
{
    requireArea($pdo,$user,['ALMACEN']);
    requirePermission($pdo,(int)$user['id'],'INVENTORY','POST'); $item=findOne($pdo,"SELECT id,base_uom_id,lot_controlled FROM items WHERE sku=:sku AND is_active=1",['sku'=>requiredString($payload,'sku','el SKU',80)],'El SKU no existe.');
    $lotId=null;$lot=null;$lotCode=trim((string)($payload['lot']??''));if((int)$item['lot_controlled']===1&&$lotCode==='')failRequest('El lote es obligatorio para este artículo.',422);if($lotCode!==''){$lot=findOne($pdo,"SELECT id,quality_status,lot_status FROM inventory_lots WHERE item_id=:item AND lot_code=:lot",['item'=>$item['id'],'lot'=>$lotCode],'El lote no existe para ese SKU.');$lotId=$lot['id'];}
    $from=resolveLocation($pdo,requiredString($payload,'from_location','la ubicación de origen',90));$displayType=(string)($payload['movement_type']??'');$map=['Transferencia'=>'TRANSFER','Salida a producción'=>'ISSUE_PRODUCTION','Salida a mantenimiento'=>'MAINTENANCE_ISSUE','Merma'=>'SCRAP'];if(!isset($map[$displayType]))failRequest('El tipo de movimiento no es válido.',422);$type=$map[$displayType];$qty=positiveNumber($payload,'quantity','La cantidad');$to=null;if($type==='TRANSFER')$to=resolveLocation($pdo,requiredString($payload,'to_location','la ubicación de destino',90));
    if (in_array($type,['ISSUE_PRODUCTION','MAINTENANCE_ISSUE'],true)) {
        if ($lot && !in_array($lot['quality_status'],['APPROVED','CONDITIONAL'],true)) failRequest('El lote no está liberado por Calidad.',409);
        if ((int)$from['is_blocked']===1 || in_array($from['location_type'],['QUALITY_HOLD','REJECTED'],true)) failRequest('La ubicación de origen no está disponible para consumo.',409);
    }
    $pdo->beginTransaction();try{$pdo->prepare("INSERT INTO inventory_movements (movement_number,movement_type,status,movement_at,reason,created_by) VALUES (:number,:type,'DRAFT',UTC_TIMESTAMP(6),:reason,:user)")->execute(['number'=>provisionalNumber('MOV'),'type'=>$type,'reason'=>requiredString($payload,'reason','el motivo',1000),'user'=>$user['id']]);$id=(int)$pdo->lastInsertId();$number=finalNumber('MOV',$id);$pdo->prepare("UPDATE inventory_movements SET movement_number=:number WHERE id=:id")->execute(['number'=>$number,'id'=>$id]);
        $insert=$pdo->prepare("INSERT INTO inventory_movement_lines (movement_id,line_no,item_id,inventory_lot_id,warehouse_id,location_id,uom_id,quantity_delta) VALUES (:movement,:line,:item,:lot,:warehouse,:location,:uom,:qty)");$insert->execute(['movement'=>$id,'line'=>1,'item'=>$item['id'],'lot'=>$lotId,'warehouse'=>$from['warehouse_id'],'location'=>$from['location_id'],'uom'=>$item['base_uom_id'],'qty'=>-$qty]);if($to)$insert->execute(['movement'=>$id,'line'=>2,'item'=>$item['id'],'lot'=>$lotId,'warehouse'=>$to['warehouse_id'],'location'=>$to['location_id'],'uom'=>$item['base_uom_id'],'qty'=>$qty]);postMovementV14($pdo,$id,(int)$user['id']);$pdo->commit();return ['id'=>$id,'number'=>$number];
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

function resolveLocation(PDO $pdo, string $value): array
{
    $parts=array_map('trim',explode('/',$value,2));if(count($parts)!==2)failRequest('Use el formato ALMACEN/UBICACION.',422);return findOne($pdo,"SELECT w.id AS warehouse_id,l.id AS location_id,l.location_type,l.is_blocked FROM warehouses w INNER JOIN warehouse_locations l ON l.warehouse_id=w.id WHERE w.code=:warehouse AND l.code=:location AND w.is_active=1 AND l.is_active=1",['warehouse'=>$parts[0],'location'=>$parts[1]],'El almacén o la ubicación no existe.');
}

function createCustomerReturn(PDO $pdo, array $user, array $payload): array
{
    requirePermission($pdo,(int)$user['id'],'RETURNS','CREATE');$customer=findOne($pdo,"SELECT id FROM customers WHERE customer_code=:code AND is_active=1",['code'=>requiredString($payload,'customer_code','el cliente',40)],'El cliente no existe.');$item=findOne($pdo,"SELECT id,base_uom_id FROM items WHERE sku=:sku AND is_active=1",['sku'=>requiredString($payload,'sku','el SKU',80)],'El SKU no existe.');$warehouse=findOne($pdo,"SELECT id FROM warehouses WHERE warehouse_type='RETURNS' AND is_active=1 ORDER BY id LIMIT 1",[],'Falta configurar un almacén de devoluciones.');$lotId=null;if(!empty($payload['lot'])){$lot=findOne($pdo,"SELECT id FROM inventory_lots WHERE item_id=:item AND lot_code=:lot",['item'=>$item['id'],'lot'=>trim((string)$payload['lot'])],'El lote no existe.');$lotId=$lot['id'];}
    $qty=positiveNumber($payload,'quantity','La cantidad');$reason=requiredString($payload,'reason','el motivo',1000);$pdo->beginTransaction();$pdo->prepare("INSERT INTO customer_returns (return_number,customer_id,received_warehouse_id,return_reason,customer_claim_ref,status,created_by) VALUES (:number,:customer,:warehouse,:reason,:reference,'REQUESTED',:user)")->execute(['number'=>provisionalNumber('DEV'),'customer'=>$customer['id'],'warehouse'=>$warehouse['id'],'reason'=>$reason,'reference'=>requiredString($payload,'reference','la referencia',100),'user'=>$user['id']]);$id=(int)$pdo->lastInsertId();$number=finalNumber('DEV',$id);$pdo->prepare("UPDATE customer_returns SET return_number=:number WHERE id=:id")->execute(['number'=>$number,'id'=>$id]);$pdo->prepare("INSERT INTO customer_return_lines (customer_return_id,line_no,item_id,original_lot_id,uom_id,return_qty) VALUES (:return_id,1,:item,:lot,:uom,:qty)")->execute(['return_id'=>$id,'item'=>$item['id'],'lot'=>$lotId,'uom'=>$item['base_uom_id'],'qty'=>$qty]);writeAudit($pdo,(int)$user['id'],'CREATE','customer_return',$id,['return_number'=>$number]);$pdo->commit();return ['id'=>$id,'number'=>$number];
}

function createUser(PDO $pdo, array $user, array $payload): array
{
    $isAdmin=isSuperAdmin($pdo,(int)$user['id']);
    if (!$isAdmin) failRequest('Solo el administrador del sistema puede crear usuarios y asignar accesos.',403);
    $email=mb_strtolower(requiredString($payload,'email','el correo',190));
    if (!filter_var($email,FILTER_VALIDATE_EMAIL)) failRequest('El correo no es válido.',422);
    $password=(string)($payload['password']??'');
    if (mb_strlen($password)<12) failRequest('La contraseña debe tener al menos 12 caracteres.',422);
    if (safeScalar($pdo,"SELECT COUNT(*) FROM app_users WHERE email=:email",['email'=>$email])>0) failRequest('Ya existe un usuario con ese correo.',409);
    $area=findOne($pdo,"SELECT id,code,name FROM areas WHERE id=:id AND is_active=1",['id'=>(int)($payload['area_id']??0)],'El área no existe o está inactiva.');
    $roleCode=strtoupper(requiredString($payload,'role_code','el rol',40));
    $allowedRoles=['OPERATOR','APPROVER','VIEWER','TECHNICIAN'];
    if (!$isAdmin && !in_array($roleCode,$allowedRoles,true)) failRequest('No puedes asignar ese rol.',422);
    if ($isAdmin && $roleCode==='SUPER_ADMIN') failRequest('El sistema solo permite un administrador general.',422);
    if ($roleCode==='TECHNICIAN' && $area['code']!=='MANTENIMIENTO') failRequest('El rol Técnico de mantenimiento solo puede pertenecer al área de Mantenimiento.',422);
    $role=findOne($pdo,"SELECT id FROM roles WHERE code=:code AND is_active=1",['code'=>$roleCode],'El rol no existe o está inactivo.');
    $rawModules=$payload['module_codes']??[];
    if (!is_array($rawModules)) $rawModules=explode(',',(string)$rawModules);
    $moduleCodes=array_values(array_unique(array_filter(array_map(fn($value)=>strtoupper(trim((string)$value)),$rawModules))));
    if (!$moduleCodes) failRequest('Indique al menos un módulo.',422);
    if (in_array('ADMIN',$moduleCodes,true) || in_array('AUDIT_LOG',$moduleCodes,true)) failRequest('La administración global y su bitácora están reservadas al administrador del sistema.',422);
    $actionsByRole=[
        'VIEWER'=>['VIEW','EXPORT'],
        'OPERATOR'=>['VIEW','CREATE','UPDATE','POST','EXPORT'],
        'APPROVER'=>['VIEW','APPROVE','REJECT','EXPORT'],
        'AREA_MANAGER'=>['VIEW','CREATE','UPDATE','APPROVE','REJECT','POST','EXPORT'],
        'AREA_ADMIN'=>['VIEW','CREATE','UPDATE','APPROVE','REJECT','POST','EXPORT','ADMIN'],
        'TECHNICIAN'=>['VIEW','CREATE','UPDATE'],
    ];
    $algorithm=defined('PASSWORD_ARGON2ID')?PASSWORD_ARGON2ID:PASSWORD_BCRYPT;
    $pdo->beginTransaction();
    $insert=$pdo->prepare("INSERT INTO app_users (primary_area_id,email,display_name,password_hash,status,must_change_password) VALUES (:area,:email,:name,:hash,'ACTIVE',0)");
    $insert->execute(['area'=>$area['id'],'email'=>$email,'name'=>requiredString($payload,'display_name','el nombre',160),'hash'=>password_hash($password,$algorithm)]);
    $newUserId=(int)$pdo->lastInsertId();
    $pdo->prepare("INSERT INTO user_roles (user_id,role_id,is_active,assigned_by) VALUES (:user,:role,1,:admin)")->execute(['user'=>$newUserId,'role'=>$role['id'],'admin'=>$user['id']]);
    $grant=$pdo->prepare("INSERT INTO user_permission_overrides (user_id,permission_id,decision,changed_by) SELECT :user,p.id,'ALLOW',:admin FROM permissions p INNER JOIN app_modules m ON m.id=p.module_id WHERE m.code=:module AND m.is_active=1 AND p.action_code=:action");
    foreach($moduleCodes as $moduleCode){
        $exists=findOne($pdo,"SELECT id FROM app_modules WHERE code=:code AND is_active=1",['code'=>$moduleCode],"El módulo {$moduleCode} no existe.");
        if(isset($actionsByRole[$roleCode])){foreach($actionsByRole[$roleCode] as $action)$grant->execute(['user'=>$newUserId,'admin'=>$user['id'],'module'=>$moduleCode,'action'=>$action]);}
        else{
            $roleModule=safeScalar($pdo,"SELECT COUNT(*) FROM role_permissions rp INNER JOIN permissions p ON p.id=rp.permission_id INNER JOIN app_modules m ON m.id=p.module_id WHERE rp.role_id=:role AND m.code=:module",['role'=>$role['id'],'module'=>$moduleCode]);
            if($roleModule<1)failRequest('El rol personalizado no incluye uno de los módulos seleccionados.',422);
        }
    }
    if(!isset($actionsByRole[$roleCode])){
        $allRolePermissions=safeRows($pdo,"SELECT rp.permission_id,m.code FROM role_permissions rp INNER JOIN permissions p ON p.id=rp.permission_id INNER JOIN app_modules m ON m.id=p.module_id WHERE rp.role_id=:role",['role'=>$role['id']]);
        $deny=$pdo->prepare("INSERT INTO user_permission_overrides (user_id,permission_id,decision,changed_by) VALUES (:user,:permission,'DENY',:admin)");
        foreach($allRolePermissions as $permission)if(!in_array($permission['code'],$moduleCodes,true))$deny->execute(['user'=>$newUserId,'permission'=>$permission['permission_id'],'admin'=>$user['id']]);
    }
    if($roleCode==='TECHNICIAN'){
        $pdo->prepare("INSERT INTO maintenance_technicians (user_id,specialties,phone,created_by) VALUES (:user,:specialties,:phone,:creator)")
            ->execute(['user'=>$newUserId,'specialties'=>optionalString($payload,'specialties',500),'phone'=>optionalString($payload,'phone',40),'creator'=>$user['id']]);
    }
    writeAudit($pdo,(int)$user['id'],'CREATE','app_user',$newUserId,['email'=>$email,'role'=>$roleCode,'modules'=>$moduleCodes]);
    $pdo->commit();
    return ['id'=>$newUserId,'email'=>$email];
}

function createSupplier(PDO $pdo, array $user, array $payload): array
{
    requireArea($pdo,$user,['COMPRAS']);
    requirePermission($pdo,(int)$user['id'],'PURCHASING','CREATE');
    $code=masterCode($payload,'supplier_code','el código de proveedor',40);
    $short=masterCode($payload,'short_code','las iniciales del proveedor',12);
    if (safeScalar($pdo,"SELECT COUNT(*) FROM suppliers WHERE supplier_code=:code OR short_code=:short",['code'=>$code,'short'=>$short])>0) failRequest('El código o las iniciales del proveedor ya existen.',409);
    $email=trim((string)($payload['contact_email']??'')); if($email!==''&&!filter_var($email,FILTER_VALIDATE_EMAIL))failRequest('El correo de contacto no es válido.',422);
    $statement=$pdo->prepare("INSERT INTO suppliers (supplier_code,short_code,legal_name,trade_name,contact_name,contact_email,created_by) VALUES (:code,:short,:legal_name,:trade_name,:contact_name,:contact_email,:user)");
    $statement->execute(['code'=>$code,'short'=>$short,'legal_name'=>requiredString($payload,'legal_name','la razón social',190),'trade_name'=>optionalString($payload,'trade_name',190),'contact_name'=>optionalString($payload,'contact_name',160),'contact_email'=>$email?:null,'user'=>$user['id']]);
    $id=(int)$pdo->lastInsertId(); writeAudit($pdo,(int)$user['id'],'CREATE','supplier',$id,['supplier_code'=>$code,'short_code'=>$short]);
    return ['id'=>$id,'code'=>$code];
}

function createSupplierOrigin(PDO $pdo, array $user, array $payload): array
{
    requireArea($pdo,$user,['COMPRAS']);
    requirePermission($pdo,(int)$user['id'],'PURCHASING','CREATE');
    $supplier=findOne($pdo,"SELECT id FROM suppliers WHERE supplier_code=:code AND is_active=1",['code'=>masterCode($payload,'supplier_code','el proveedor',40)],'El proveedor no existe o está inactivo.');
    $code=masterCode($payload,'origin_code','el código de origen',12);
    if (safeScalar($pdo,"SELECT COUNT(*) FROM supplier_origins WHERE supplier_id=:supplier AND origin_code=:code",['supplier'=>$supplier['id'],'code'=>$code])>0) failRequest('Ese origen ya existe para el proveedor.',409);
    $statement=$pdo->prepare("INSERT INTO supplier_origins (supplier_id,origin_code,origin_name,municipality,state_name) VALUES (:supplier,:code,:name,:municipality,:state_name)");
    $statement->execute(['supplier'=>$supplier['id'],'code'=>$code,'name'=>requiredString($payload,'origin_name','el nombre del origen',160),'municipality'=>optionalString($payload,'municipality',120),'state_name'=>optionalString($payload,'state_name',120)]);
    $id=(int)$pdo->lastInsertId(); writeAudit($pdo,(int)$user['id'],'CREATE','supplier_origin',$id,['origin_code'=>$code,'supplier_id'=>$supplier['id']]);
    return ['id'=>$id,'code'=>$code];
}

function createWarehouse(PDO $pdo, array $user, array $payload): array
{
    requireArea($pdo,$user,['ALMACEN']);
    $types=['RAW_MATERIAL','PACKAGING','SPARE_PARTS','PROCESS','FINISHED_GOODS','QUARANTINE','REJECTED','RETURNS'];
    $type=requiredString($payload,'warehouse_type','el tipo de almacén',30); if(!in_array($type,$types,true))failRequest('El tipo de almacén no es válido.',422);
    $module=['RAW_MATERIAL'=>'WAREHOUSE_RAW','PACKAGING'=>'WAREHOUSE_PACKAGING','SPARE_PARTS'=>'WAREHOUSE_SPARES','FINISHED_GOODS'=>'WAREHOUSE_FINISHED'][$type]??'CATALOGS';
    requireAnyPermissionV14($pdo,(int)$user['id'],[$module,'CATALOGS'],'CREATE');
    $code=masterCode($payload,'warehouse_code','el código de almacén',30);
    if(safeScalar($pdo,"SELECT COUNT(*) FROM warehouses WHERE code=:code",['code'=>$code])>0)failRequest('El código de almacén ya existe.',409);
    $areaId=(int)$user['primary_area_id'];$areaCode=trim((string)($payload['area_code']??''));if(isSuperAdmin($pdo,(int)$user['id'])&&$areaCode!==''){$area=findOne($pdo,"SELECT id FROM areas WHERE code=:code AND is_active=1",['code'=>strtoupper($areaCode)],'El área no existe.');$areaId=(int)$area['id'];}
    $pdo->prepare("INSERT INTO warehouses (code,name,warehouse_type,area_id) VALUES (:code,:name,:type,:area)")->execute(['code'=>$code,'name'=>requiredString($payload,'warehouse_name','el nombre del almacén',120),'type'=>$type,'area'=>$areaId]);
    $id=(int)$pdo->lastInsertId();writeAudit($pdo,(int)$user['id'],'CREATE','warehouse',$id,['code'=>$code,'type'=>$type]);return ['id'=>$id,'code'=>$code];
}

function createWarehouseLocation(PDO $pdo, array $user, array $payload): array
{
    requireArea($pdo,$user,['ALMACEN']);
    $warehouse=findOne($pdo,"SELECT id,warehouse_type FROM warehouses WHERE code=:code AND is_active=1",['code'=>masterCode($payload,'warehouse_code','el almacén',30)],'El almacén no existe.');
    $module=['RAW_MATERIAL'=>'WAREHOUSE_RAW','PACKAGING'=>'WAREHOUSE_PACKAGING','SPARE_PARTS'=>'WAREHOUSE_SPARES','FINISHED_GOODS'=>'WAREHOUSE_FINISHED'][$warehouse['warehouse_type']]??'INVENTORY';
    requireAnyPermissionV14($pdo,(int)$user['id'],[$module,'INVENTORY'],'CREATE');
    $code=masterCode($payload,'location_code','el código de ubicación',50);$types=['RECEIVING','QUALITY_HOLD','STORAGE','PICKING','PRODUCTION','SHIPPING','REJECTED','RETURNS'];$type=requiredString($payload,'location_type','el tipo de ubicación',30);if(!in_array($type,$types,true))failRequest('El tipo de ubicación no es válido.',422);
    if(safeScalar($pdo,"SELECT COUNT(*) FROM warehouse_locations WHERE warehouse_id=:warehouse AND code=:code",['warehouse'=>$warehouse['id'],'code'=>$code])>0)failRequest('La ubicación ya existe en ese almacén.',409);
    $blocked=(string)($payload['is_blocked']??'0')==='1'?1:0;
    $pdo->prepare("INSERT INTO warehouse_locations (warehouse_id,code,name,location_type,is_blocked) VALUES (:warehouse,:code,:name,:type,:blocked)")->execute(['warehouse'=>$warehouse['id'],'code'=>$code,'name'=>requiredString($payload,'location_name','el nombre de ubicación',120),'type'=>$type,'blocked'=>$blocked]);
    $id=(int)$pdo->lastInsertId();writeAudit($pdo,(int)$user['id'],'CREATE','warehouse_location',$id,['warehouse_id'=>$warehouse['id'],'code'=>$code]);return ['id'=>$id,'code'=>$code];
}

function createItem(PDO $pdo, array $user, array $payload): array
{
    requireArea($pdo,$user,['ALMACEN']);
    requirePermission($pdo,(int)$user['id'],'CATALOGS','CREATE');
    $sku=masterCode($payload,'sku','el SKU',80);if(safeScalar($pdo,"SELECT COUNT(*) FROM items WHERE sku=:sku",['sku'=>$sku])>0)failRequest('El SKU ya existe.',409);
    $category=findOne($pdo,"SELECT id FROM item_categories WHERE code=:code AND is_active=1",['code'=>masterCode($payload,'category_code','la categoría',40)],'La categoría no existe.');
    $uom=findOne($pdo,"SELECT id FROM units_of_measure WHERE code=:code",['code'=>masterCode($payload,'uom_code','la unidad',20)],'La unidad no existe.');
    $types=['RAW_FRUIT','RAW_OTHER','PACKAGING','SPARE_PART','CONSUMABLE','BULK_OIL','FINISHED_GOOD','SERVICE'];$type=requiredString($payload,'item_type','el tipo de artículo',30);if(!in_array($type,$types,true))failRequest('El tipo de artículo no es válido.',422);
    $reorder=filter_var($payload['reorder_point']??0,FILTER_VALIDATE_FLOAT);if($reorder===false||$reorder<0)failRequest('El punto de reorden no es válido.',422);
    $pdo->prepare("INSERT INTO items (category_id,base_uom_id,sku,name,item_type,lot_controlled,quality_required,reorder_point,created_by) VALUES (:category,:uom,:sku,:name,:type,:lot_controlled,:quality_required,:reorder,:user)")->execute(['category'=>$category['id'],'uom'=>$uom['id'],'sku'=>$sku,'name'=>requiredString($payload,'item_name','el nombre del artículo',190),'type'=>$type,'lot_controlled'=>(string)($payload['lot_controlled']??'1')==='1'?1:0,'quality_required'=>(string)($payload['quality_required']??'0')==='1'?1:0,'reorder'=>$reorder,'user'=>$user['id']]);
    $id=(int)$pdo->lastInsertId();writeAudit($pdo,(int)$user['id'],'CREATE','item',$id,['sku'=>$sku,'type'=>$type]);return ['id'=>$id,'code'=>$sku];
}

function createCustomer(PDO $pdo, array $user, array $payload): array
{
    requireArea($pdo,$user,['VENTAS']);
    requirePermission($pdo,(int)$user['id'],'SALES','CREATE');
    $code=masterCode($payload,'customer_code','el código de cliente',40);if(safeScalar($pdo,"SELECT COUNT(*) FROM customers WHERE customer_code=:code",['code'=>$code])>0)failRequest('El código de cliente ya existe.',409);
    $email=trim((string)($payload['contact_email']??''));if($email!==''&&!filter_var($email,FILTER_VALIDATE_EMAIL))failRequest('El correo de contacto no es válido.',422);
    $pdo->prepare("INSERT INTO customers (customer_code,legal_name,trade_name,contact_email) VALUES (:code,:legal_name,:trade_name,:email)")->execute(['code'=>$code,'legal_name'=>requiredString($payload,'legal_name','la razón social',190),'trade_name'=>optionalString($payload,'trade_name',190),'email'=>$email?:null]);
    $id=(int)$pdo->lastInsertId();writeAudit($pdo,(int)$user['id'],'CREATE','customer',$id,['customer_code'=>$code]);return ['id'=>$id,'code'=>$code];
}

function masterCode(array $payload, string $key, string $label, int $maxLength): string
{
    $code=strtoupper(requiredString($payload,$key,$label,$maxLength));
    if(!preg_match('/^[A-Z0-9][A-Z0-9._-]*$/',$code))failRequest("{$label} solo puede contener letras, números, punto, guion y guion bajo.",422);
    return $code;
}

function optionalString(array $payload, string $key, int $maxLength): ?string
{
    $value=trim((string)($payload[$key]??''));return $value===''?null:mb_substr($value,0,$maxLength);
}
