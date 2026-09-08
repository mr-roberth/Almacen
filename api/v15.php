<?php
declare(strict_types=1);

function buildV15Lookups(PDO $pdo, array $user, bool $isAdmin): array
{
    $userId=(int)$user['id'];
    $canPurchase=$isAdmin||hasAnyPermissionV14($pdo,$userId,['PURCHASING','APPOINTMENTS'],'VIEW');
    $canLogistics=$isAdmin||userHasPermission($pdo,$userId,'LOGISTICS','VIEW');
    $canDriver=$isAdmin||userHasPermission($pdo,$userId,'DRIVER_COLLECTIONS','VIEW');
    return [
        'rawItems'=>$canPurchase||$canLogistics?safeRows($pdo,"SELECT i.id,i.sku,i.name,i.item_type,i.base_uom_id,u.code AS uom_code,u.name AS uom_name FROM items i INNER JOIN units_of_measure u ON u.id=i.base_uom_id WHERE i.is_active=1 AND i.item_type IN ('RAW_FRUIT','RAW_OTHER','BULK_OIL') AND i.sku NOT LIKE 'EJ-%' ORDER BY FIELD(i.item_type,'RAW_FRUIT','BULK_OIL','RAW_OTHER'),i.name"):[],
        'rawWarehouses'=>$canPurchase?safeRows($pdo,"SELECT id,code,name,warehouse_type FROM warehouses WHERE is_active=1 AND warehouse_type='RAW_MATERIAL' AND code NOT LIKE 'EJ-%' ORDER BY name"):[],
        'deliveryItems'=>$canPurchase?safeRows($pdo,"SELECT i.id,i.sku,i.name,i.item_type,i.base_uom_id,u.code AS uom_code,u.name AS uom_name FROM items i INNER JOIN units_of_measure u ON u.id=i.base_uom_id WHERE i.is_active=1 AND i.item_type IN ('PACKAGING','SPARE_PART') AND i.sku NOT LIKE 'EJ-%' ORDER BY FIELD(i.item_type,'PACKAGING','SPARE_PART'),i.name"):[],
        'deliveryWarehouses'=>$canPurchase?safeRows($pdo,"SELECT id,code,name,warehouse_type FROM warehouses WHERE is_active=1 AND warehouse_type IN ('PACKAGING','SPARE_PARTS') AND code NOT LIKE 'EJ-%' ORDER BY FIELD(warehouse_type,'PACKAGING','SPARE_PARTS'),name"):[],
        'logisticsPlans'=>$canLogistics?safeRows($pdo,"SELECT cp.id,cp.plan_number,a.appointment_number,COALESCE(s.trade_name,s.legal_name) AS supplier,o.origin_name,i.name AS item,i.item_type,al.expected_qty,u.code AS uom_code,DATE_FORMAT(a.scheduled_start,'%Y-%m-%dT%H:%i') AS appointment_at,cp.driver_user_id,cp.vehicle_id,cp.bin_count,cp.transport_presentation,cp.appointment_time_mode,DATE_FORMAT(cp.pickup_scheduled_at,'%Y-%m-%dT%H:%i') AS pickup_at,DATE_FORMAT(cp.planned_arrival,'%Y-%m-%dT%H:%i') AS plant_eta,cp.logistics_notes,cp.status FROM collection_plans cp INNER JOIN inbound_appointments a ON a.collection_plan_id=cp.id INNER JOIN suppliers s ON s.id=cp.supplier_id INNER JOIN supplier_origins o ON o.id=cp.origin_id INNER JOIN inbound_appointment_lines al ON al.appointment_id=a.id INNER JOIN items i ON i.id=al.item_id INNER JOIN units_of_measure u ON u.id=al.uom_id WHERE cp.status NOT IN ('COMPLETED','CANCELLED') ORDER BY a.scheduled_start"):[],
        'vehicles'=>$canLogistics||$canDriver?safeRows($pdo,"SELECT v.id,v.unit_code,v.plate_number,v.vehicle_type,v.carrier_name,v.make_model,v.capacity_kg,v.default_driver_user_id,v.notes FROM vehicles v WHERE v.is_active=1 AND v.unit_code NOT LIKE 'EJ-%' ORDER BY v.unit_code"):[],
        'drivers'=>$canLogistics?safeRows($pdo,"SELECT DISTINCT u.id,u.display_name AS name,u.email,u.phone_number AS phone FROM app_users u INNER JOIN areas a ON a.id=u.primary_area_id INNER JOIN user_roles ur ON ur.user_id=u.id AND ur.is_active=1 INNER JOIN roles r ON r.id=ur.role_id AND r.is_active=1 WHERE u.status='ACTIVE' AND a.code='LOGISTICA' AND r.code='DRIVER' ORDER BY u.display_name"):[],
        'logisticsSites'=>$canLogistics||$canDriver?safeRows($pdo,"SELECT id,site_code,site_name,address_text,latitude,longitude,is_default FROM logistics_sites WHERE is_active=1 ORDER BY is_default DESC,site_name"):[],
    ];
}

function buildV15Bootstrap(PDO $pdo, array $user, bool $isAdmin): array
{
    $userId=(int)$user['id'];
    $canPurchase=$isAdmin||hasAnyPermissionV14($pdo,$userId,['PURCHASING','APPOINTMENTS'],'VIEW');
    $canLogistics=$isAdmin||userHasPermission($pdo,$userId,'LOGISTICS','VIEW');
    $canDriver=$isAdmin||userHasPermission($pdo,$userId,'DRIVER_COLLECTIONS','VIEW');
    $canPlan=$isAdmin||hasAnyPermissionV14($pdo,$userId,['FORECAST','MRP','PRODUCTION','FILLING','WAREHOUSE_FINISHED'],'VIEW');
    $rows=($canPurchase||$canLogistics||$canDriver)?collectionRowsV15($pdo,$canDriver&&!$canPurchase&&!$canLogistics?$userId:null):[];
    return [
        'collections'=>$canPurchase||$canLogistics?$rows:[],
        'driverCollections'=>$canDriver?($canPurchase||$canLogistics?array_values(array_filter($rows,static fn(array $row): bool=>(int)($row['driverUserId']??0)===$userId)): $rows):[],
        'logisticsSite'=>($canLogistics||$canDriver)?(safeRows($pdo,"SELECT id,site_code AS siteCode,site_name AS siteName,address_text AS address,latitude,longitude FROM logistics_sites WHERE is_active=1 ORDER BY is_default DESC,id LIMIT 1")[0]??null):null,
        'forecastVsProduction'=>$canPlan?safeRows($pdo,"SELECT DATE_FORMAT(f.period_start,'%Y-%m') AS period,i.sku,i.name AS item,SUM(f.forecast_qty) AS forecastQty,COALESCE(o.plannedQty,0) AS orderedQty,COALESCE(o.completedQty,0) AS completedQty,GREATEST(SUM(f.forecast_qty)-COALESCE(o.plannedQty,0),0) AS pendingToOrder,ROUND(COALESCE(o.plannedQty,0)/NULLIF(SUM(f.forecast_qty),0)*100,1) AS orderCoverage FROM forecast_versions v INNER JOIN forecast_lines f ON f.forecast_version_id=v.id INNER JOIN items i ON i.id=f.finished_item_id LEFT JOIN (SELECT finished_item_id,DATE_FORMAT(planned_start,'%Y-%m-01') AS periodStart,SUM(planned_qty) AS plannedQty,SUM(completed_qty) AS completedQty FROM production_orders WHERE status<>'CANCELLED' GROUP BY finished_item_id,DATE_FORMAT(planned_start,'%Y-%m-01')) o ON o.finished_item_id=f.finished_item_id AND o.periodStart=f.period_start WHERE v.is_current=1 GROUP BY f.period_start,i.id,i.sku,i.name,o.plannedQty,o.completedQty ORDER BY f.period_start,i.name LIMIT 2000"):[],
    ];
}

function collectionRowsV15(PDO $pdo, ?int $driverUserId=null): array
{
    $where=$driverUserId===null?'':' AND cp.driver_user_id=:driver';
    $params=$driverUserId===null?[]:['driver'=>$driverUserId];
    return safeRows($pdo,"SELECT cp.id,cp.plan_number AS planNumber,a.appointment_number AS appointment,COALESCE(p.prelot_code,'Pendiente') AS prelot,WEEK(a.scheduled_start,3) AS weekNumber,DATE_FORMAT(a.created_at,'%d/%m/%Y') AS requestDate,COALESCE(s.trade_name,s.legal_name) AS supplier,s.contact_phone AS supplierPhone,o.origin_name AS origin,COALESCE(o.address_text,s.address_text,CONCAT_WS(', ',o.municipality,o.state_name)) AS originAddress,o.latitude AS originLatitude,o.longitude AS originLongitude,DATE_FORMAT(a.scheduled_start,'%d/%m/%Y · %H:%i') AS appointmentAt,DATE_FORMAT(a.scheduled_start,'%Y-%m-%dT%H:%i') AS appointmentIso,i.name AS item,i.sku,i.item_type AS itemType,al.expected_qty AS expectedQty,u.code AS uom,cp.purchase_order_reference AS purchaseOrder,cp.transport_presentation AS presentation,cp.purchase_notes AS purchaseNotes,cp.logistics_notes AS logisticsNotes,cp.bin_count AS binCount,cp.vehicle_id AS vehicleId,COALESCE(v.unit_code,'Sin unidad') AS vehicle,COALESCE(v.plate_number,'') AS plate,cp.driver_user_id AS driverUserId,COALESCE(d.display_name,'Sin conductor') AS driver,DATE_FORMAT(cp.pickup_scheduled_at,'%d/%m/%Y · %H:%i') AS pickupAt,DATE_FORMAT(cp.planned_arrival,'%d/%m/%Y · %H:%i') AS plantEta,DATE_FORMAT(cp.loaded_at,'%d/%m/%Y · %H:%i') AS loadedAt,DATE_FORMAT(cp.route_started_at,'%d/%m/%Y · %H:%i') AS routeStartedAt,DATE_FORMAT(cp.actual_arrival_at,'%d/%m/%Y · %H:%i') AS actualArrivalAt,cp.last_latitude AS lastLatitude,cp.last_longitude AS lastLongitude,cp.last_location_accuracy_m AS lastAccuracy,DATE_FORMAT(cp.last_location_at,'%d/%m/%Y · %H:%i') AS lastLocationAt,cp.route_distance_km AS routeDistanceKm,cp.route_duration_minutes AS routeDurationMinutes,cp.status,GREATEST(DATEDIFF(COALESCE(DATE(cp.loaded_at),UTC_DATE()),DATE(a.created_at)),0) AS waitDays FROM collection_plans cp INNER JOIN inbound_appointments a ON a.collection_plan_id=cp.id INNER JOIN suppliers s ON s.id=cp.supplier_id INNER JOIN supplier_origins o ON o.id=cp.origin_id INNER JOIN inbound_appointment_lines al ON al.appointment_id=a.id INNER JOIN items i ON i.id=al.item_id INNER JOIN units_of_measure u ON u.id=al.uom_id LEFT JOIN pre_lots p ON p.appointment_id=a.id AND p.status<>'CANCELLED' LEFT JOIN vehicles v ON v.id=cp.vehicle_id LEFT JOIN app_users d ON d.id=cp.driver_user_id WHERE a.delivery_type='COLLECTION'{$where} ORDER BY a.scheduled_start DESC,cp.id DESC LIMIT 1000",$params);
}

function createRawCollectionV15(PDO $pdo, array $user, array $payload, array $config): array
{
    requireArea($pdo,$user,['COMPRAS']);
    requireAnyPermissionV14($pdo,(int)$user['id'],['PURCHASING','APPOINTMENTS'],'CREATE');
    $supplier=findOne($pdo,"SELECT id,short_code FROM suppliers WHERE id=:supplier AND is_active=1",['supplier'=>(int)($payload['supplier_id']??0)],'Selecciona un proveedor válido.');
    $origin=findOne($pdo,"SELECT id,origin_code FROM supplier_origins WHERE id=:origin AND supplier_id=:supplier AND is_active=1",['origin'=>(int)($payload['origin_id']??0),'supplier'=>$supplier['id']],'Selecciona un origen válido de ese proveedor.');
    $item=findOne($pdo,"SELECT i.id,i.name,i.item_type,i.base_uom_id,u.code AS uom_code FROM items i INNER JOIN units_of_measure u ON u.id=i.base_uom_id WHERE i.id=:item AND i.is_active=1 AND i.item_type IN ('RAW_FRUIT','RAW_OTHER','BULK_OIL')",['item'=>(int)($payload['item_id']??0)],'Compras solo puede programar aguacate, aceite crudo, aceite refinado u otra materia prima autorizada.');
    if($item['item_type']==='RAW_FRUIT'&&$item['uom_code']!=='KG')failRequest('El aguacate en fruta debe estar configurado en kilogramos.',422);
    if(in_array($item['item_type'],['RAW_OTHER','BULK_OIL'],true)&&!in_array($item['uom_code'],['KG','L'],true))failRequest('El aceite y las demás materias primas deben estar configurados en kilogramos o litros.',422);
    $warehouse=findOne($pdo,"SELECT id FROM warehouses WHERE id=:warehouse AND warehouse_type='RAW_MATERIAL' AND is_active=1",['warehouse'=>(int)($payload['warehouse_id']??0)],'La materia prima solo puede llegar al Almacén de materia prima.');
    $qty=positiveNumber($payload,'expected_qty','La cantidad total a recolectar');
    if($qty>999999999999.999999)failRequest('La cantidad excede la capacidad del sistema.',422);
    try{$start=new DateTimeImmutable(requiredString($payload,'scheduled_at','la fecha y hora de la cita'),new DateTimeZone('America/Mexico_City'));}catch(Throwable){failRequest('La fecha y hora de la cita no son válidas.',422);}
    $duration=max(15,min(480,(int)($payload['duration']??60)));$end=$start->modify("+{$duration} minutes");
    $presentation=strtoupper(requiredString($payload,'transport_presentation','la presentación de transporte',20));
    $allowedPresentation=$item['item_type']==='RAW_FRUIT'?['BINS','OTHER']:['TANKER','IBC','OTHER'];
    if(!in_array($presentation,$allowedPresentation,true))failRequest('La presentación no corresponde al tipo de materia prima.',422);
    $notes=optionalString($payload,'notes',1000);$purchaseOrder=optionalString($payload,'purchase_order_reference',80);
    $utcStart=$start->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');$utcEnd=$end->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    $pdo->beginTransaction();
    try{
        $pdo->prepare("INSERT INTO collection_plans (plan_number,supplier_id,origin_id,planned_departure,planned_arrival,expected_weight_kg,status,purchase_notes,created_by,transport_presentation,purchase_order_reference,appointment_time_mode,pickup_scheduled_at) VALUES (:number,:supplier,:origin,:departure,:arrival,:weight,'PLANNED',:notes,:user,:presentation,:purchase_order,'ON_APPOINTMENT',:pickup)")->execute(['number'=>provisionalNumber('RCL'),'supplier'=>$supplier['id'],'origin'=>$origin['id'],'departure'=>$utcStart,'arrival'=>$utcStart,'weight'=>$item['uom_code']==='KG'?$qty:null,'notes'=>$notes,'user'=>$user['id'],'presentation'=>$presentation,'purchase_order'=>$purchaseOrder,'pickup'=>$utcStart]);
        $planId=(int)$pdo->lastInsertId();$planNumber=finalNumber('RCL',$planId);$pdo->prepare("UPDATE collection_plans SET plan_number=:number WHERE id=:id")->execute(['number'=>$planNumber,'id'=>$planId]);
        $expectedType=$item['item_type']==='RAW_FRUIT'?'RAW_FRUIT':'RAW_OTHER';
        $pdo->prepare("INSERT INTO inbound_appointments (appointment_number,supplier_id,origin_id,collection_plan_id,delivery_type,scheduled_start,scheduled_end,expected_item_type,expected_weight_kg,status,notes,created_by) VALUES (:number,:supplier,:origin,:plan,'COLLECTION',:start,:end,:item_type,:weight,'PLANNED',:notes,:user)")->execute(['number'=>provisionalNumber('CIT'),'supplier'=>$supplier['id'],'origin'=>$origin['id'],'plan'=>$planId,'start'=>$utcStart,'end'=>$utcEnd,'item_type'=>$expectedType,'weight'=>$item['uom_code']==='KG'?$qty:null,'notes'=>$notes,'user'=>$user['id']]);
        $appointmentId=(int)$pdo->lastInsertId();$appointmentNumber=finalNumber('CIT',$appointmentId);$pdo->prepare("UPDATE inbound_appointments SET appointment_number=:number WHERE id=:id")->execute(['number'=>$appointmentNumber,'id'=>$appointmentId]);
        $pdo->prepare("INSERT INTO inbound_appointment_lines (appointment_id,line_no,item_id,destination_warehouse_id,uom_id,expected_qty,notes) VALUES (:appointment,1,:item,:warehouse,:uom,:qty,:notes)")->execute(['appointment'=>$appointmentId,'item'=>$item['id'],'warehouse'=>$warehouse['id'],'uom'=>$item['base_uom_id'],'qty'=>$qty,'notes'=>$notes]);
        $prelot=reservePrelotV14($pdo,['supplier_id'=>$supplier['id'],'origin_id'=>$origin['id'],'short_code'=>$supplier['short_code'],'origin_code'=>$origin['origin_code'],'item_type'=>$item['item_type'],'expected_qty'=>$qty],$appointmentId,$start->format('Y-m-d'),(int)$user['id']);
        if($item['uom_code']==='KG')$pdo->prepare("UPDATE pre_lots SET expected_weight_kg=:qty WHERE id=:id")->execute(['qty'=>$qty,'id'=>$prelot['id']]);
        writeAudit($pdo,(int)$user['id'],'CREATE','collection_plan',$planId,['plan_number'=>$planNumber,'appointment_number'=>$appointmentNumber,'prelot'=>$prelot['code'],'item'=>$item['name'],'quantity'=>$qty,'uom'=>$item['uom_code']]);
        $pdo->commit();
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
    $recipients=roleRecipientsV15($pdo,['LOGISTICS_COORDINATOR','AREA_MANAGER','AREA_ADMIN'],'LOGISTICA');
    createAlertV15($pdo,'LOGISTICA',$recipients,'COLLECTION_PLANNED','INFO','Nueva recolección por asignar',"{$planNumber}: {$item['name']}, {$qty} {$item['uom_code']}. Asigna unidad, conductor y horario.",'collection_plan',$planId,'COLLECTION_PLANNED_'.$planId);
    queueNotifications($pdo,$config,'COLLECTION_PLANNED','collection_plan',$planId,$recipients,"Nueva recolección {$planNumber}","Compras programó {$planNumber}. Material: {$item['name']}. Cantidad: {$qty} {$item['uom_code']}. Cita: ".$start->format('d/m/Y H:i').'. Ingresa a Oleolab Almacenes para asignar unidad y conductor.');
    notifyWarehouseWidV15($pdo,$config,$appointmentId,$appointmentNumber,$prelot['code'],$item['name'],$qty,$item['uom_code']);
    return ['id'=>$planId,'number'=>$planNumber,'appointment'=>$appointmentNumber,'prelot'=>$prelot['code'],'wid'=>'Esperado en WID'];
}

function createMaterialDeliveryV15(PDO $pdo,array $user,array $payload,array $config): array
{
    requireArea($pdo,$user,['COMPRAS']);requireAnyPermissionV14($pdo,(int)$user['id'],['PURCHASING','APPOINTMENTS'],'CREATE');
    $supplier=findOne($pdo,"SELECT id,short_code FROM suppliers WHERE id=:supplier AND is_active=1",['supplier'=>(int)($payload['supplier_id']??0)],'Selecciona un proveedor válido.');
    $origin=findOne($pdo,"SELECT id,origin_code FROM supplier_origins WHERE id=:origin AND supplier_id=:supplier AND is_active=1",['origin'=>(int)($payload['origin_id']??0),'supplier'=>$supplier['id']],'Selecciona un origen válido de ese proveedor.');
    $item=findOne($pdo,"SELECT i.id,i.name,i.item_type,i.base_uom_id,u.code AS uom_code,u.decimal_places FROM items i INNER JOIN units_of_measure u ON u.id=i.base_uom_id WHERE i.id=:item AND i.is_active=1 AND i.item_type IN ('PACKAGING','SPARE_PART')",['item'=>(int)($payload['item_id']??0)],'Selecciona un material de empaque o una refacción del catálogo correspondiente.');
    $expectedWarehouse=['PACKAGING'=>'PACKAGING','SPARE_PART'=>'SPARE_PARTS'][$item['item_type']];
    $warehouse=findOne($pdo,"SELECT id FROM warehouses WHERE id=:warehouse AND warehouse_type=:type AND is_active=1",['warehouse'=>(int)($payload['warehouse_id']??0),'type'=>$expectedWarehouse],'El almacén destino no corresponde al material seleccionado.');
    $qty=positiveNumber($payload,'expected_qty','La cantidad esperada');if($qty>999999999999.999999)failRequest('La cantidad excede la capacidad del sistema.',422);if((int)$item['decimal_places']===0&&abs($qty-round($qty))>0.000001)failRequest('La unidad '.$item['uom_code'].' sólo acepta cantidades enteras.',422);
    try{$start=new DateTimeImmutable(requiredString($payload,'scheduled_at','la fecha y hora de entrega'),new DateTimeZone('America/Mexico_City'));}catch(Throwable){failRequest('La fecha y hora de entrega no son válidas.',422);}$duration=max(15,min(480,(int)($payload['duration']??60)));$end=$start->modify("+{$duration} minutes");$notes=optionalString($payload,'notes',1000);$utcStart=$start->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');$utcEnd=$end->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    $pdo->beginTransaction();
    try{$pdo->prepare("INSERT INTO inbound_appointments (appointment_number,supplier_id,origin_id,delivery_type,scheduled_start,scheduled_end,expected_item_type,status,notes,created_by) VALUES (:number,:supplier,:origin,'SUPPLIER_DELIVERY',:start,:end,:item_type,'PLANNED',:notes,:user)")->execute(['number'=>provisionalNumber('CIT'),'supplier'=>$supplier['id'],'origin'=>$origin['id'],'start'=>$utcStart,'end'=>$utcEnd,'item_type'=>$item['item_type'],'notes'=>$notes,'user'=>$user['id']]);$appointmentId=(int)$pdo->lastInsertId();$appointmentNumber=finalNumber('CIT',$appointmentId);$pdo->prepare("UPDATE inbound_appointments SET appointment_number=:number WHERE id=:id")->execute(['number'=>$appointmentNumber,'id'=>$appointmentId]);$pdo->prepare("INSERT INTO inbound_appointment_lines (appointment_id,line_no,item_id,destination_warehouse_id,uom_id,expected_qty,notes) VALUES (:appointment,1,:item,:warehouse,:uom,:qty,:notes)")->execute(['appointment'=>$appointmentId,'item'=>$item['id'],'warehouse'=>$warehouse['id'],'uom'=>$item['base_uom_id'],'qty'=>$qty,'notes'=>$notes]);$prelot=reservePrelotV14($pdo,['supplier_id'=>$supplier['id'],'origin_id'=>$origin['id'],'short_code'=>$supplier['short_code'],'origin_code'=>$origin['origin_code'],'item_type'=>$item['item_type'],'expected_qty'=>$qty],$appointmentId,$start->format('Y-m-d'),(int)$user['id']);writeAudit($pdo,(int)$user['id'],'CREATE','inbound_appointment',$appointmentId,['appointment_number'=>$appointmentNumber,'prelot'=>$prelot['code'],'item'=>$item['name'],'quantity'=>$qty,'uom'=>$item['uom_code'],'wid_status'=>'EXPECTED']);$pdo->commit();}catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
    notifyWarehouseWidV15($pdo,$config,$appointmentId,$appointmentNumber,$prelot['code'],$item['name'],$qty,$item['uom_code']);return ['id'=>$appointmentId,'number'=>$appointmentNumber,'prelot'=>$prelot['code'],'wid'=>'Esperado en WID'];
}

function createReceiptAndNotifyV15(PDO $pdo,array $user,array $payload,array $config): array
{
    $result=createReceiptV14($pdo,$user,$payload);$receipt=findOne($pdo,"SELECT r.appointment_id,a.collection_plan_id FROM goods_receipts r INNER JOIN inbound_appointments a ON a.id=r.appointment_id WHERE r.id=:id",['id'=>$result['id']],'No se pudo localizar la recepción creada.');if(!empty($receipt['collection_plan_id']))$pdo->prepare("UPDATE collection_plans SET status='COMPLETED',actual_arrival_at=COALESCE(actual_arrival_at,UTC_TIMESTAMP(6)) WHERE id=:id AND status<>'CANCELLED'")->execute(['id'=>$receipt['collection_plan_id']]);$qualityId=(int)safeScalar($pdo,"SELECT id FROM quality_requests WHERE request_number=:number",['number'=>$result['qualityRequest']]);$recipients=roleRecipientsV15($pdo,['AREA_ADMIN','AREA_MANAGER','APPROVER'],'CALIDAD');createAlertV15($pdo,'CALIDAD',$recipients,'QUALITY_REQUESTED','WARNING','Nueva solicitud de análisis',"{$result['qualityRequest']}: recepción {$result['number']}, lote {$result['lot']}.",'quality_request',$qualityId,'QUALITY_REQUESTED_RECEIPT_'.$result['id']);queueNotifications($pdo,$config,'QUALITY_REQUESTED','goods_receipt',(int)$result['id'],$recipients,"Nueva solicitud de Calidad {$result['qualityRequest']}","Almacén confirmó la recepción {$result['number']}. Lote: {$result['lot']}. La existencia permanece bloqueada hasta registrar el dictamen en Oleolab Almacenes.");return $result;
}

function notifyWarehouseWidV15(PDO $pdo,array $config,int $appointmentId,string $appointmentNumber,string $prelot,string $item,float $qty,string $uom): void
{
    $recipients=roleRecipientsV15($pdo,['AREA_ADMIN','AREA_MANAGER'],'ALMACEN');$message="{$appointmentNumber} · prefolio {$prelot}: {$item}, {$qty} {$uom}. Todavía no afecta existencias; debe confirmarse al llegar.";createAlertV15($pdo,'ALMACEN',$recipients,'WID_CREATED','INFO','Nueva entrada esperada en WID',$message,'inbound_appointment',$appointmentId,'WID_CREATED_'.$appointmentId);queueNotifications($pdo,$config,'WID_CREATED','inbound_appointment',$appointmentId,$recipients,"Entrada WID {$appointmentNumber}",$message.' Ingresa a la aplicación para confirmar la recepción cuando llegue.');
}

function createVehicleV15(PDO $pdo,array $user,array $payload): array
{
    requireArea($pdo,$user,['LOGISTICA']);requirePermission($pdo,(int)$user['id'],'LOGISTICS','CREATE');
    $code=masterCode($payload,'unit_code','el código de unidad',40);$plate=strtoupper(trim((string)($payload['plate_number']??'')));
    if(safeScalar($pdo,"SELECT COUNT(*) FROM vehicles WHERE unit_code=:code OR (:plate<>'' AND plate_number=:plate_same)",['code'=>$code,'plate'=>$plate,'plate_same'=>$plate])>0)failRequest('El código de unidad o las placas ya existen.',409);
    $driverId=(int)($payload['default_driver_user_id']??0)?:null;if($driverId!==null)validateDriverV15($pdo,$driverId);
    $capacity=trim((string)($payload['capacity_kg']??''));$capacity=$capacity===''?null:positiveNumber($payload,'capacity_kg','La capacidad');
    $pdo->prepare("INSERT INTO vehicles (unit_code,plate_number,vehicle_type,carrier_name,make_model,capacity_kg,default_driver_user_id,notes,is_active) VALUES (:code,:plate,:type,:carrier,:model,:capacity,:driver,:notes,1)")->execute(['code'=>$code,'plate'=>$plate?:null,'type'=>requiredString($payload,'vehicle_type','el tipo de unidad',40),'carrier'=>optionalString($payload,'carrier_name',160),'model'=>optionalString($payload,'make_model',160),'capacity'=>$capacity,'driver'=>$driverId,'notes'=>optionalString($payload,'notes',1000)]);
    $id=(int)$pdo->lastInsertId();writeAudit($pdo,(int)$user['id'],'CREATE','vehicle',$id,['unit_code'=>$code,'plate'=>$plate]);return ['id'=>$id,'number'=>$code];
}

function saveLogisticsSiteV15(PDO $pdo,array $user,array $payload): array
{
    requireArea($pdo,$user,['LOGISTICA']);requirePermission($pdo,(int)$user['id'],'LOGISTICS','UPDATE');
    $latitude=numericRangeV15($payload,'latitude',-90,90,'La latitud');$longitude=numericRangeV15($payload,'longitude',-180,180,'La longitud');
    $pdo->beginTransaction();
    try{
        $pdo->prepare("UPDATE logistics_sites SET is_default=0 WHERE is_default=1")->execute();
        $pdo->prepare("INSERT INTO logistics_sites (site_code,site_name,address_text,latitude,longitude,is_default,is_active,updated_by) VALUES ('OLEOLAB-PLANTA',:name,:address,:latitude,:longitude,1,1,:user) ON DUPLICATE KEY UPDATE site_name=VALUES(site_name),address_text=VALUES(address_text),latitude=VALUES(latitude),longitude=VALUES(longitude),is_default=1,is_active=1,updated_by=VALUES(updated_by)")->execute(['name'=>requiredString($payload,'site_name','el nombre de la planta',160),'address'=>requiredString($payload,'address_text','la dirección de la planta',500),'latitude'=>$latitude,'longitude'=>$longitude,'user'=>$user['id']]);
        $siteId=(int)safeScalar($pdo,"SELECT id FROM logistics_sites WHERE site_code='OLEOLAB-PLANTA'");writeAudit($pdo,(int)$user['id'],'UPDATE','logistics_site',$siteId,['latitude'=>$latitude,'longitude'=>$longitude]);$pdo->commit();return ['id'=>$siteId,'number'=>'OLEOLAB-PLANTA'];
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

function assignCollectionV15(PDO $pdo,array $user,array $payload,array $config): array
{
    requireArea($pdo,$user,['LOGISTICA']);requirePermission($pdo,(int)$user['id'],'LOGISTICS','UPDATE');
    $plan=findOne($pdo,"SELECT cp.id,cp.plan_number,cp.status,a.id AS appointment_id,a.appointment_number,a.scheduled_start,i.name AS item,i.item_type,al.expected_qty,u.code AS uom_code,o.origin_name,COALESCE(o.address_text,s.address_text) AS origin_address FROM collection_plans cp INNER JOIN inbound_appointments a ON a.collection_plan_id=cp.id INNER JOIN inbound_appointment_lines al ON al.appointment_id=a.id INNER JOIN items i ON i.id=al.item_id INNER JOIN units_of_measure u ON u.id=al.uom_id INNER JOIN supplier_origins o ON o.id=cp.origin_id INNER JOIN suppliers s ON s.id=cp.supplier_id WHERE cp.id=:id AND cp.status NOT IN ('COMPLETED','CANCELLED')",['id'=>(int)($payload['collection_plan_id']??0)],'La recolección no existe o ya está cerrada.');
    $vehicle=findOne($pdo,"SELECT id,unit_code FROM vehicles WHERE id=:id AND is_active=1",['id'=>(int)($payload['vehicle_id']??0)],'Selecciona una unidad activa.');
    $driver=validateDriverV15($pdo,(int)($payload['driver_user_id']??0));$bins=(int)($payload['bin_count']??0);if($bins<0||$bins>1000||($plan['item_type']==='RAW_FRUIT'&&$bins<1))failRequest($plan['item_type']==='RAW_FRUIT'?'Indica cuántos contenedores llevará la unidad para recolectar fruta.':'El número de contenedores debe estar entre 0 y 1,000.',422);
    $presentation=strtoupper(requiredString($payload,'transport_presentation','la presentación',20));$presentations=$plan['item_type']==='RAW_FRUIT'?['BINS','OTHER']:['TANKER','IBC','OTHER'];if(!in_array($presentation,$presentations,true))failRequest('La presentación no corresponde a la materia prima.',422);
    $mode=strtoupper((string)($payload['appointment_time_mode']??'ON_APPOINTMENT'));if(!in_array($mode,['ON_APPOINTMENT','RESCHEDULED'],true))failRequest('Selecciona si se conservará o cambiará el horario.',422);
    try{$pickup=$mode==='ON_APPOINTMENT'?new DateTimeImmutable((string)$plan['scheduled_start'],new DateTimeZone('UTC')):new DateTimeImmutable(requiredString($payload,'pickup_scheduled_at','la nueva fecha de recolección'),new DateTimeZone('America/Mexico_City'));$etaText=trim((string)($payload['planned_arrival']??''));$arrival=$etaText!==''?new DateTimeImmutable($etaText,new DateTimeZone('America/Mexico_City')):$pickup;}catch(Throwable){failRequest('La programación de Logística no contiene fechas válidas.',422);}
    $pickupUtc=$pickup->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');$arrivalUtc=$arrival->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    $pdo->beginTransaction();
    try{$pdo->prepare("UPDATE collection_plans SET vehicle_id=:vehicle,driver_user_id=:driver,bin_count=:bins,transport_presentation=:presentation,appointment_time_mode=:mode,pickup_scheduled_at=:pickup,planned_departure=:pickup_departure,planned_arrival=:arrival,logistics_notes=:notes,status='CONFIRMED' WHERE id=:id")->execute(['vehicle'=>$vehicle['id'],'driver'=>$driver['id'],'bins'=>$bins,'presentation'=>$presentation,'mode'=>$mode,'pickup'=>$pickupUtc,'pickup_departure'=>$pickupUtc,'arrival'=>$arrivalUtc,'notes'=>optionalString($payload,'logistics_notes',1000),'id'=>$plan['id']]);$pdo->prepare("UPDATE inbound_appointments SET status='CONFIRMED' WHERE id=:id AND status IN ('PLANNED','SENT','CONFIRMED')")->execute(['id'=>$plan['appointment_id']]);writeAudit($pdo,(int)$user['id'],'UPDATE','collection_plan',$plan['id'],['unit'=>$vehicle['unit_code'],'driver'=>$driver['name'],'bins'=>$bins,'pickup'=>$pickupUtc,'arrival'=>$arrivalUtc]);$pdo->commit();}catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
    $recipients=[['id'=>(int)$driver['id'],'email'=>$driver['email'],'name'=>$driver['name']]];createAlertV15($pdo,'LOGISTICA',$recipients,'COLLECTION_ASSIGNED','INFO','Recolección asignada',"{$plan['plan_number']}: {$plan['item']}. Unidad {$vehicle['unit_code']}. Recolección {$pickup->setTimezone(new DateTimeZone('America/Mexico_City'))->format('d/m/Y H:i')}.",'collection_plan',(int)$plan['id'],'COLLECTION_ASSIGNED_'.$plan['id'].'_'.$driver['id']);queueNotifications($pdo,$config,'COLLECTION_ASSIGNED','collection_plan',(int)$plan['id'],$recipients,"Recolección asignada {$plan['plan_number']}","Se te asignó {$plan['plan_number']}. Origen: {$plan['origin_name']}. Dirección: ".($plan['origin_address']?:'consultar en la aplicación').". Material: {$plan['item']}. Cantidad: {$plan['expected_qty']} {$plan['uom_code']}. Unidad: {$vehicle['unit_code']}. Fecha: ".$pickup->setTimezone(new DateTimeZone('America/Mexico_City'))->format('d/m/Y H:i').'.');return ['id'=>(int)$plan['id'],'number'=>$plan['plan_number'],'driver'=>$driver['name']];
}

function updateDriverCollectionV15(PDO $pdo,array $user,array $payload,array $config): array
{
    requireArea($pdo,$user,['LOGISTICA']);requireAnyPermissionV14($pdo,(int)$user['id'],['DRIVER_COLLECTIONS'],'UPDATE');
    $plan=findOne($pdo,"SELECT cp.id,cp.plan_number,cp.status,cp.driver_user_id,cp.loaded_at,cp.route_started_at,a.appointment_number FROM collection_plans cp INNER JOIN inbound_appointments a ON a.collection_plan_id=cp.id WHERE cp.id=:id AND cp.status NOT IN ('COMPLETED','CANCELLED')",['id'=>(int)($payload['collection_plan_id']??0)],'La recolección no existe o ya está cerrada.');
    if(!isSuperAdmin($pdo,(int)$user['id'])&&(int)$plan['driver_user_id']!==(int)$user['id'])failRequest('Esta recolección está asignada a otro conductor.',403);
    $action=strtoupper(requiredString($payload,'trip_action','la acción del recorrido',30));if(!in_array($action,['LOADED','START_ROUTE','LOCATION_UPDATE','ARRIVED'],true))failRequest('La acción del recorrido no es válida.',422);
    $latitude=null;$longitude=null;$accuracy=null;$distance=null;$duration=null;
    if($action!=='LOADED'){$latitude=numericRangeV15($payload,'latitude',-90,90,'La latitud');$longitude=numericRangeV15($payload,'longitude',-180,180,'La longitud');$accuracy=nullablePositiveV15($payload,'accuracy_m');$distance=nullablePositiveV15($payload,'route_distance_km');$durationRaw=nullablePositiveV15($payload,'route_duration_minutes');$duration=$durationRaw===null?null:(int)round($durationRaw);}
    if($action==='START_ROUTE'&&empty($plan['loaded_at']))failRequest('Primero marca la unidad como cargada.',409);
    if(in_array($action,['LOCATION_UPDATE','ARRIVED'],true)&&empty($plan['route_started_at']))failRequest('Primero inicia el recorrido a planta.',409);
    $pdo->beginTransaction();
    try{
        if($action==='LOADED')$pdo->prepare("UPDATE collection_plans SET loaded_at=COALESCE(loaded_at,UTC_TIMESTAMP(6)),status='CONFIRMED' WHERE id=:id")->execute(['id'=>$plan['id']]);
        else{
            $status=$action==='ARRIVED'?'ARRIVED':'IN_ROUTE';
            $pdo->prepare("UPDATE collection_plans SET status=:status,route_started_at=CASE WHEN :start_action='START_ROUTE' THEN COALESCE(route_started_at,UTC_TIMESTAMP(6)) ELSE route_started_at END,actual_arrival_at=CASE WHEN :arrival_action='ARRIVED' THEN COALESCE(actual_arrival_at,UTC_TIMESTAMP(6)) ELSE actual_arrival_at END,last_latitude=:latitude,last_longitude=:longitude,last_location_accuracy_m=:accuracy,last_location_at=UTC_TIMESTAMP(6),route_distance_km=COALESCE(:distance,route_distance_km),route_duration_minutes=COALESCE(:duration,route_duration_minutes),planned_arrival=CASE WHEN :duration_eta IS NULL THEN planned_arrival ELSE DATE_ADD(UTC_TIMESTAMP(6),INTERVAL :duration_eta_minutes MINUTE) END WHERE id=:id")->execute(['status'=>$status,'start_action'=>$action,'arrival_action'=>$action,'latitude'=>$latitude,'longitude'=>$longitude,'accuracy'=>$accuracy,'distance'=>$distance,'duration'=>$duration,'duration_eta'=>$duration,'duration_eta_minutes'=>$duration??0,'id'=>$plan['id']]);
            if($action==='ARRIVED')$pdo->prepare("UPDATE inbound_appointments SET actual_arrival_at=COALESCE(actual_arrival_at,UTC_TIMESTAMP(6)),status='ARRIVED' WHERE collection_plan_id=:plan AND status NOT IN ('COMPLETED','CANCELLED')")->execute(['plan'=>$plan['id']]);
        }
        $pdo->prepare("INSERT INTO collection_route_events (collection_plan_id,event_type,latitude,longitude,accuracy_m,route_distance_km,route_duration_minutes,notes,recorded_by) VALUES (:plan,:event,:latitude,:longitude,:accuracy,:distance,:duration,:notes,:user)")->execute(['plan'=>$plan['id'],'event'=>$action==='START_ROUTE'?'ROUTE_STARTED':$action,'latitude'=>$latitude,'longitude'=>$longitude,'accuracy'=>$accuracy,'distance'=>$distance,'duration'=>$duration,'notes'=>optionalString($payload,'notes',500),'user'=>$user['id']]);
        writeAudit($pdo,(int)$user['id'],'UPDATE','collection_plan',$plan['id'],['trip_action'=>$action,'latitude'=>$latitude,'longitude'=>$longitude,'distance_km'=>$distance,'duration_minutes'=>$duration]);$pdo->commit();
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
    if(in_array($action,['START_ROUTE','ARRIVED'],true)){$recipients=mergeRecipientsV15(roleRecipientsV15($pdo,['AREA_ADMIN','AREA_MANAGER'],'ALMACEN'),roleRecipientsV15($pdo,['LOGISTICS_COORDINATOR','AREA_ADMIN','AREA_MANAGER'],'LOGISTICA'));$title=$action==='START_ROUTE'?'Recolección en camino a planta':'Recolección llegó a planta';$message="{$plan['plan_number']} · {$plan['appointment_number']}. ".($action==='START_ROUTE'?'El conductor inició el recorrido de regreso.':'El conductor confirmó la llegada.');createAlertV15($pdo,'ALMACEN',$recipients,'COLLECTION_'.$action,'INFO',$title,$message,'collection_plan',(int)$plan['id'],'COLLECTION_'.$action.'_'.$plan['id']);queueNotifications($pdo,$config,'COLLECTION_'.$action,'collection_plan',(int)$plan['id'],$recipients,$title.' '.$plan['plan_number'],$message.' Consulta la aplicación para preparar la recepción.');}
    return ['id'=>(int)$plan['id'],'number'=>$plan['plan_number'],'action'=>$action,'status'=>$action==='ARRIVED'?'ARRIVED':($action==='LOADED'?'CONFIRMED':'IN_ROUTE')];
}

function validateDriverV15(PDO $pdo,int $driverId): array
{
    $driver=findOne($pdo,"SELECT u.id,u.display_name AS name,u.email FROM app_users u INNER JOIN areas a ON a.id=u.primary_area_id INNER JOIN user_roles ur ON ur.user_id=u.id AND ur.is_active=1 INNER JOIN roles r ON r.id=ur.role_id AND r.is_active=1 WHERE u.id=:id AND u.status='ACTIVE' AND a.code='LOGISTICA' AND r.code='DRIVER'",['id'=>$driverId],'Selecciona un usuario activo con rol Conductor u operador en Logística.');
    if(!userHasPermission($pdo,$driverId,'DRIVER_COLLECTIONS','VIEW'))failRequest('El conductor no tiene autorizado el módulo Mis recolecciones asignadas.',422);return $driver;
}

function roleRecipientsV15(PDO $pdo,array $roleCodes,string $areaCode): array
{
    $marks=implode(',',array_fill(0,count($roleCodes),'?'));$statement=$pdo->prepare("SELECT DISTINCT u.id,u.email,u.display_name AS name FROM app_users u INNER JOIN areas a ON a.id=u.primary_area_id INNER JOIN user_roles ur ON ur.user_id=u.id AND ur.is_active=1 INNER JOIN roles r ON r.id=ur.role_id AND r.is_active=1 WHERE u.status='ACTIVE' AND a.code=? AND r.code IN ({$marks})");$statement->execute(array_merge([$areaCode],$roleCodes));$rows=$statement->fetchAll()?:[];if(!$rows)$rows=safeRows($pdo,"SELECT u.id,u.email,u.display_name AS name FROM app_users u INNER JOIN user_roles ur ON ur.user_id=u.id AND ur.is_active=1 INNER JOIN roles r ON r.id=ur.role_id WHERE r.code='SUPER_ADMIN' AND u.status='ACTIVE' LIMIT 1");return $rows;
}

function mergeRecipientsV15(array ...$groups): array
{
    $merged=[];
    foreach($groups as $group)foreach($group as $recipient){$key=!empty($recipient['id'])?'id:'.(int)$recipient['id']:'email:'.mb_strtolower((string)($recipient['email']??''));if($key!=='email:')$merged[$key]=$recipient;}
    return array_values($merged);
}

function createAlertV15(PDO $pdo,string $areaCode,array $recipients,string $alertType,string $severity,string $title,string $message,string $entityType,int $entityId,string $dedup): void
{
    $areaId=(int)safeScalar($pdo,"SELECT id FROM areas WHERE code=:code",['code'=>$areaCode]);$pdo->prepare("INSERT INTO alerts (alert_type,severity,title,message,entity_type,entity_id,area_id,status,deduplication_key) VALUES (:type,:severity,:title,:message,:entity_type,:entity_id,:area,'OPEN',:dedup) ON DUPLICATE KEY UPDATE title=VALUES(title),message=VALUES(message),status='OPEN',detected_at=UTC_TIMESTAMP(6)")->execute(['type'=>$alertType,'severity'=>$severity,'title'=>mb_substr($title,0,190),'message'=>mb_substr($message,0,2000),'entity_type'=>$entityType,'entity_id'=>(string)$entityId,'area'=>$areaId?:null,'dedup'=>$dedup]);$alertId=(int)safeScalar($pdo,"SELECT id FROM alerts WHERE deduplication_key=:dedup",['dedup'=>$dedup]);$insert=$pdo->prepare("INSERT IGNORE INTO user_alerts (alert_id,user_id,is_read) VALUES (:alert,:user,0)");foreach($recipients as $recipient)if(!empty($recipient['id']))$insert->execute(['alert'=>$alertId,'user'=>(int)$recipient['id']]);
}

function numericRangeV15(array $payload,string $key,float $min,float $max,string $label): float
{
    $value=filter_var($payload[$key]??null,FILTER_VALIDATE_FLOAT);if($value===false||(float)$value<$min||(float)$value>$max)failRequest("{$label} no es válida.",422);return (float)$value;
}

function nullablePositiveV15(array $payload,string $key): ?float
{
    $raw=trim((string)($payload[$key]??''));if($raw==='')return null;$value=filter_var($raw,FILTER_VALIDATE_FLOAT);if($value===false||(float)$value<0)failRequest('Uno de los datos de ruta no es válido.',422);return (float)$value;
}
