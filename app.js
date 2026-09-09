(() => {
  'use strict';

  const CONFIG = window.OLEOLAB_CONFIG || {};
  const API_URL = String(CONFIG.API_URL || '').trim();
  const DEMO_MODE = CONFIG.DEMO_MODE === true;
  const REQUEST_TIMEOUT_MS = Number(CONFIG.REQUEST_TIMEOUT_MS) || 30000;
  const TOKEN_KEY = 'oleolab_almacen_session';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const NAV = [
    { group: 'Principal', items: [['dashboard','⌂','Panel de mi área']] },
    { group: 'Administración', items: [['admin','♙','Usuarios, roles y áreas'],['audit','≡','Bitácora del sistema']] },
    { group: 'Almacenes', items: [
      ['warehouseRaw','●','Materia prima y aceites'],['warehousePackaging','▦','Materiales de empaque'],['warehouseFinished','✓','Producto terminado'],['warehouseAudits','◎','Inventarios y auditorías'],['movements','↔','Entradas y salidas']
    ]},
    { group: 'Operación', items: [['purchasing','◷','Compras y recepciones'],['quality','✓','Calidad'],['filling','▤','Órdenes de producción']] },
    { group: 'Planeación', items: [['forecast','▥','Forecast semanal'],['mrp','∑','Necesidades semanales'],['bomManagement','⌘','Listas y formulaciones'],['plannedArrivals','⇣','Llegadas planeadas']] }
  ];

  const PAGE_META = {
    dashboard:['MI ÁREA','Panel principal'],admin:['ADMINISTRACIÓN','Usuarios, roles y áreas'],purchasing:['COMPRAS','Pedidos, citas y WID'],logistics:['LOGÍSTICA Y TRÁFICO','Recolecciones y unidades'],driverCollections:['LOGÍSTICA','Mis recolecciones asignadas'],quality:['CALIDAD','Solicitudes y resultados'],
    warehouseRaw:['ALMACENES','Materia prima y aceites'],warehousePackaging:['ALMACENES','Materiales de empaque'],warehouseSpares:['ALMACENES','Refacciones'],warehouseFinished:['ALMACENES','Producto terminado'],warehouseAudits:['ALMACENES','Inventarios y auditorías'],movements:['KARDEX','Movimientos'],
    forecast:['PLANEACIÓN','Forecast semanal'],mrp:['NECESIDADES','Necesidades semanales'],bomManagement:['PLANEACIÓN','Listas y formulaciones'],plannedArrivals:['PLANEACIÓN','Llegadas planeadas'],filling:['ENVASADO','Órdenes de producción'],extraction:['EXTRACCIÓN','Proceso y trazabilidad'],shipping:['SALIDAS','Embarques'],returns:['NO CONFORMIDAD','Rechazos y devoluciones'],maintenance:['INTEGRACIÓN','Mantenimiento'],audit:['SEGURIDAD','Bitácora del sistema']
  };

  const OPERATION_META = {
    appointment:['COMPRAS Y LOGÍSTICA','Programar llegada'],receipt:['ALMACÉN','Registrar recepción'],movement:['INVENTARIO','Registrar movimiento'],warehouseMovementV18:['ALMACÉN','Registrar entrada o salida'],
    quality:['CALIDAD','Solicitar inspección'],qualityDecision:['CALIDAD','Registrar dictamen'],count:['ALMACÉN','Programar conteo'],return:['DEVOLUCIONES','Registrar devolución'],
    user:['USUARIOS','Registrar usuario'],userEdit:['USUARIOS','Configurar usuario y accesos'],supplier:['COMPRAS','Registrar proveedor'],origin:['COMPRAS','Registrar origen'],warehouse:['ALMACENES','Registrar almacén'],location:['ALMACENES','Registrar ubicación'],warehouseModule:['ALMACENES','Registrar almacén operativo'],locationModule:['ALMACENES','Registrar zona física'],item:['CATÁLOGOS','Registrar producto o material'],itemRaw:['ALMACÉN DE MATERIA PRIMA','Registrar materia prima o aceite'],itemPackaging:['ALMACÉN DE MATERIALES DE EMPAQUE','Registrar material de empaque'],itemSpare:['ALMACÉN DE REFACCIONES','Registrar refacción'],itemFinished:['ALMACÉN DE PRODUCTO TERMINADO','Registrar producto terminado'],customer:['VENTAS','Registrar cliente'],bom:['PLANEACIÓN DE MATERIALES','Agregar componente a una lista de materiales'],
    area:['ADMINISTRACIÓN','Registrar área'],role:['ADMINISTRACIÓN','Registrar rol'],technicianV14:['MANTENIMIENTO','Registrar técnico'],forecastImport:['PLANEACIÓN','Importar Forecast desde Excel'],maintenanceRequest:['MANTENIMIENTO','Registrar solicitud'],maintenanceAssignment:['MANTENIMIENTO','Asignar técnicos'],maintenanceUpdate:['MANTENIMIENTO','Responder tarea'],auditSchedule:['AUDITORÍA DE INVENTARIO','Programar días de auditoría'],
    appointmentV14:['COMPRAS','Programar recolección de materia prima'],materialDeliveryV15:['COMPRAS','Programar entrega de material'],receiptV14:['ALMACÉN','Confirmar recepción'],vehicleV15:['LOGÍSTICA','Registrar unidad'],logisticsSiteV15:['LOGÍSTICA','Configurar destino en planta'],collectionAssignmentV15:['LOGÍSTICA','Asignar recolección'],productionOrder:['ENVASADO','Crear orden de producción'],productionCompletion:['PRODUCTO TERMINADO','Registrar producto terminado'],extractionBatch:['EXTRACCIÓN','Ingresar lote a extracción'],qualityDecisionV14:['CALIDAD','Capturar resultados y dictamen'],qualityCancel:['CALIDAD','Cancelar solicitud'],productFormulaV18:['LISTAS DE MATERIALES','Asignar formulación a producto'],packagingComponentV18:['LISTAS DE MATERIALES','Cambiar material de empaque'],plannedArrivalV18:['PLANEACIÓN','Registrar llegada planeada'],initialInventorySettingV18:['ADMINISTRACIÓN','Configurar inventario inicial']
  };

  const operationFields = {
    appointment: `
      <label>Código de proveedor<input name="supplier_code" required placeholder="Ej. PROV-001"></label>
      <label>Tipo<select name="delivery_type" required><option>Recolección de fruta</option><option>Entrega de proveedor</option><option>Devolución</option></select></label>
      <label>Fecha y hora<input name="scheduled_at" type="datetime-local" required></label>
      <label>Duración estimada<select name="duration"><option value="60">1 hora</option><option value="90">1.5 horas</option><option value="120">2 horas</option></select></label>
      <label>Tipo de material<select name="expected_item_type"><option value="RAW_FRUIT">Fruta</option><option value="PACKAGING">Material de empaque</option><option value="SPARE_PART">Refacción</option><option value="RAW_OTHER">Otra materia prima</option><option value="MIXED">Mixto</option></select></label>
      <label>Material esperado<input name="material" required placeholder="Ej. Aguacate Hass · 12,000 kg"></label>`,
    receipt: `
      <label>Folio de cita<input name="appointment" placeholder="CIT-2026-0042"></label>
      <label>Código de proveedor<input name="supplier_code" required placeholder="PROV-001"></label>
      <label>Código de origen<input name="origin_code" required placeholder="URU"></label>
      <label>Código del producto recibido<input name="sku" required placeholder="MP-AGU-HASS"></label>
      <label>Peso esperado (kg)<input name="expected_weight" type="number" min="0.001" step="0.001" required></label>
      <label>Peso recibido (kg)<input name="received_weight" type="number" min="0.001" step="0.001" required></label>
      <label>Almacén<input name="warehouse_code" required placeholder="MP"></label>
      <label>Ubicación de cuarentena<input name="location_code" required placeholder="CUARENTENA"></label>
      <label class="span-2">Observaciones<textarea name="notes" rows="3"></textarea></label>`,
    movement: `
      <label>Movimiento<select name="movement_type" required><option>Transferencia</option><option>Salida a producción</option><option>Salida a mantenimiento</option><option>Merma</option></select></label>
      <label>Código del producto o material<input name="sku" required></label>
      <label>Lote<input name="lot" placeholder="Obligatorio si el artículo controla lote"></label>
      <label>Cantidad<input name="quantity" type="number" min="0.001" step="0.001" required></label>
      <label>Origen<input name="from_location" required placeholder="Código almacén/ubicación, ej. MP/A01"></label>
      <label>Destino<input name="to_location" placeholder="Para transferencias, ej. PROC/L01"></label>
      <label class="span-2">Motivo<input name="reason" required></label>`,
    quality: `
      <label>Recepción o lote<input name="reference" required></label>
      <label>Tipo<select name="quality_type"><option>Materia prima fruta</option><option>Material de empaque</option><option>Producto en proceso</option><option>Producto terminado</option><option>Devolución</option></select></label>
      <label class="span-2">Pruebas solicitadas<textarea name="tests" rows="3" required></textarea></label>`,
    qualityDecision: `
      <label>Folio de solicitud<input name="request_number" required placeholder="CAL-2026-000001"></label>
      <label>Dictamen<select name="disposition" required><option value="APPROVED">Aprobado</option><option value="CONDITIONAL">Aprobación condicional</option><option value="REJECTED">Rechazado</option></select></label>
      <label class="span-2">Justificación del dictamen<textarea name="reason" rows="3" required></textarea></label>`,
    count: `
      <label>Código de almacén<input name="warehouse_code" required placeholder="Ej. PT"></label>
      <label>Tipo<select name="count_type"><option>Cíclico</option><option>Total</option><option>Selectivo</option></select></label>
      <label>Fecha programada<input name="scheduled_date" type="date" required></label>
      <label>Responsable<input name="owner" required></label>`,
    return: `
      <label>Código de cliente<input name="customer_code" required placeholder="CLI-001"></label>
      <label>Referencia<input name="reference" required placeholder="Pedido, embarque o recepción"></label>
      <label>Código del producto<input name="sku" required></label>
      <label>Lote<input name="lot"></label>
      <label>Cantidad<input name="quantity" type="number" min="0.001" step="0.001" required></label>
      <label class="span-2">Motivo<textarea name="reason" rows="3" required></textarea></label>`,
    user: '',
    area: `<label class="span-2">Nombre del área<input name="area_name" required maxlength="120" placeholder="Ej. Almacén de materiales de empaque"></label>`,
    role: '',
    technician: '',
    maintenanceRequest: '',
    maintenanceAssignment: '',
    maintenanceUpdate: '',
    auditSchedule: '',
    bom: '',
    supplier: `
      <label>Código de proveedor<input name="supplier_code" required maxlength="40" placeholder="PROV-001"></label>
      <label>Iniciales para pre-lote<input name="short_code" required maxlength="12" placeholder="AGV"></label>
      <label>Razón social<input name="legal_name" required maxlength="190"></label>
      <label>Nombre comercial<input name="trade_name" maxlength="190"></label>
      <label>Contacto<input name="contact_name" maxlength="160"></label>
      <label>Correo de contacto<input name="contact_email" type="email" maxlength="190"></label>
      <label>Teléfono<input name="contact_phone" type="tel" maxlength="40"></label>
      <label>Dirección principal<input name="address_text" maxlength="500"></label>`,
    origin: `
      <label>Código de proveedor<input name="supplier_code" required maxlength="40" placeholder="PROV-001"></label>
      <label>Código de origen<input name="origin_code" required maxlength="12" placeholder="URU"></label>
      <label>Nombre del origen<input name="origin_name" required maxlength="160" placeholder="Huerta Uruapan"></label>
      <label>Municipio<input name="municipality" maxlength="120"></label>
      <label>Estado<input name="state_name" maxlength="120"></label>`,
    warehouse: `
      <label>Código de almacén<input name="warehouse_code" required maxlength="30" placeholder="MP"></label>
      <label>Nombre<input name="warehouse_name" required maxlength="120"></label>
      <label>Tipo<select name="warehouse_type" required><option value="RAW_MATERIAL">Materia prima</option><option value="PACKAGING">Empaques</option><option value="SPARE_PARTS">Refacciones</option><option value="PROCESS">Proceso</option><option value="FINISHED_GOODS">Producto terminado</option><option value="QUARANTINE">Cuarentena</option><option value="REJECTED">Rechazados</option><option value="RETURNS">Devoluciones</option></select></label>
      <label>Código de área<input name="area_code" placeholder="ALMACEN"></label>`,
    location: `
      <label>Código de almacén<input name="warehouse_code" required maxlength="30" placeholder="MP"></label>
      <label>Código de ubicación<input name="location_code" required maxlength="50" placeholder="CUARENTENA"></label>
      <label>Nombre<input name="location_name" required maxlength="120"></label>
      <label>Tipo<select name="location_type" required><option value="RECEIVING">Recibo</option><option value="QUALITY_HOLD">Cuarentena</option><option value="STORAGE">Almacenamiento</option><option value="PICKING">Surtido</option><option value="PRODUCTION">Producción</option><option value="SHIPPING">Embarque</option><option value="REJECTED">Rechazado</option><option value="RETURNS">Devoluciones</option></select></label>
      <label>Bloqueada<select name="is_blocked"><option value="0">No</option><option value="1">Sí</option></select></label>`,
    item: `
      <label>Código del producto o material<input name="sku" required maxlength="80"></label>
      <label>Nombre<input name="item_name" required maxlength="190"></label>
      <label>Tipo<select name="item_type" required><option value="RAW_FRUIT">Aguacate en fruta</option><option value="BULK_OIL">Aceite crudo, para refinar o listo para envasar</option><option value="RAW_OTHER">Otra materia prima</option><option value="PACKAGING">Botella, tapa, etiqueta, caja u otro material de empaque</option><option value="SPARE_PART">Refacción</option><option value="CONSUMABLE">Consumible</option><option value="FINISHED_GOOD">Producto terminado</option><option value="SERVICE">Servicio</option></select></label>
      <label>Categoría<input name="category_code" required placeholder="FRUIT, PACK, SPARE, FG..."></label>
      <label>Unidad base<select name="uom_code" required><option value="KG">Kilogramos</option><option value="L">Litros</option><option value="EA">Piezas</option><option value="BOX">Cajas</option><option value="BEAN">Contenedores de fruta</option><option value="PALLET">Tarimas</option></select></label>
      <label>Control por lote<select name="lot_controlled"><option value="1">Sí</option><option value="0">No</option></select></label>
      <label>Requiere Calidad<select name="quality_required"><option value="1">Sí</option><option value="0">No</option></select></label>
      <label>Punto de reorden<input name="reorder_point" type="number" min="0" step="0.001" value="0"></label>`,
    customer: `
      <label>Código de cliente<input name="customer_code" required maxlength="40" placeholder="CLI-001"></label>
      <label>Razón social<input name="legal_name" required maxlength="190"></label>
      <label>Nombre comercial<input name="trade_name" maxlength="190"></label>
      <label>Correo de contacto<input name="contact_email" type="email" maxlength="190"></label>`
  };

  const demoData = {
    user: { id: 1, name: 'Roberto Hernández', role: 'Superadministrador', modules: ['*'], actions: ['*'], isSuperAdmin: true, canManageArea: true },
    metrics: { inventorySkus: 248, criticalShortages: 7, pendingQuality: 5, ordersAtRisk: 4 },
    coverage: [
      { name: 'Producto terminado', value: 84, tone: 'green' }, { name: 'Materiales de empaque', value: 71, tone: 'amber' },
      { name: 'Materia prima fruta', value: 63, tone: 'amber' }, { name: 'Refacciones críticas', value: 42, tone: 'red' }
    ],
    alerts: [
      { id: 1, severity: 'critical', title: 'Faltante para Forecast revisado', message: 'Botella PET 500 ml: faltan 18,400 piezas para octubre.', time: 'Hace 18 min' },
      { id: 2, severity: 'warning', title: 'Proveedor fuera de ventana', message: 'Envases del Norte confirma llegada 75 min después de su cita.', time: 'Hace 34 min' },
      { id: 3, severity: 'warning', title: 'Diferencia de conteo', message: 'Almacén PT · SKU AVEX-250: diferencia de 12 cajas.', time: 'Hace 1 h' },
      { id: 4, severity: 'critical', title: 'Orden con riesgo de incumplimiento', message: 'OP-2026-0188 no tiene etiquetas suficientes reservadas.', time: 'Hace 2 h' }
    ],
    appointments: [
      { id: 'CIT-2026-0042', time: '07:30', type: 'Entrada', supplier: 'Agroproductores del Valle', material: 'Aguacate Hass · 12,000 kg', dock: 'Patio MP', status: 'Confirmada' },
      { id: 'CIT-2026-0043', time: '09:00', type: 'Salida', supplier: 'Transportes del Bajío', material: 'PT · Pedido SO-2841', dock: 'Andén 2', status: 'Planeada' },
      { id: 'CIT-2026-0044', time: '10:30', type: 'Entrada', supplier: 'Envases del Norte', material: 'Botella PET 500 ml · 24,000 pzas', dock: 'Andén 1', status: 'Retrasada' },
      { id: 'CIT-2026-0045', time: '13:00', type: 'Entrada', supplier: 'Frutícola San José', material: 'Aguacate Hass · 8,400 kg', dock: 'Patio MP', status: 'Por confirmar' }
    ],
    inventory: [
      { sku: 'MP-AGU-HASS', item: 'Aguacate Hass', type: 'Materia prima', warehouse: 'Materia prima', lot: 'AGV-URU-20260905-001', onHand: 11840, reserved: 7600, available: 4240, uom: 'kg', status: 'Disponible' },
      { sku: 'ENV-PET-500', item: 'Botella PET 500 ml', type: 'Empaque', warehouse: 'Materiales y empaque', lot: 'EN-240826-A', onHand: 32600, reserved: 32600, available: 0, uom: 'pzas', status: 'Sin disponible' },
      { sku: 'TAP-NEG-028', item: 'Tapa negra 28 mm', type: 'Empaque', warehouse: 'Materiales y empaque', lot: 'TN-190826-C', onHand: 48700, reserved: 24100, available: 24600, uom: 'pzas', status: 'Disponible' },
      { sku: 'ETQ-EXT-500', item: 'Etiqueta AOVE 500 ml', type: 'Empaque', warehouse: 'Materiales y empaque', lot: 'ET-020926-B', onHand: 9200, reserved: 8800, available: 400, uom: 'pzas', status: 'Crítico' },
      { sku: 'ACE-GR-EXT', item: 'Aceite extra virgen a granel', type: 'Proceso', warehouse: 'Producto en proceso', lot: 'EXT-20260904-03', onHand: 6840, reserved: 4500, available: 2340, uom: 'L', status: 'Disponible' },
      { sku: 'PT-AOVE-500', item: 'AOVE 500 ml', type: 'Producto terminado', warehouse: 'Producto terminado', lot: 'PT-20260903-02', onHand: 1240, reserved: 960, available: 280, uom: 'cajas', status: 'Bajo' }
    ],
    movements: [
      { id: 'MOV-2026-01892', date: '2026-09-05 08:11', type: 'Recepción', sku: 'MP-AGU-HASS', lot: 'AGV-URU-20260905-001', qty: 11840, uom: 'kg', location: 'MP / Cuarentena', user: 'Laura M.', status: 'Contabilizado' },
      { id: 'MOV-2026-01891', date: '2026-09-05 07:46', type: 'Salida a producción', sku: 'ENV-PET-500', lot: 'EN-240826-A', qty: -12000, uom: 'pzas', location: 'Empaque / Línea 1', user: 'José R.', status: 'Contabilizado' },
      { id: 'MOV-2026-01890', date: '2026-09-05 07:20', type: 'Transferencia', sku: 'ACE-GR-EXT', lot: 'EXT-20260904-03', qty: -1800, uom: 'L', location: 'Tanque T-04 → Envasado', user: 'Mariana C.', status: 'Contabilizado' },
      { id: 'MOV-2026-01889', date: '2026-09-04 18:15', type: 'Ajuste de conteo', sku: 'PT-AOVE-500', lot: 'PT-20260903-02', qty: -12, uom: 'cajas', location: 'PT / Rack B-03', user: 'Carlos P.', status: 'Contabilizado' }
    ],
    receipts: [
      { id: 'REC-2026-0078', prelot: 'AGV-URU-20260905-001', supplier: 'Agroproductores del Valle', item: 'Aguacate Hass', expected: '12,000 kg', received: '11,840 kg', quality: 'Pendiente', status: 'En inspección' },
      { id: 'REC-2026-0077', prelot: 'EN-MTY-20260904-001', supplier: 'Envases del Norte', item: 'Botella PET 500 ml', expected: '24,000 pzas', received: '24,000 pzas', quality: 'Aprobado', status: 'Cerrada' },
      { id: 'REC-2026-0076', prelot: 'FSJ-UAP-20260904-001', supplier: 'Frutícola San José', item: 'Aguacate Hass', expected: '8,500 kg', received: '8,360 kg', quality: 'Condicional', status: 'Parcial' }
    ],
    quality: [
      { id: 'CAL-2026-0128', requested: '05 sep · 08:18', type: 'Materia prima fruta', reference: 'REC-2026-0078', item: 'Aguacate Hass', lot: 'AGV-URU-20260905-001', owner: 'Sin asignar', status: 'Solicitada' },
      { id: 'CAL-2026-0127', requested: '05 sep · 07:12', type: 'En proceso', reference: 'EXT-20260905-01', item: 'Aceite crudo', lot: 'EXT-20260905-01', owner: 'Ana L.', status: 'En pruebas' },
      { id: 'CAL-2026-0126', requested: '04 sep · 15:30', type: 'Material de empaque', reference: 'REC-2026-0077', item: 'Botella PET 500 ml', lot: 'EN-240826-A', owner: 'Daniela P.', status: 'Aprobada' },
      { id: 'CAL-2026-0125', requested: '04 sep · 13:22', type: 'Materia prima fruta', reference: 'REC-2026-0076', item: 'Aguacate Hass', lot: 'FSJ-UAP-20260904-001', owner: 'Ana L.', status: 'Condicional' }
    ],
    forecast: [
      { customer: 'Retail nacional', sku: 'PT-AOVE-250', item: 'AOVE 250 ml', original: 18400, current: 20800, delta: 2400, impact: 'Faltante etiqueta', status: 'En riesgo' },
      { customer: 'Retail nacional', sku: 'PT-AOVE-500', item: 'AOVE 500 ml', original: 32000, current: 36000, delta: 4000, impact: 'Faltante botella', status: 'En riesgo' },
      { customer: 'Exportación USA', sku: 'PT-AVO-1L', item: 'Aceite aguacate 1 L', original: 9600, current: 9600, delta: 0, impact: 'Sin cambio', status: 'Cubierto' },
      { customer: 'Food service', sku: 'PT-AVO-5L', item: 'Aceite aguacate 5 L', original: 2800, current: 2400, delta: -400, impact: 'Liberación de material', status: 'Cubierto' }
    ],
    mrp: [
      { item: 'Botella PET 500 ml', sku: 'ENV-PET-500', required: 51000, available: 32600, incoming: 0, shortage: 18400, needDate: '2026-09-28', action: 'Comprar', status: 'Faltante' },
      { item: 'Etiqueta AOVE 500 ml', sku: 'ETQ-EXT-500', required: 17600, available: 9200, incoming: 0, shortage: 8400, needDate: '2026-09-25', action: 'Acelerar proveedor', status: 'Faltante' },
      { item: 'Tapa negra 28 mm', sku: 'TAP-NEG-028', required: 34000, available: 48700, incoming: 12000, shortage: 0, needDate: '2026-09-25', action: 'Sin acción', status: 'Cubierto' },
      { item: 'Aguacate Hass', sku: 'MP-AGU-HASS', required: 96400, available: 34200, incoming: 58000, shortage: 4200, needDate: '2026-09-18', action: 'Programar recolección', status: 'Faltante' }
    ],
    production: [
      { id: 'OP-2026-0188', item: 'AOVE 500 ml', customer: 'Retail nacional', planned: '12,000 pzas', completed: '0 pzas', date: '08–09 sep', material: 'No completo', status: 'En riesgo' },
      { id: 'OP-2026-0187', item: 'Aceite aguacate 1 L', customer: 'Exportación USA', planned: '6,400 pzas', completed: '2,100 pzas', date: '05–06 sep', material: 'Completo', status: 'En proceso' },
      { id: 'OP-2026-0186', item: 'AOVE 250 ml', customer: 'Retail nacional', planned: '9,600 pzas', completed: '9,600 pzas', date: '03–04 sep', material: 'Completo', status: 'Terminada' }
    ],
    shipments: [
      { id: 'EMB-2026-0412', order: 'SO-2841', customer: 'Retail nacional', scheduled: '05 sep · 09:00', packages: 82, progress: 'Preparado', dock: 'Andén 2', status: 'Listo' },
      { id: 'EMB-2026-0413', order: 'SO-2843', customer: 'Exportación USA', scheduled: '05 sep · 15:30', packages: 44, progress: '72% surtido', dock: 'Andén 1', status: 'Surtido' },
      { id: 'EMB-2026-0414', order: 'SO-2848', customer: 'Food service', scheduled: '06 sep · 08:00', packages: 26, progress: 'Sin iniciar', dock: 'Por asignar', status: 'Planeado' }
    ],
    returns: [
      { id: 'DEV-2026-0029', type: 'Cliente', partner: 'Retail nacional', reference: 'EMB-2026-0398', item: 'AOVE 500 ml', lot: 'PT-20260827-04', qty: '18 cajas', reason: 'Daño en embalaje', status: 'Calidad' },
      { id: 'RECH-2026-0017', type: 'Proveedor', partner: 'Empaques Premium', reference: 'REC-2026-0069', item: 'Caja corrugada 12x500', lot: 'CP-180826', qty: '640 pzas', reason: 'Impresión fuera de especificación', status: 'Por devolver' }
    ],
    counts: [
      { id: 'CON-2026-0091', warehouse: 'Producto terminado', scope: 'Rack B', planned: '05 sep · 14:00', owner: 'Carlos P.', variance: 'Pendiente', status: 'Programado' },
      { id: 'CON-2026-0090', warehouse: 'Materiales y empaque', scope: 'Familia etiquetas', planned: '04 sep · 16:00', owner: 'Laura M.', variance: '-1.8%', status: 'Reconteo' },
      { id: 'CON-2026-0089', warehouse: 'Refacciones', scope: 'Críticos A', planned: '03 sep · 11:00', owner: 'José R.', variance: '+0.2%', status: 'Aprobado' }
    ],
    maintenance: [
      { id: 'REQ-MTTO-0441', order: 'OT-2026-0918', asset: 'Extractor EX-02', item: 'Rodamiento 6205', qty: '2 pzas', needed: '05 sep · 10:00', reservation: 'Completa', status: 'Por surtir' },
      { id: 'REQ-MTTO-0440', order: 'OT-2026-0915', asset: 'Llenadora LL-01', item: 'Empaque sanitario 2\"', qty: '4 pzas', needed: '05 sep · 08:00', reservation: 'Entregada', status: 'Cerrada' },
      { id: 'REQ-MTTO-0439', order: 'OT-2026-0912', asset: 'Caldera CA-01', item: 'Válvula solenoide', qty: '1 pza', needed: '06 sep · 09:00', reservation: 'Sin existencia', status: 'Faltante' }
    ],
    users: [
      { name: 'Roberto Hernández', email: 'superadmin@oleolab.mx', area: 'Administración', role: 'Superadministrador', modules: 'Todos', status: 'Activo' },
      { name: 'Laura Martínez', email: 'laura.m@oleolab.mx', area: 'Almacenes', role: 'Responsable de área', modules: '8 módulos', status: 'Activo' },
      { name: 'Ana López', email: 'ana.l@oleolab.mx', area: 'Calidad', role: 'Aprobador', modules: '4 módulos', status: 'Activo' },
      { name: 'Mariana Cruz', email: 'mariana.c@oleolab.mx', area: 'Producción', role: 'Operador', modules: '5 módulos', status: 'Activo' }
    ],
    audit: [
      { date: '05 sep · 08:24:18', user: 'Laura Martínez', area: 'Almacenes', action: 'CREATE', entity: 'Recepción', reference: 'REC-2026-0078', detail: 'Registró peso neto 11,840 kg' },
      { date: '05 sep · 08:18:04', user: 'Laura Martínez', area: 'Almacenes', action: 'CREATE', entity: 'Calidad', reference: 'CAL-2026-0128', detail: 'Solicitó análisis de materia prima' },
      { date: '05 sep · 07:46:51', user: 'José Ramírez', area: 'Almacenes', action: 'POST', entity: 'Movimiento', reference: 'MOV-2026-01891', detail: 'Salida a producción · 12,000 pzas' },
      { date: '05 sep · 07:12:30', user: 'Ana López', area: 'Calidad', action: 'UPDATE', entity: 'Solicitud', reference: 'CAL-2026-0127', detail: 'Cambió estado a En pruebas' }
    ]
  };

  const state = {
    token: sessionStorage.getItem(TOKEN_KEY) || '', data: null,
    page: location.hash.replace('#/', '') || 'dashboard', query: '', demo: false, traceResult: null,
    inventoryCaptureMode: 'initial', inventoryCaptureLines: [], inventoryWarehouseType: '', forecastPreview: null, forecastFile: null,
    evidenceUrls: []
  };

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    $('#login-form').addEventListener('submit', login);
    $('#demo-login').addEventListener('click', startDemo);
    $('#logout').addEventListener('click', logout);
    $('#menu').addEventListener('click', toggleSidebar);
    $('#quick-action').addEventListener('click', () => openOperation($('#quick-action').dataset.operation));
    $('#operation-form').addEventListener('submit', submitOperation);
    $$('[data-close-dialog]').forEach(button => button.addEventListener('click', closeDialogs));
    $('#detail-dialog').addEventListener('close', revokeEvidenceUrls);
    $('#alerts-button').addEventListener('click', openAlerts);
    $('#close-alerts').addEventListener('click', closeAlerts);
    $('#scrim').addEventListener('click', closeOverlays);
    $('#global-search').addEventListener('input', event => { state.query = event.target.value.trim().toLowerCase(); renderPage(); });
    window.addEventListener('hashchange', () => navigate(location.hash.replace('#/', '') || 'dashboard', false));
    renderOperationFields();

    if (DEMO_MODE) $('#demo-login').classList.remove('hidden');
    if (!configured()) $('#api-warning').textContent = 'La API aún no está conectada. Puedes explorar el frontend con datos de muestra.';
    if (state.token && configured()) loadApplication();
  }

  async function login(event) {
    event.preventDefault();
    if (!configured()) return toast('Primero debe configurarse la URL de la API PHP.', true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setLoading(true, 'Verificando acceso…');
    try {
      const result = await api('login', { email: form.get('email'), password: form.get('password') }, '');
      state.token = result.token;
      sessionStorage.setItem(TOKEN_KEY, state.token);
      await loadApplication();
      formElement.reset();
    } catch (error) { toast(error.message, true); }
    finally { setLoading(false); }
  }

  function startDemo() {
    state.demo = true;
    state.data = structuredClone(demoData);
    showApplication();
  }

  async function loadApplication() {
    setLoading(true, 'Cargando operación…');
    try {
      state.data = await api('bootstrap');
      state.demo = false;
      showApplication();
    } catch (error) {
      state.token = '';
      sessionStorage.removeItem(TOKEN_KEY);
      toast(error.message, true);
    } finally { setLoading(false); }
  }

  function showApplication() {
    $('#auth').classList.add('hidden');
    $('#application').classList.remove('hidden');
    $('#environment-banner').classList.toggle('hidden', !state.demo);
    $('#environment-banner').textContent = state.demo ? 'Vista de demostración: los datos son ficticios y los cambios no se guardan en la base.' : '';
    renderIdentity();
    renderNav();
    renderAlerts();
    navigate(validPage(state.page) ? state.page : 'dashboard', true);
  }

  async function logout() {
    try { if (!state.demo && state.token) await api('logout', {}); } catch (_) {}
    state.token = ''; state.data = null; state.demo = false;
    sessionStorage.removeItem(TOKEN_KEY);
    $('#application').classList.add('hidden');
    $('#auth').classList.remove('hidden');
    closeOverlays();
    toast('Sesión cerrada.');
  }

  function renderIdentity() {
    const user = state.data.user;
    $('#sidebar-name').textContent = user.name;
    $('#sidebar-role').textContent = user.role;
    $('#avatar').textContent = initials(user.name);
  }

  function allowed(page) {
    const modules = state.data?.user?.modules || [];
    return modules.includes('*') || modules.includes(page);
  }

  function can(moduleCode, actionCode) {
    const actions=state.data?.user?.actions||[];
    return actions.includes('*')||actions.includes(`${moduleCode}.${actionCode}`);
  }

  function canAny(moduleCodes, actionCode) {
    return moduleCodes.some(moduleCode=>can(moduleCode,actionCode));
  }

  function warehouseModule(warehouseType) {
    return {RAW_MATERIAL:'WAREHOUSE_RAW',PACKAGING:'WAREHOUSE_PACKAGING',SPARE_PARTS:'WAREHOUSE_SPARES',FINISHED_GOODS:'WAREHOUSE_FINISHED'}[warehouseType]||'';
  }

  function validPage(page) { return NAV.some(group => group.items.some(item => item[0] === page)); }

  function renderNav() {
    $('#nav').innerHTML = NAV.map(group => {
      const items = group.items.filter(([page]) => allowed(page));
      if (!items.length) return '';
      return `<div class="nav-group">${h(group.group)}</div>${items.map(([page, icon, label]) => `<button class="nav-button ${state.page === page ? 'active' : ''}" data-page="${page}"><span class="nav-icon">${icon}</span><span>${h(label)}</span></button>`).join('')}`;
    }).join('');
    $$('[data-page]', $('#nav')).forEach(button => button.addEventListener('click', () => navigate(button.dataset.page, true)));
  }

  function navigate(page, updateHash = true) {
    if (!validPage(page) || !allowed(page)) page = 'dashboard';
    state.page = page;
    state.query = '';
    $('#global-search').value = '';
    $('#sidebar').classList.remove('open');
    if (updateHash && location.hash !== `#/${page}`) history.replaceState(null, '', `#/${page}`);
    const [kicker, title] = PAGE_META[page] || PAGE_META.dashboard;
    $('#page-kicker').textContent = kicker;
    $('#page-title').textContent = title;
    // Cada captura se abre desde su propio módulo y sólo si el rol tiene permiso.
    $('#quick-action').dataset.operation='';
    $('#quick-action').classList.add('hidden');
    renderNav();
    renderPage();
    $('#view').focus({ preventScroll: true });
  }

  function renderPage() {
    const renderer = {
      dashboard:renderDashboard,admin:renderAdmin,purchasing:renderPurchasing,logistics:renderLogistics,driverCollections:renderDriverCollections,quality:renderQuality,
      warehouseRaw:()=>renderWarehouseModule('RAW_MATERIAL',['RAW_FRUIT','RAW_OTHER','BULK_OIL'],'Materia prima y aceites','itemRaw'),
      warehousePackaging:()=>renderWarehouseModule('PACKAGING',['PACKAGING'],'Materiales de empaque','itemPackaging'),
      warehouseSpares:()=>renderWarehouseModule('SPARE_PARTS',['SPARE_PART'],'Refacciones','itemSpare'),
      warehouseFinished:()=>renderWarehouseModule('FINISHED_GOODS',['FINISHED_GOOD'],'Producto terminado','itemFinished'),
      warehouseAudits:renderWarehouseAudits,movements:renderMovements,forecast:renderForecast,mrp:renderMrp,bomManagement:renderBomManagement,plannedArrivals:renderPlannedArrivals,filling:renderFilling,extraction:renderExtraction,
      shipping:renderShipping,returns:renderReturns,maintenance:renderMaintenance,audit:renderAudit
    }[state.page] || renderDashboard;
    renderer();
    bindCommonActions();
  }

  function renderDashboard() {
    const d = state.data;
    if (!state.demo && d.areaDashboard) {
      const inventoryPage=['warehouseRaw','warehousePackaging','warehouseSpares','warehouseFinished','movements'].find(page=>allowed(page));
      const area = d.areaDashboard;
      const metrics = area.metrics || [];
      const critical = area.criticalMaterials || [];
      const flow = area.highFlow || [];
      const planShortages = area.planShortages || [];
      const compliance = area.forecastCompliance || [];
      $('#view').innerHTML = `
        <div class="welcome"><div><p class="eyebrow">${h(d.user.areaName)}</p><h2>${h(area.title)}</h2><p class="muted">Información y decisiones correspondientes a tu área.</p></div><div class="actions"><button class="btn ghost" data-executive-report>Descargar reporte ejecutivo</button>${inventoryPage ? `<button class="btn primary" data-page-link="${inventoryPage}">Ver existencias</button>` : ''}</div></div>
        <div class="metric-grid">${metrics.map((item, index) => metric(item.label, n(item.value), ['▦','◷','!','✓'][index % 4], item.note, item.tone || '')).join('')}</div>
        <div class="content-grid">
          <section class="card"><div class="card-head"><div><h3>Materiales críticos</h3><p>Existencia disponible contra el punto de reorden.</p></div></div>${table(['Material','Existencia disponible','Punto de reorden','Estado'], critical.map(x => [cell(x.item, x.sku), `${n(x.available)} ${x.uom}`, n(x.reorder_point), badge(x.status)]), 'No hay materiales críticos.')}</section>
          <section class="card"><div class="card-head"><div><h3>Mayor salida o consumo</h3><p>Últimos treinta días.</p></div></div>${table(['Material','Cantidad utilizada'], flow.map(x => [cell(x.item, x.sku), `${n(x.quantity)} ${x.uom}`]), 'Todavía no hay consumo registrado.', 'compact')}</section>
        </div>
        <section class="card page-gap"><div class="card-head"><div><h3>Faltantes para cumplir el plan de fabricación</h3><p>Necesidad neta calculada con el Forecast, las listas de materiales y las existencias.</p></div></div>${table(['Material o materia prima','Cantidad faltante','Fecha requerida'],planShortages.map(x=>[cell(x.item,`Código: ${x.sku}`),`${n(x.shortage)} ${x.uom}`,dateFmt(x.needDate)]),'No hay faltantes calculados para el plan vigente.')}</section>
        <section class="card page-gap"><div class="card-head"><div><h3>Cumplimiento del Forecast</h3><p>Producto terminado disponible frente al plan vigente.</p></div></div>${table(['Producto terminado','Forecast vigente','Disponible','Cobertura'], compliance.map(x => [cell(x.item, x.sku), n(x.forecastQty), n(x.availableQty), badge(`${n(x.compliance)}%`)]), 'Importa el Forecast y registra existencias para calcular la cobertura.')}</section>`;
      return;
    }
    $('#view').innerHTML = `
      <div class="welcome"><div><h2>Operación de hoy</h2><p class="muted">Existencias, compromisos y eventos que requieren decisión.</p></div><div class="actions"><button class="btn ghost" data-page-link="forecast">Comparar Forecast</button><button class="btn primary" data-open-operation="appointmentV14">＋ Registrar operación</button></div></div>
      <div class="metric-grid">
        ${metric('Productos con existencia', n(d.metrics.inventorySkus), '▦', 'Inventario contabilizado')}
        ${metric('Faltantes críticos', n(d.metrics.criticalShortages), '!', 'Necesidades MRP abiertas', 'danger')}
        ${metric('Pendientes de Calidad', n(d.metrics.pendingQuality), '✓', 'Recepciones en espera', 'warning')}
        ${metric('Órdenes en riesgo', n(d.metrics.ordersAtRisk), '◷', 'Fecha prometida comprometida', 'danger')}
      </div>
      <div class="content-grid">
        <section class="card"><div class="card-head"><div><h3>Agenda de andenes</h3><p>Entradas y salidas programadas para hoy.</p></div><button class="btn ghost small" data-page-link="purchasing">Ver agenda</button></div><div class="card-pad">${agenda(d.appointments.slice(0, 4))}</div></section>
        <section class="card card-pad"><h3>Cobertura del plan</h3><p>Disponibilidad frente al Forecast vigente.</p>${coverage(d.coverage)}</section>
      </div>
      <div class="equal-grid page-gap">
        <section class="card"><div class="card-head"><div><h3>Alertas prioritarias</h3><p>Desviaciones que pueden afectar el cumplimiento.</p></div><button class="btn ghost small" data-open-alerts>Ver todas</button></div><div class="card-pad">${alertRows(d.alerts.slice(0, 3))}</div></section>
        <section class="card"><div class="card-head"><div><h3>Movimientos recientes</h3><p>Últimas afectaciones contabilizadas.</p></div><button class="btn ghost small" data-page-link="movements">Ver kardex</button></div>${movementTable(d.movements.slice(0, 4), true)}</section>
      </div>`;
  }

  function renderAdmin() {
    if (!state.data.user.isSuperAdmin) return navigate('dashboard', true);
    const rows=filterRows(state.data.users||[],['name','email','area','role','modules','status']);
    const issues=filterRows(state.data.sourceImportIssues||[],['severity','issueCode','entityCode','message']);
    const openIssues=issues.filter(x=>Number(x.resolved)!==1);
    $('#view').innerHTML=`<div class="section-head"><div><h2>Administración del sistema</h2><p class="muted">Único lugar para crear usuarios, roles y áreas, y decidir qué módulos puede abrir cada persona.</p></div><div class="actions"><button class="btn ghost" data-open-operation="area">Nueva área</button><button class="btn ghost" data-open-operation="role">Nuevo rol</button><button class="btn primary" data-open-operation="user">Nuevo usuario</button></div></div>
      <section class="card">${table(['Usuario','Área','Rol','Módulos asignados','Estado',''],rows.map(x=>[cell(x.name,[x.email,x.phone].filter(Boolean).join(' · ')),x.area,x.role,x.modules,badge(x.status),trusted(`<button class="btn ghost small" data-user-edit="${h(x.id)}">Configurar</button>`)]),'Todavía no hay usuarios registrados.')}</section>
      <section class="card page-gap"><div class="card-head"><div><h3>Revisión de los catálogos importados</h3><p>${n(openIssues.length)} observaciones conservadas para corregirlas en su archivo fuente sin inventar datos.</p></div></div>${table(['Nivel','Código','Registro','Renglón de origen','Detalle'],openIssues.map(x=>[badge(x.severity),x.issueCode,x.entityCode||'General',x.sourceRow||'—',x.message]),'Los catálogos importados no tienen observaciones abiertas.')}</section>
      <section class="card card-pad page-gap"><h3>Regla de seguridad</h3><p>Solamente la cuenta Administrador del sistema puede entrar a esta ventana. Los permisos también se validan en el servidor; ocultar una opción en pantalla no es la única protección.</p></section>`;
  }

  function renderWarehouseModule(warehouseType,itemTypes,title,itemOperation) {
    const coreRows=(state.data.coreInventory||[]).filter(x=>itemTypes.includes(x.itemType)).map(x=>({...x,type:x.itemType,item:x.name,onHand:x.totalQty,available:x.availableQty,status:Number(x.availableQty)<=0?'Sin disponible':'Disponible',lot:'Todos los lotes'}));
    const inventory=filterRows(coreRows.length?coreRows:(state.data.warehouseInventory||[]).filter(x=>itemTypes.includes(x.type)),['sku','item','warehouse','lot','status']);
    const catalog=(state.data.lookups?.items||[]).filter(x=>itemTypes.includes(x.item_type));
    const finished=warehouseType==='FINISHED_GOODS';
    const moduleCode=warehouseModule(warehouseType);
    const canCreate=can(moduleCode,'CREATE');
    const canReceive=!finished&&(can(moduleCode,'CREATE')||can('RECEIVING','CREATE'));
    const canMove=can(moduleCode,'POST')||can('INVENTORY','POST');
    const canInitial=can(moduleCode,'POST')||can('INITIAL_INVENTORY','POST');
    const canAudit=can(moduleCode,'APPROVE')||can('COUNTS','APPROVE');
    const canComplete=finished&&(can(moduleCode,'POST')||can('FILLING','POST')||can('PRODUCTION','POST'));
    const actions=[
      canInitial?`<button class="btn primary" data-stocktake-type="${warehouseType}">Capturar existencias actuales</button>`:'',
      canAudit?`<button class="btn ghost" data-stocktake-type="${warehouseType}" data-audit-mode="audit">Auditar</button>`:'',
      canCreate?`<button class="btn ghost" data-open-operation="${itemOperation}">${finished?'Nuevo producto':warehouseType==='PACKAGING'?'Agregar material al catálogo':warehouseType==='SPARE_PARTS'?'Agregar refacción al catálogo':'Agregar materia prima al catálogo'}</button>`:'',
      canMove?`<button class="btn primary" data-open-operation="warehouseMovementV18" data-warehouse-type="${warehouseType}">Registrar entrada o salida</button>`:'',
      canReceive?'<button class="btn primary" data-open-operation="receiptV14">Recibir cita WID</button>':'',
      canComplete?'<button class="btn primary" data-open-operation="productionCompletion">Registrar producto terminado</button>':''
    ].join('');
    const help=warehouseType==='PACKAGING'?'Selecciona botella, tapa, sello, etiqueta, caja u otro empaque del catálogo oficial y captura la cantidad física con su unidad.':warehouseType==='SPARE_PARTS'?'Selecciona únicamente refacciones del catálogo y captura su existencia física con la unidad correspondiente.':warehouseType==='RAW_MATERIAL'?'El aguacate se registra solamente en kilogramos; los aceites y demás materias primas usan su unidad configurada.':'Registra producto terminado contra su orden y lista de materiales.';
    $('#view').innerHTML=`<div class="section-head"><div><h2>Almacén de ${h(title.toLowerCase())}</h2><p class="muted">${h(help)} Las ubicaciones técnicas se aplican automáticamente para conservar trazabilidad.</p></div>${actions?`<div class="actions">${actions}</div>`:''}</div>
      <div class="metric-grid">${metric('Productos o materiales',n(catalog.length),'◇','Catálogo activo')}${metric('Existencia disponible',n(inventory.reduce((s,x)=>s+Number(x.available||0),0)),'▦','Suma informativa; revisar unidades')}${metric('Pendiente de Calidad',n(inventory.reduce((s,x)=>s+Number(x.widQty||0),0)),'◷','WID no utilizable')}${metric('Sin disponible',n(inventory.filter(x=>Number(x.available)<=0).length),'!','Bloqueado o agotado',inventory.some(x=>Number(x.available)<=0)?'danger':'')}</div>
      <section class="card"><div class="card-head"><div><h3>Existencias</h3><p>Disponible, pendiente de Calidad (WID) y rechazado claramente separados.</p></div><button class="btn ghost small" data-export>Descargar</button></div>${table(['Producto o material','Almacén','Total físico','Disponible','WID','Rechazado','Unidad','Estado'],inventory.map(x=>[cell(x.item,x.sku),x.warehouse,n(x.onHand),n(x.available),n(x.widQty||0),n(x.rejectedQty||0),unitLabel(x.uom),badge(x.status)]),'No hay existencias registradas en este almacén.')}</section>
      <section class="card page-gap"><div class="card-head"><div><h3>Catálogo de ${h(title.toLowerCase())}</h3><p>Usa los registros existentes para capturar inventario. Agrega otro sólo si realmente no existe.</p></div></div>${table(['Código','Nombre','Unidad','Control por lote','Calidad'],catalog.map(x=>[folio(x.sku),x.name,unitLabel(x.uom_code),Number(x.lot_controlled)?'Sí':'No',Number(x.quality_required)?'Requerida':'No requerida']),'No hay artículos en este catálogo.')}</section>`;
  }

  function renderWarehouseAudits() {
    renderStocktake();
  }

  function renderAppointments() {
    const rows = filterRows(state.data.appointments, ['id', 'supplier', 'material', 'dock', 'status']);
    const confirmed = rows.filter(x => /CONFIRMED|CONFIRMADA/i.test(x.status)).length;
    const delayed = rows.filter(x => /DELAYED|RETRASADA/i.test(x.status)).length;
    $('#view').innerHTML = sectionHeader('Citas programadas', 'Coordina proveedores, recolecciones y embarques sin saturar la operación.', 'Nueva cita', 'appointment') + `
      <div class="metric-grid">${metric('Agenda visible', n(rows.length), '◷', 'Próximos siete días')}${metric('Confirmadas', n(confirmed), '✓', rows.length ? `${n(confirmed / rows.length * 100)}% de la agenda` : 'Sin citas')}${metric('Retrasadas', n(delayed), '!', 'Requieren seguimiento', delayed ? 'danger' : '')}${metric('Entradas previstas', n(rows.filter(x => x.type === 'Entrada').length), '▦', 'Recepciones programadas')}</div>
      <section class="card">${table(['Hora','Folio','Tipo','Proveedor / transportista','Material','Ubicación','Estado'], rows.map(x => [x.time, folio(x.id), x.type, cell(x.supplier, x.material), x.material, x.dock, badge(x.status)]), 'No hay citas con ese criterio.')}</section>`;
  }

  function renderPurchasing() {
    const data = state.data.purchaseDashboard || { upcoming: [], needs: [] };
    const upcoming = filterRows(data.upcoming || [], ['id', 'scheduled', 'supplier', 'material', 'status']);
    const needs = filterRows(data.needs || [], ['item', 'supplier', 'needDate']);
    const expected=filterRows(state.data.inboundExpected||[],['appointment','supplier','item','sku','warehouse','status']);
    const collections=filterRows(state.data.collections||[],['planNumber','appointment','prelot','supplier','origin','item','purchaseOrder','status']);
    const canCreate=can('PURCHASING','CREATE')||can('APPOINTMENTS','CREATE');
    $('#view').innerHTML = `
      <div class="section-head"><div><h2>Compras, citas y recepción esperada</h2><p class="muted">Compras captura sólo los datos comerciales. La aplicación genera semana, fecha de solicitud, prefolio, estado y días de espera.</p></div>${canCreate?'<div class="actions"><button class="btn ghost" data-open-operation="supplier">Nuevo proveedor</button><button class="btn ghost" data-open-operation="origin">Nuevo origen</button><button class="btn ghost" data-open-operation="materialDeliveryV15">Entrega de empaque o refacción</button><button class="btn primary" data-open-operation="appointmentV14">Recolección de materia prima</button></div>':''}</div>
      <div class="metric-grid">${metric('Pedidos o entregas por llegar',n(upcoming.length),'▤','Agenda próxima')}${metric('Citas por confirmar',n(upcoming.filter(x=>/PLANNED|SENT|POR CONFIRMAR/i.test(x.status)).length),'◷','Dar seguimiento','warning')}${metric('Materiales necesarios',n(needs.length),'!','Faltantes del plan',needs.length?'danger':'')}${metric('Llegadas retrasadas',n(upcoming.filter(x=>Number(x.delayMinutes)>0).length),'⌛','Fuera de horario',upcoming.some(x=>Number(x.delayMinutes)>0)?'danger':'')}</div>
      <section class="card"><div class="card-head"><div><h3>Recolecciones de materia prima</h3><p>Logística asigna unidad, conductor, contenedores y horario después de que Compras guarda la cita.</p></div></div>${table(['Semana','Solicitud','Recolección / prefolio','Proveedor y origen','Materia prima','Cantidad','Cita','Orden de compra','Estado'],collections.map(x=>[x.weekNumber,x.requestDate,cell(x.planNumber,x.prelot),cell(x.supplier,x.origin),x.item,`${n(x.expectedQty)} ${unitLabel(x.uom)}`,x.appointmentAt,x.purchaseOrder||'Sin referencia',badge(x.status)]),'No hay recolecciones programadas.')}</section>
      <section class="card"><div class="card-head"><div><h3>WID · mercancía esperada</h3><p>No afecta existencias hasta que Almacén confirme la recepción.</p></div></div>${table(['Cita','Pre-lote','Fecha','Proveedor','Material','Almacén destino','Esperado','Recibido','Pendiente','Estado'],expected.map(x=>[folio(x.appointment),folio(x.prelot),x.scheduled,x.supplier,cell(x.item,x.sku),x.warehouse,`${n(x.expected_qty)} ${x.uom}`,`${n(x.received_qty)} ${x.uom}`,`${n(x.pending_qty)} ${x.uom}`,badge(x.status)]),'No hay mercancía esperada en WID.')}</section>
      <div class="equal-grid">
        <section class="card"><div class="card-head"><div><h3>Próximas llegadas</h3><p>Proveedor, material, fecha y situación de la cita.</p></div></div>${table(['Cita','Fecha y hora','Proveedor','Material','Estado'],upcoming.map(x=>[folio(x.id),x.scheduled,x.supplier,x.material,badge(x.status)]),'No hay entregas programadas.')}</section>
        <section class="card"><div class="card-head"><div><h3>Necesidades de compra</h3><p>Faltantes calculados a partir del Forecast y las listas de materiales.</p></div></div>${table(['Material','Cantidad faltante','Fecha requerida','Proveedor sugerido'],needs.map(x=>[cell(x.item,x.sku),`${n(x.shortage)} ${x.uom}`,dateFmt(x.needDate),x.supplier]),'Ejecuta el cálculo de necesidades para obtener sugerencias.')}</section>
      </div>`;
  }

  function renderLogistics() {
    const rows=filterRows(state.data.collections||[],['planNumber','appointment','supplier','origin','item','vehicle','driver','status']);
    const vehicles=state.data.lookups?.vehicles||[];
    const site=state.data.logisticsSite;
    const canManage=can('LOGISTICS','CREATE')||can('LOGISTICS','UPDATE');
    $('#view').innerHTML=`<div class="section-head"><div><h2>Coordinación de recolecciones</h2><p class="muted">Compras genera la solicitud. Aquí asignas unidad, conductor, contenedores y horario sin volver a capturar los datos comerciales.</p></div>${canManage?`<div class="actions"><button class="btn ghost" data-open-operation="logisticsSiteV15">${site?'Actualizar destino en planta':'Configurar destino en planta'}</button><button class="btn primary" data-open-operation="vehicleV15">Registrar unidad</button></div>`:''}</div>
      <div class="metric-grid">${metric('Por asignar',n(rows.filter(x=>!x.driverUserId).length),'!','Sin unidad o conductor',rows.some(x=>!x.driverUserId)?'warning':'')}${metric('Programadas',n(rows.filter(x=>['CONFIRMED','PLANNED'].includes(x.status)).length),'◷','Pendientes de recorrido')}${metric('En ruta',n(rows.filter(x=>x.status==='IN_ROUTE').length),'⇢','Ubicación más reciente')}${metric('Unidades activas',n(vehicles.length),'▤','Catálogo de Logística')}</div>
      ${!site?'<div class="notice page-gap"><strong>Configura una sola vez el destino en planta</strong><p>La latitud y longitud permiten calcular la ruta y hora estimada de llegada. El conductor siempre deberá autorizar la ubicación en su dispositivo.</p></div>':''}
      <section class="card page-gap"><div class="card-head"><div><h3>Recolecciones de materia prima</h3><p>El botón Asignar aparece sólo para coordinación.</p></div></div>${table(['Recolección','Proveedor y origen','Materia prima','Cita','Presentación','Unidad y conductor','Llegada estimada','Estado',''],rows.map(x=>[cell(x.planNumber,x.prelot),cell(x.supplier,x.origin),cell(x.item,`${n(x.expectedQty)} ${unitLabel(x.uom)}`),x.appointmentAt,presentationLabel(x.presentation,x.binCount),cell(x.vehicle,x.driver),x.plantEta||'Por calcular',badge(x.status),canManage&&!['COMPLETED','CANCELLED'].includes(x.status)?trusted(`<button class="btn primary small" data-assign-collection="${h(x.id)}">Asignar</button>`):'Sólo consulta']),'No hay recolecciones programadas.')}</section>
      <section class="card page-gap"><div class="card-head"><div><h3>Unidades</h3><p>Vehículo, placas, capacidad y conductor habitual.</p></div></div>${table(['Unidad','Placas','Tipo','Transportista','Capacidad','Conductor habitual'],vehicles.map(x=>[folio(x.unit_code),x.plate_number||'—',x.vehicle_type,x.carrier_name||'Propia',x.capacity_kg?`${n(x.capacity_kg)} kg`:'—',(state.data.lookups?.drivers||[]).find(d=>Number(d.id)===Number(x.default_driver_user_id))?.name||'Sin asignar']),'No hay unidades registradas.')}</section>`;
  }

  function renderDriverCollections() {
    const rows=filterRows(state.data.driverCollections||[],['planNumber','appointment','supplier','origin','item','vehicle','status']);
    const site=state.data.logisticsSite;
    $('#view').innerHTML=`<div class="section-head"><div><h2>Mis recolecciones asignadas</h2><p class="muted">Actualiza el recorrido con botones simples. Tu ubicación sólo se solicita al iniciar, actualizar o confirmar llegada.</p></div></div>
      ${rows.map(row=>driverCollectionCard(row,site)).join('')||'<section class="card card-pad"><h3>Sin recolecciones asignadas</h3><p class="muted">Cuando el coordinador te asigne una, aparecerá aquí y recibirás una notificación.</p></section>'}`;
  }

  function driverCollectionCard(row,site) {
    const loaded=Boolean(row.loadedAt),started=Boolean(row.routeStartedAt),arrived=row.status==='ARRIVED';
    const originQuery=encodeURIComponent(row.originAddress||row.origin||'');
    const routeLink=row.lastLatitude&&row.lastLongitude&&site?.latitude&&site?.longitude?`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${row.lastLatitude},${row.lastLongitude}`)}&destination=${encodeURIComponent(`${site.latitude},${site.longitude}`)}&travelmode=driving`:'';
    return `<section class="card trip-card"><div class="card-head"><div><p class="eyebrow">${h(row.planNumber)} · ${h(row.prelot)}</p><h3>${h(row.supplier)} · ${h(row.origin)}</h3><p>${h(row.originAddress||'Dirección pendiente de registrar')}</p></div>${badge(row.status)}</div>
      <div class="detail-grid card-pad"><div class="detail"><small>Materia prima</small><strong>${h(row.item)}</strong></div><div class="detail"><small>Cantidad</small><strong>${n(row.expectedQty)} ${h(unitLabel(row.uom))}</strong></div><div class="detail"><small>Cita</small><strong>${h(row.appointmentAt)}</strong></div><div class="detail"><small>Unidad</small><strong>${h(row.vehicle)} ${row.plate?`· ${h(row.plate)}`:''}</strong></div><div class="detail"><small>Presentación</small><strong>${h(presentationLabel(row.presentation,row.binCount))}</strong></div><div class="detail"><small>Llegada estimada</small><strong>${h(row.plantEta||'Se calculará al iniciar')}</strong></div></div>
      <div class="trip-actions card-pad"><a class="btn ghost" href="https://www.google.com/maps/search/?api=1&query=${originQuery}" target="_blank" rel="noopener">Ver origen</a>${!loaded?`<button class="btn primary" data-driver-action="LOADED" data-collection-id="${h(row.id)}">Unidad cargada</button>`:''}${loaded&&!started?`<button class="btn primary" data-driver-action="START_ROUTE" data-collection-id="${h(row.id)}">Iniciar recorrido a planta</button>`:''}${started&&!arrived?`<button class="btn ghost" data-driver-action="LOCATION_UPDATE" data-collection-id="${h(row.id)}">Actualizar ubicación</button><button class="btn primary" data-driver-action="ARRIVED" data-collection-id="${h(row.id)}">Llegué a planta</button>`:''}${routeLink?`<a class="btn ghost" href="${h(routeLink)}" target="_blank" rel="noopener">Abrir ruta óptima</a>`:''}</div>
      ${routeMap(row,site)}</section>`;
  }

  function routeMap(row,site) {
    if(!row.lastLatitude||!row.lastLongitude)return '<div class="route-placeholder"><strong>Mapa del recorrido</strong><span>Aparecerá después de iniciar el recorrido y permitir la ubicación.</span></div>';
    const lat=Number(row.lastLatitude),lon=Number(row.lastLongitude),delta=.08;
    const src=`https://www.openstreetmap.org/export/embed.html?bbox=${lon-delta}%2C${lat-delta}%2C${lon+delta}%2C${lat+delta}&layer=mapnik&marker=${lat}%2C${lon}`;
    return `<div class="route-map"><iframe title="Ubicación más reciente de la unidad" loading="lazy" src="${h(src)}"></iframe><p>Última ubicación: ${h(row.lastLocationAt||'recién actualizada')}${row.routeDistanceKm?` · ${n(row.routeDistanceKm)} km restantes`:''}${row.routeDurationMinutes?` · aproximadamente ${n(row.routeDurationMinutes)} minutos`:''}${site?` · destino: ${h(site.siteName)}`:''}</p></div>`;
  }

  function renderReceiving() {
    const rows = filterRows(state.data.receipts, ['id', 'prelot', 'supplier', 'item', 'quality', 'status']);
    $('#view').innerHTML = sectionHeader('Recepciones y pre-lotes', 'Confirma la cita, genera el lote definitivo y solicita la inspección de Calidad.', 'Nueva recepción', 'receipt') + `
      <section class="card">${table(['Recepción','Pre-lote','Proveedor','Material','Esperado','Recibido','Calidad','Estado'], rows.map(x => [folio(x.id), folio(x.prelot), x.supplier, x.item, x.expected, x.received, badge(x.quality), badge(x.status)]), 'No hay recepciones con ese criterio.')}</section>`;
  }

  function renderQuality() {
    const rows = filterRows(state.data.quality, ['id', 'type', 'reference', 'item', 'lot', 'owner', 'status']);
    const queue=state.data.lookups?.qualityRequestsV14||[];const raw=state.data.rawQualityMaster||[];const extraction=state.data.extractionQualityMaster||[];const lots=state.data.lotMaster||[];
    const canDecide=can('QUALITY','APPROVE')||can('QUALITY','REJECT');
    const canCancel=can('QUALITY','UPDATE');
    const canExport=can('QUALITY','EXPORT')||can('QUALITY_ANALYTICS','EXPORT')||state.data.user.isSuperAdmin;
    $('#view').innerHTML = `<div class="section-head"><div><h2>Bandeja de Calidad</h2><p class="muted">Libera, rechaza o divide una cantidad. La existencia permanece bloqueada hasta guardar el dictamen.</p></div>${canExport||canDecide?`<div class="actions">${canExport?'<button class="btn ghost" data-export>Descargar maestro</button>':''}${canDecide?'<button class="btn primary" data-open-operation="qualityDecisionV14">Capturar resultados y dictamen</button>':''}</div>`:''}</div>
      <div class="metric-grid">${metric('Pendientes',n(queue.length),'◷','Requieren dictamen',queue.length?'warning':'')}${metric('Liberadas',n(rows.filter(x=>x.status==='COMPLETED').length),'✓','Historial visible')}${metric('Resultados de materia prima',n(raw.length),'●','Análisis registrados')}${metric('Resultados de extracción',n(extraction.length),'⌁','Muestras registradas')}</div>
      <section class="card">${table(['Solicitud','Fecha','Tipo','Referencia','Material / lote','Estado','Acciones'], rows.map(x => {const request=queue.find(q=>q.request_number===x.id);const decision=request&&canDecide?`<button class="btn primary small" data-quality-decision="${request.request_id}">Dictaminar</button>`:'';const cancel=request&&canCancel?`<button class="btn ghost small" data-quality-cancel="${request.request_id}">Cancelar</button>`:'';return [folio(x.id),x.requested,qualityRequestTypeLabel(x.type),folio(x.reference),cell(x.item,x.lot),badge(x.status),request?(decision||cancel?trusted(`<div class="row-actions">${decision}${cancel}</div>`):'Sólo consulta'):'Cerrada'];}), 'No hay solicitudes con ese criterio.')}</section>
      <section class="card page-gap"><div class="card-head"><div><h3>Resultados de materia prima</h3><p>Campos del registro de aguacate: materia seca, rendimiento, ácidos grasos libres, aceite y acidez.</p></div></div>${table(['Solicitud','Lote','Fecha','Cantidad','Materia seca equipo','Materia seca pulpa','Rendimiento pulpa','Ácidos grasos libres','Aceite extraído','Acidez','Dictamen'],raw.map(x=>[folio(x.requestNumber),x.lot,dateFmt(x.sampleDate),`${n(x.quantityKg)} kg`,pct(x.dryMatterEquipmentPct),pct(x.dryMatterPulpMethodPct),pct(x.pulpYieldSoxhletPct),pct(x.freeFattyAcidsPct),n(x.extractedOilQty),pct(x.acidityPct),badge(x.disposition)]),'No hay resultados de materia prima.')}</section>
      <section class="card page-gap"><div class="card-head"><div><h3>Resultados de extracción</h3><p>Muestra, turno, molienda, aceite, materia seca y humedad con lote de proceso vinculado.</p></div></div>${table(['Proceso','Muestra','Fecha','Turno','Tipo','Fruta por turno','Molienda/meta','Aceite base húmeda','Aceite base seca','Aceite obtenido','Materia seca','Humedad','Dictamen'],extraction.map(x=>[folio(x.processLot),folio(x.sampleLot),dateFmt(x.sampleDate),x.shift,sampleTypeLabel(x.sampleType),`${n(x.fruitPerShiftKg)} kg`,pct(x.grindingAgainstTargetPct),pct(x.oilWetBasisPct),pct(x.oilDryBasisPct),n(x.oilObtainedQty),pct(x.dryMatterPct),pct(x.humidityPct),badge(x.disposition)]),'No hay resultados de extracción.')}</section>
      <section class="card page-gap"><div class="card-head"><div><h3>Maestro de lotes</h3><p>Origen, lote padre y estado de Calidad para auditoría y exportación.</p></div></div>${table(['Lote','Producto','Origen','Lotes padre','Calidad','Estado'],lots.slice(0,300).map(x=>[folio(x.lot),cell(x.item,x.sku),cell(x.supplier,x.origin),x.parentLots,badge(x.qualityStatus),badge(x.lotStatus)]),'No hay lotes registrados.')}</section>`;
  }

  function renderInventory() {
    const rows = filterRows(state.data.inventory, ['sku', 'item', 'type', 'warehouse', 'lot', 'status']);
    const totalAvailable = rows.reduce((sum, x) => sum + Number(x.available), 0);
    $('#view').innerHTML = sectionHeader('Inventario disponible', 'Consulta botellas, tapas, etiquetas, cajas, fruta, aceites, refacciones y producto terminado por su nombre.', 'Nuevo movimiento', 'movement', true) + `
      <div class="metric-grid">${metric('Registros visibles', n(rows.length), '▦', 'Por producto, lote y ubicación')}${metric('Disponible acumulado', n(totalAvailable), '✓', 'Unidades mixtas; consultar detalle')}${metric('Sin disponible', n(rows.filter(x => x.available <= 0).length), '!', 'Requieren atención', 'danger')}${metric('En nivel bajo', n(rows.filter(x => ['Crítico','Bajo'].includes(x.status)).length), '◷', 'Contra mínimo y punto de reorden', 'warning')}</div>
      <section class="card">${inventoryTable(rows)}</section>`;
  }

  function renderMovements() {
    const rows = filterRows(state.data.movements, ['id', 'date', 'type', 'sku', 'lot', 'location', 'user', 'status']);
    $('#view').innerHTML = sectionHeader('Kardex de movimientos', 'Los movimientos contabilizados son inmutables; cualquier corrección se registra mediante una auditoría o un movimiento compensatorio.', 'Registrar entrada o salida', 'warehouseMovementV18', true) + `<section class="card">${movementTable(rows)}</section>`;
  }

  function renderForecast() {
    const rows = filterRows(state.data.forecast, ['customer', 'sku', 'item', 'impact', 'status']);
    const orders=filterRows(state.data.forecastVsProduction||[],['period','sku','item']);
    const weekly=filterRows(state.data.weeklyForecast||[],['weekStart','sku','name']);
    const changed = rows.filter(x => Number(x.delta) !== 0).length;
    const increased = rows.filter(x => Number(x.delta) > 0).length;
    $('#view').innerHTML = sectionHeader('Forecast original vs. vigente', 'Importa Excel; cada carga conserva la versión anterior y valida los códigos de producto terminado.', 'Importar archivo de Excel', 'forecastImport', true) + `
      <div class="equal-grid"><section class="card card-pad"><p class="eyebrow">COMPARACIÓN</p><h3>${n(rows.length)} líneas vigentes</h3><p>Plan original contra la versión marcada como actual.</p></section><section class="card card-pad"><p class="eyebrow">IMPACTO</p><h3>${n(changed)} cambios detectados</h3><p>${n(increased)} incrementos que deben volver a evaluarse en MRP.</p></section></div>
      <section class="card page-gap"><div class="card-head"><div><h3>Plan semanal calculado</h3><p>El total mensual se reparte por los días laborables de cada semana sin alterar el total de botellas.</p></div></div>${table(['Semana','Producto terminado','Botellas del Forecast','Órdenes reales','Pendiente por ordenar'],weekly.map(x=>[dateFmt(x.weekStart),cell(x.name,x.sku),n(x.forecastQty),n(x.orderedQty),n(Math.max(0,Number(x.forecastQty)-Number(x.orderedQty)))]),'No hay distribución semanal. Importa la migración 008 o una nueva versión del Forecast.')}</section>
      <section class="card page-gap">${table(['Cliente','Producto terminado','Original','Vigente','Cambio','Impacto','Cobertura'], rows.map(x => [x.customer, cell(x.item, `Código: ${x.sku}`), numCell(x.original), numCell(x.current), delta(x.delta), x.impact, badge(x.status)]), 'No hay cambios con ese criterio.')}</section>
      <section class="card page-gap"><div class="card-head"><div><h3>Forecast contra órdenes reales de producción</h3><p>Las órdenes de Envasado representan lo que realmente se programó fabricar; el terminado muestra lo ya producido.</p></div></div>${table(['Periodo','Producto terminado','Forecast','Ordenado','Terminado','Pendiente por ordenar','Cobertura de órdenes'],orders.map(x=>[x.period,cell(x.item,x.sku),n(x.forecastQty),n(x.orderedQty),n(x.completedQty),n(x.pendingToOrder),badge(`${n(x.orderCoverage||0)}%`)]),'Importa el Forecast y crea órdenes de producción para comparar.')}</section>`;
  }

  function renderMrp() {
    const rows = filterRows(state.data.mrp, ['item', 'sku', 'needDate', 'action', 'status']);
    const weekly=filterRows(state.data.weeklyMaterialNeeds||[],['weekStart','sku','name','itemType']);
    const shortages = rows.filter(x => Number(x.shortage) > 0);
    const coveragePct = rows.length ? Math.round((rows.length - shortages.length) / rows.length * 100) : 0;
    const canRecalculate=state.data.user.isSuperAdmin||can('MRP','CREATE')||can('MRP','UPDATE')||can('MRP','POST');
    $('#view').innerHTML = `<div class="section-head"><div><h2>Necesidades calculadas</h2><p class="muted">Se recalculan automáticamente al importar un Forecast, cambiar una lista de materiales o afectar existencias.</p></div>${canRecalculate?'<button class="btn primary" data-recalculate-mrp>Recalcular necesidades</button>':''}</div>` + `
      <div class="metric-grid">${metric('Necesidades', n(rows.length), '∑', 'Último cálculo completado')}${metric('Faltantes', n(shortages.length), '!', 'Materiales con necesidad neta', shortages.length ? 'danger' : '')}${metric('Cantidad faltante', n(shortages.reduce((sum, x) => sum + Number(x.shortage || 0), 0)), '▤', 'Consultar unidades por renglón')}${metric('Cobertura de renglones', `${n(coveragePct)}%`, '✓', 'Sin faltante neto', coveragePct < 75 ? 'warning' : '')}</div>
      <section class="card"><div class="card-head"><div><h3>Proyección semana por semana</h3><p>Existencia inicial + llegadas planeadas − consumo del Forecast. El saldo se arrastra a la semana siguiente.</p></div></div>${table(['Semana','Material','Inicial','Llegadas','Necesario','Saldo proyectado','Faltante'],weekly.map(x=>[dateFmt(x.weekStart),cell(x.name,x.sku),`${n(x.startingQty)} ${unitLabel(x.uom)}`,`${n(x.arrivingQty)} ${unitLabel(x.uom)}`,`${n(x.requiredQty)} ${unitLabel(x.uom)}`,numCell(x.projectedQty,Number(x.projectedQty)<0?'negative':'positive'),Number(x.shortageQty)>0?trusted(`<span class="negative">${n(x.shortageQty)} ${h(unitLabel(x.uom))}</span>`):'Cubierto']),'Asigna las formulaciones de aceite para sumar las necesidades de materias primas.')}</section>
      <section class="card page-gap">${table(['Material','Requerido mensual','Disponible','Entradas','Faltante','Fecha necesidad','Acción sugerida','Estado'], rows.map(x => [cell(x.item, `Código: ${x.sku}`), numCell(x.required), numCell(x.available), numCell(x.incoming), numCell(x.shortage, x.shortage > 0 ? 'negative' : 'positive'), dateFmt(x.needDate), x.action, badge(x.status)]), 'No hay cálculo mensual disponible.')}</section>`;
  }

  function renderBomManagement() {
    const assignments=filterRows(state.data.bomAssignments||[],['sku','name','oilFormula','status']);
    const formulas=filterRows(state.data.oilFormulations||[],['code','name','componentSku','component']);
    const pending=assignments.filter(x=>x.status==='PENDING_FORMULATION');
    const canEdit=state.data.user.isSuperAdmin||can('BOM_MANAGEMENT','UPDATE');
    $('#view').innerHTML=`<div class="section-head"><div><h2>Listas de materiales y formulaciones</h2><p class="muted">Cada producto conserva su empaque y presentación. Sólo falta confirmar qué formulación de aceite utiliza.</p></div>${canEdit?'<div class="actions"><button class="btn ghost" data-open-operation="packagingComponentV18">Cambiar empaque</button><button class="btn primary" data-open-operation="productFormulaV18">Asignar formulación</button></div>':''}</div>
      <div class="metric-grid">${metric('Productos oficiales',n(new Set(assignments.map(x=>x.itemId)).size),'▤','Catálogo depurado')}${metric('Pendientes de formulación',n(pending.length),'!','Requieren una decisión',pending.length?'warning':'')}${metric('Formulaciones disponibles',n(new Set(formulas.map(x=>x.versionId)).size),'⌘','Versionadas')}${metric('Asignaciones completas',n(assignments.filter(x=>x.status==='ACTIVE').length),'✓','Listas combinadas')}</div>
      ${pending.length?'<div class="notice page-gap"><strong>Confirmación necesaria</strong><p>Los archivos no contienen la relación producto terminado → formulación de aceite. Por seguridad no se inventó. Selecciona la formulación correcta antes de crear órdenes para cada producto.</p></div>':''}
      <section class="card page-gap"><div class="card-head"><div><h3>Producto terminado y lista vigente</h3><p>Los cambios futuros crean una nueva versión; las órdenes anteriores conservan la suya.</p></div></div>${table(['Producto terminado','Presentación','Empaques','Formulación de aceite','Vigencia','Estado'],assignments.map(x=>[cell(x.name,x.sku),`${n(x.presentationMl)} ml`,n(x.packagingComponents),x.oilFormula||'Por confirmar',dateFmt(x.effectiveFrom),badge(x.status)]),'Importa primero migration_v1_8.sql.')}</section>
      <section class="card page-gap"><div class="card-head"><div><h3>Formulaciones importadas</h3><p>Porcentaje de cada aceite base; el sistema lo convierte a litros según la presentación del producto.</p></div></div>${table(['Formulación','Versión','Aceite componente','Porcentaje','Unidad'],formulas.map(x=>[cell(x.name,x.code),x.versionNo,cell(x.component,x.componentSku),`${n(x.percentage)}%`,unitLabel(x.uom)]),'No hay formulaciones importadas.')}</section>`;
  }

  function renderPlannedArrivals() {
    const rows=filterRows(state.data.plannedArrivals||[],['number','plannedWeek','sku','item','warehouse','supplier','status']);
    const canCreate=state.data.user.isSuperAdmin||can('PLANNED_ARRIVALS','CREATE');
    $('#view').innerHTML=`<div class="section-head"><div><h2>Llegadas planeadas</h2><p class="muted">Registra material confirmado por llegar para incorporarlo a la proyección semanal. No afecta existencias hasta la recepción real.</p></div>${canCreate?'<button class="btn primary" data-open-operation="plannedArrivalV18">Registrar llegada</button>':''}</div>
      <div class="metric-grid">${metric('Planeadas',n(rows.filter(x=>x.status==='PLANNED').length),'◷','Aún sin recepción')}${metric('Con cita',n(rows.filter(x=>x.status==='APPOINTMENT_CREATED').length),'▤','Vinculadas a Compras')}${metric('Recibidas',n(rows.filter(x=>x.status==='RECEIVED').length),'✓','Ya contabilizadas')}${metric('Registros',n(rows.length),'⇣','Horizonte completo')}</div>
      <section class="card">${table(['Folio','Semana','Material','Cantidad','Almacén','Proveedor','Estado'],rows.map(x=>[folio(x.number),dateFmt(x.plannedWeek),cell(x.item,x.sku),`${n(x.expectedQty)} ${unitLabel(x.uom)}`,x.warehouse,x.supplier,badge(x.status)]),'No hay llegadas planeadas.')}</section>`;
  }

  function renderProduction() {
    const rows = filterRows(state.data.production, ['id', 'item', 'customer', 'material', 'status']);
    $('#view').innerHTML = sectionHeader('Órdenes de producción', 'Comprueba materiales, reserva existencias y comunica el riesgo de cumplimiento a Ventas.', 'Nueva orden', null, true) + `
      <section class="card">${table(['Orden','Producto','Cliente','Planeado','Terminado','Ventana','Materiales','Estado'], rows.map(x => [folio(x.id), x.item, x.customer, x.planned, x.completed, x.date, badge(x.material), badge(x.status)]), 'No hay órdenes con ese criterio.')}</section>`;
  }

  function renderTrace() {
    if (!state.demo) {
      const result = state.traceResult;
      const details = result ? `<section class="card card-pad"><div class="detail-grid"><div class="detail"><small>Lote</small><strong>${h(result.lot.lot_code)}</strong></div><div class="detail"><small>Código del producto</small><strong>${h(result.lot.sku)}</strong></div><div class="detail"><small>Producto o material</small><strong>${h(result.lot.item)}</strong></div><div class="detail"><small>Calidad</small><strong>${h(result.lot.quality_status)}</strong></div><div class="detail"><small>Proveedor</small><strong>${h(result.lot.supplier || 'Sin proveedor')}</strong></div><div class="detail"><small>Origen</small><strong>${h(result.lot.origin || 'Sin origen')}</strong></div></div></section><section class="card page-gap">${table(['Proceso','Lote origen','Lote resultado','Cantidad utilizada','Contribución'], result.edges.map(x => [folio(x.batch_code), folio(x.parent_lot_code), folio(x.child_lot_code), n(x.parent_qty_used), x.contribution_pct == null ? '—' : `${n(x.contribution_pct)}%`]), 'El lote existe, pero todavía no tiene vínculos de transformación.')}</section>` : '<section class="card card-pad"><div class="empty"><strong>Busca un lote</strong>Se mostrarán sus datos y vínculos de transformación ascendentes y descendentes.</div></section>';
      $('#view').innerHTML = `<div class="section-head"><div><h2>Historia completa del lote</h2><p class="muted">Consulta desde el proveedor hasta los lotes resultantes de extracción y envasado.</p></div><div class="filters"><input id="trace-search" aria-label="Código de lote" placeholder="Código exacto de lote"><button class="btn primary" id="trace-button">Buscar lote</button></div></div>${details}`;
      $('#trace-button').addEventListener('click', searchTrace);
      $('#trace-search').addEventListener('keydown', event => { if (event.key === 'Enter') searchTrace(); });
      return;
    }
    $('#view').innerHTML = `
      <div class="section-head"><div><h2>Historia completa del lote</h2><p class="muted">Consulta desde el proveedor y cada bean hasta el aceite extraído y el producto terminado.</p></div><div class="filters"><input id="trace-search" value="AGV-URU-20260905-001" aria-label="Código de lote"><button class="btn primary" id="trace-button">Buscar lote</button></div></div>
      <section class="card card-pad"><div class="trace-flow">
        ${traceNode('PRE-LOTE', 'AGV-URU-20260905-001', 'Agroproductores del Valle · Uruapan · Cita CIT-2026-0042')}
        <div class="trace-arrow">→</div>${traceNode('RECEPCIÓN', 'REC-2026-0078', '11,840 kg · 30 beans · Calidad pendiente')}
        <div class="trace-arrow">→</div>${traceNode('EXTRACCIÓN', 'EXT-20260905-02', 'Línea EX-01 · 13 beans/h · Rendimiento por confirmar')}
        <div class="trace-arrow">→</div>${traceNode('ACEITE A GRANEL', 'ACE-EXT-20260905-02', 'Tanque T-04 · Resultado de aceite vinculado')}
        <div class="trace-arrow">→</div>${traceNode('PRODUCTO TERMINADO', 'PT-20260908-01', 'AOVE 500 ml · OP-2026-0188')}
      </div></section>
      <div class="equal-grid page-gap"><section class="card card-pad"><h3>Beans vinculados</h3><p>BN-0182 a BN-0211 · peso individual y hora de alimentación conservados.</p>${coverage([{name:'Beans procesados',value:67,tone:'green'},{name:'Peso consumido',value:64,tone:'amber'}])}</section><section class="card card-pad"><h3>Control de extracción</h3><div class="detail-grid"><div class="detail"><small>Meta</small><strong>13 beans/h</strong></div><div class="detail"><small>Real</small><strong>12.4 beans/h</strong></div><div class="detail"><small>Contenido aceite</small><strong>Pendiente</strong></div><div class="detail"><small>Merma</small><strong>En cálculo</strong></div></div></section></div>`;
    $('#trace-button')?.addEventListener('click', () => toast('Trazabilidad localizada en los datos de muestra.'));
  }

  async function searchTrace() {
    const lotCode = $('#trace-search').value.trim();
    if (!lotCode) return toast('Escribe el código exacto del lote.', true);
    setLoading(true, 'Consultando trazabilidad…');
    try {
      state.traceResult = await api('trace', { lot_code: lotCode });
      renderTrace();
    } catch (error) { toast(error.message, true); }
    finally { setLoading(false); }
  }

  function renderShipping() {
    const rows = filterRows(state.data.shipments, ['id', 'order', 'customer', 'scheduled', 'progress', 'dock', 'status']);
    $('#view').innerHTML = sectionHeader('Surtido y embarques', 'Consulta los embarques registrados y descarga el reporte. La programación de salida se habilitará con el módulo de Ventas.', null, null, true) + `
      <section class="card">${table(['Embarque','Pedido','Cliente','Cita','Bultos','Avance','Andén','Estado'], rows.map(x => [folio(x.id), folio(x.order), x.customer, x.scheduled, n(x.packages), x.progress, x.dock, badge(x.status)]), 'No hay embarques con ese criterio.')}</section>`;
  }

  function renderReturns() {
    const rows = filterRows(state.data.returns, ['id', 'type', 'partner', 'reference', 'item', 'lot', 'reason', 'status']);
    $('#view').innerHTML = sectionHeader('Rechazos y devoluciones', 'Aísla el producto, solicita dictamen y conserva el vínculo con el movimiento original.', 'Registrar devolución', 'return', true) + `
      <section class="card">${table(['Folio','Origen','Cliente / proveedor','Referencia','Producto / lote','Cantidad','Motivo','Estado'], rows.map(x => [folio(x.id), x.type, x.partner, folio(x.reference), cell(x.item, x.lot), x.qty, x.reason, badge(x.status)]), 'No hay devoluciones con ese criterio.')}</section>`;
  }

  function renderStocktake() {
    const lookups = state.data.lookups || {};
    const selectedType=state.inventoryWarehouseType;
    const itemTypesByWarehouse={RAW_MATERIAL:['RAW_FRUIT','RAW_OTHER','BULK_OIL'],PACKAGING:['PACKAGING'],SPARE_PARTS:['SPARE_PART'],FINISHED_GOODS:['FINISHED_GOOD']};
    const allWarehouseModules=['WAREHOUSE_RAW','WAREHOUSE_PACKAGING','WAREHOUSE_SPARES','WAREHOUSE_FINISHED'];
    const scopeModules=selectedType?[warehouseModule(selectedType)]:allWarehouseModules;
    const settings=state.data.initialInventorySettings||[];
    const enabledTypes=new Set(settings.filter(x=>Number(x.enabled)===1).map(x=>(lookups.warehouses||[]).find(w=>Number(w.id)===Number(x.warehouseId))?.warehouse_type).filter(Boolean));
    const initialOpen=!settings.length||selectedType?(!settings.length||enabledTypes.has(selectedType)):settings.some(x=>Number(x.enabled)===1);
    const mayInitial=(can('INITIAL_INVENTORY','POST')||canAny(scopeModules,'POST'))&&initialOpen;
    const mayAudit=can('COUNTS','APPROVE')||canAny(scopeModules,'APPROVE');
    const maySchedule=can('COUNTS','CREATE')||canAny(scopeModules,'CREATE');
    if(state.inventoryCaptureMode==='audit'&&!mayAudit&&mayInitial)state.inventoryCaptureMode='initial';
    if(state.inventoryCaptureMode==='initial'&&!mayInitial&&mayAudit)state.inventoryCaptureMode='audit';
    const warehouses = (lookups.warehouses || []).filter(x=>(!selectedType||x.warehouse_type===selectedType)&&(state.inventoryCaptureMode!=='initial'||!settings.length||settings.some(s=>Number(s.warehouseId)===Number(x.id)&&Number(s.enabled)===1)));
    const locations = (lookups.locationsV14 || lookups.locations || []).filter(x=>!selectedType||x.warehouse_type===selectedType);
    const items = (lookups.items || []).filter(x=>!selectedType||(itemTypesByWarehouse[selectedType]||[]).includes(x.item_type));
    const isAudit = state.inventoryCaptureMode === 'audit';
    const mayCapture=isAudit?mayAudit:mayInitial;
    const history = (isAudit ? (state.data.counts || []) : (state.data.initialInventory || [])).filter(x=>!selectedType||x.warehouseType===selectedType);
    const modeButtons=[mayInitial?`<button class="${isAudit?'':'active'}" data-capture-mode="initial">Inventario inicial</button>`:'',mayAudit?`<button class="${isAudit?'active':''}" data-capture-mode="audit">Auditoría física</button>`:''].join('');
    const captureCard=mayCapture?`<section class="card card-pad capture-card">
        <div class="form-grid">
          <label>Almacén<select id="capture-warehouse" required><option value="">Selecciona un almacén</option>${warehouses.map(x=>`<option value="${h(x.id)}">${h(x.name)}</option>`).join('')}</select></label>
          <label>Fecha del levantamiento<input id="capture-date" type="date" value="${new Date().toISOString().slice(0,10)}" required></label>
          <label>Dónde está físicamente<select id="capture-location" required><option value="">Selecciona primero el almacén</option>${locations.map(x=>`<option value="${h(x.id)}" data-warehouse="${h(x.warehouse_id)}" data-location-type="${h(x.location_type)}" data-blocked="${h(x.is_blocked)}">${h(x.name)}</option>`).join('')}</select><small id="capture-location-help">Elige el almacén y el estado de Calidad; mostraremos sólo las zonas adecuadas.</small></label>
          <label>Producto o material<select id="capture-item" required><option value="">Selecciona por nombre</option>${items.map(x=>`<option value="${h(x.id)}">${h(x.name)} · ${h(x.uom_name)}</option>`).join('')}</select></label>
          <label>Lote<input id="capture-lot" maxlength="100" placeholder="Solo cuando el material controla lote"></label>
          <label>Estado de Calidad<select id="capture-quality"><option value="APPROVED">Liberado</option><option value="CONDITIONAL">Liberado con condición</option><option value="PENDING">Pendiente de revisión</option><option value="REJECTED">Rechazado y bloqueado</option></select></label>
          <label>Cantidad física<input id="capture-quantity" type="number" min="0" step="any" required><small id="capture-quantity-help">Selecciona el material para ver la unidad.</small></label>
          <label>Observaciones<input id="capture-line-notes" maxlength="500"></label>
        </div>
        <div class="dialog-actions"><button class="btn ghost" id="capture-add-line">Agregar partida</button></div>
        <div id="capture-lines" class="capture-lines">${captureLinesTable()}</div>
        <label class="field page-gap">Motivo o referencia del levantamiento<textarea id="capture-notes" rows="2" required placeholder="Ej. Inventario físico inicial autorizado por la jefatura"></textarea></label>
        <div class="dialog-actions"><button class="btn primary" id="capture-save" ${state.inventoryCaptureLines.length?'':'disabled'}>${isAudit?'Guardar auditoría y ajustar diferencias':'Contabilizar inventario inicial'}</button></div>
      </section>`:'<section class="card card-pad"><div class="empty"><strong>Consulta autorizada</strong>Tu rol puede revisar el historial, pero no contabilizar ni ajustar inventario.</div></section>';
    $('#view').innerHTML = `
      <div class="section-head"><div><h2>Levantamiento de inventario</h2><p class="muted">Captura existencias actuales sin cita de proveedor o compara un conteo físico contra el sistema.${selectedType?` Filtro: ${h(warehouseTypeLabel(selectedType))}.`:''}</p></div><div class="actions">${selectedType?'<button class="btn ghost" data-clear-stocktake>Ver todos los almacenes</button>':''}${isAudit&&mayAudit?'<button class="btn ghost" data-audit-report>Descargar diferencias</button>':''}${isAudit&&maySchedule?'<button class="btn ghost" data-open-operation="auditSchedule">Programar días</button>':''}<button class="btn ghost" data-page-link="warehouseAudits">Actualizar</button></div></div>
      ${state.data.user.isSuperAdmin&&settings.length?`<section class="card card-pad"><h3>Disponibilidad de la captura inicial</h3><p>Ciérrala cuando el saldo de apertura esté completo. Después, cualquier diferencia se registra mediante Auditoría física.</p><div class="actions page-gap">${settings.map(x=>`<button class="btn ${Number(x.enabled)?'ghost':'primary'}" data-initial-setting="${h(x.warehouseId)}" data-enabled="${Number(x.enabled)?'0':'1'}">${Number(x.enabled)?`Cerrar ${h(x.name)}`:`Reabrir ${h(x.name)}`}</button>`).join('')}</div></section>`:''}
      ${!initialOpen&&state.inventoryCaptureMode==='initial'?'<div class="notice page-gap"><strong>Inventario inicial cerrado</strong><p>El administrador lo cerró para este almacén. Usa Auditoría física para registrar un conteo y su ajuste trazable.</p></div>':''}
      ${modeButtons?`<div class="segmented" role="tablist">${modeButtons}</div>`:''}
      ${captureCard}
      <section class="card page-gap"><div class="card-head"><div><h3>${isAudit?'Auditorías realizadas':'Levantamientos realizados'}</h3><p>Historial completo por almacén y responsable.</p></div></div>${isAudit?table(['Folio','Almacén','Tipo','Fecha','Responsable','Diferencia','Estado'],history.map(x=>[folio(x.id),x.warehouse,x.scope,x.planned,x.owner,x.variance,badge(x.status)]),'No hay auditorías registradas.'):table(['Folio','Almacén','Fecha','Partidas','Cantidad','Responsable','Estado'],history.map(x=>[folio(x.id),x.warehouse,x.inventoryDate,n(x.lines),n(x.quantity),x.user,badge(x.status)]),'No hay levantamientos iniciales.')}</section>`;
    $$('[data-capture-mode]').forEach(button=>button.addEventListener('click',()=>{state.inventoryCaptureMode=button.dataset.captureMode;state.inventoryCaptureLines=[];renderPage();}));
    $('[data-clear-stocktake]')?.addEventListener('click',()=>{state.inventoryWarehouseType='';state.inventoryCaptureLines=[];renderPage();});
    if(mayCapture){
      $('#capture-warehouse').addEventListener('change', filterCaptureLocations);
      $('#capture-quality').addEventListener('change', filterCaptureLocations);
      $('#capture-item').addEventListener('change', configureCaptureQuantity);
      $('#capture-add-line').addEventListener('click', addCaptureLine);
      $('#capture-save').addEventListener('click', saveCapture);
      bindCaptureLineActions();
      if(warehouses.length===1)$('#capture-warehouse').value=warehouses[0].id;
      filterCaptureLocations();
      configureCaptureQuantity();
    }
  }

  async function recalculateMrp() {
    setLoading(true,'Recalculando necesidades…');
    try{const result=await api('createOperation',{operation_type:'mrpRecalculate',idempotency_key:crypto.randomUUID()});state.data=await api('bootstrap');toast(result.mrpRunsUpdated?`Necesidades actualizadas para ${n(result.mrpRunsUpdated)} versión(es) del Forecast.`:'No existe un Forecast vigente para recalcular.');renderPage();}
    catch(error){toast(error.message,true);}
    finally{setLoading(false);}
  }

  function filterCaptureLocations() {
    const warehouse = $('#capture-warehouse')?.value || '';
    const quality=$('#capture-quality')?.value||'APPROVED';
    const allowedTypes=quality==='REJECTED'?['REJECTED']:quality==='PENDING'?['RECEIVING','QUALITY_HOLD']:['STORAGE','PICKING'];
    $$('#capture-location option[data-warehouse]').forEach(option => { option.hidden = option.dataset.warehouse !== warehouse||!allowedTypes.includes(option.dataset.locationType); });
    if ($('#capture-location')?.selectedOptions[0]?.hidden) $('#capture-location').value = '';
    const visible=$$('#capture-location option[data-warehouse]').filter(option=>!option.hidden);
    if(visible.length===1)$('#capture-location').value=visible[0].value;
    const help=$('#capture-location-help');if(help)help.textContent=quality==='REJECTED'?'El producto quedará bloqueado y no contará como existencia disponible.':quality==='PENDING'?'Usa recepción temporal para material recién llegado que todavía espera revisión.':'Existencia disponible significa que el material está liberado y puede utilizarse.';
  }

  function addCaptureLine() {
    const warehouseId=$('#capture-warehouse').value,locationId=$('#capture-location').value,itemId=$('#capture-item').value;
    const quantity=Number($('#capture-quantity').value);if(!warehouseId||!locationId||!itemId||!Number.isFinite(quantity)||quantity<0||(state.inventoryCaptureMode==='initial'&&quantity===0))return toast(state.inventoryCaptureMode==='initial'?'La existencia inicial debe ser mayor que cero.':'Completa almacén, ubicación, material y cantidad.',true);
    const lookups=state.data.lookups;const item=lookups.items.find(x=>String(x.id)===String(itemId));const location=(lookups.locationsV14||lookups.locations||[]).find(x=>String(x.id)===String(locationId));if(!item||!location)return toast('La selección no es válida.',true);if(Number(item.decimal_places)===0&&!Number.isInteger(quantity))return toast(`${item.name} se captura en ${unitLabel(item.uom_code)} enteros.`,true);
    const lot=$('#capture-lot').value.trim();if(Number(item.lot_controlled)===1&&!lot)return toast(`Indica el lote de ${item.name}.`,true);
    const duplicate=state.inventoryCaptureLines.some(line=>String(line.item_id)===String(itemId)&&String(line.location_id)===String(locationId)&&line.lot_code===lot);if(duplicate)return toast('Ese producto, ubicación y lote ya están en el levantamiento.',true);
    state.inventoryCaptureLines.push({item_id:Number(itemId),item_name:item.name,location_id:Number(locationId),location_name:location.name,lot_code:lot,quantity,quality_status:$('#capture-quality').value,notes:$('#capture-line-notes').value.trim(),uom:item.uom_name});
    $('#capture-lines').innerHTML=captureLinesTable();$('#capture-save').disabled=false;bindCaptureLineActions();$('#capture-item').value='';$('#capture-lot').value='';$('#capture-quantity').value='';$('#capture-line-notes').value='';configureCaptureQuantity();
  }

  function configureCaptureQuantity(){const itemId=$('#capture-item')?.value||'',item=(state.data.lookups?.items||[]).find(x=>String(x.id)===String(itemId)),input=$('#capture-quantity'),help=$('#capture-quantity-help');if(!input||!help)return;if(!item){input.step='any';help.textContent='Selecciona el material para ver la unidad.';return;}const integer=Number(item.decimal_places)===0;input.step=integer?'1':'0.001';help.textContent=`Captura en ${unitLabel(item.uom_code)}${integer?' enteros':''}.`;}

  function bindCaptureLineActions(){
    $$('[data-remove-capture]').forEach(button=>button.addEventListener('click',()=>{state.inventoryCaptureLines.splice(Number(button.dataset.removeCapture),1);$('#capture-lines').innerHTML=captureLinesTable();$('#capture-save').disabled=!state.inventoryCaptureLines.length;bindCaptureLineActions();}));
  }

  function captureLinesTable() {
    const rows=state.inventoryCaptureLines;return table(['Producto o material','Ubicación','Lote','Cantidad','Calidad',''],rows.map((x,index)=>[x.item_name,x.location_name,x.lot_code||'Sin lote',`${n(x.quantity)} ${x.uom}`,qualityLabel(x.quality_status),trusted(`<button class="btn danger small" type="button" data-remove-capture="${index}">Quitar</button>`)]),'Agrega las partidas que contaste físicamente.');
  }

  async function saveCapture() {
    if(!state.inventoryCaptureLines.length)return toast('Agrega al menos una partida.',true);const notes=$('#capture-notes').value.trim();if(!notes)return toast('Escribe el motivo o referencia del levantamiento.',true);
    const payload={operation_type:state.inventoryCaptureMode==='audit'?'physicalCount':'initialInventory',warehouse_id:Number($('#capture-warehouse').value),inventory_date:$('#capture-date').value,notes,lines:state.inventoryCaptureLines};
    if(!payload.warehouse_id)return toast('Selecciona el almacén.',true);setLoading(true,state.inventoryCaptureMode==='audit'?'Comparando y ajustando…':'Contabilizando inventario inicial…');
    try{await api('createOperation',payload);state.inventoryCaptureLines=[];state.data=await api('bootstrap');toast(state.inventoryCaptureMode==='audit'?'Auditoría registrada y diferencias ajustadas.':'Inventario inicial contabilizado.');renderPage();}catch(error){toast(error.message,true);}finally{setLoading(false);}
  }

  function renderCounts() {
    const rows = filterRows(state.data.counts, ['id', 'warehouse', 'scope', 'owner', 'variance', 'status']);
    const schedules=state.data.auditSchedules||[];const auditedLines=state.data.inventoryAuditDetails||[];const differences=auditedLines.filter(row=>Math.abs(Number(row.difference))>0.000001);const reliableLines=auditedLines.length-differences.length;const reliability=auditedLines.length?Math.round((reliableLines/auditedLines.length)*10000)/100:0;
    $('#view').innerHTML = `<div class="section-head"><div><h2>Auditorías de inventario</h2><p class="muted">Programa días especiales de conteo, mide confiabilidad y documenta cada diferencia.</p></div><div class="actions"><button class="btn ghost" data-audit-report>Descargar reporte de diferencias</button><button class="btn primary" data-open-operation="auditSchedule">Programar auditorías</button></div></div>
      <div class="metric-grid">${metric('Confiabilidad',`${n(reliability)}%`,'✓',auditedLines.length?'Partidas sin diferencia':'Sin partidas auditadas',reliability<95&&auditedLines.length?'danger':'')}${metric('Programas activos',n(schedules.length),'◷','Días y horarios definidos')}${metric('Auditorías realizadas',n(rows.length),'▦','Historial conservado')}${metric('Diferencias encontradas',n(differences.length),'!',`${n(reliableLines)} de ${n(auditedLines.length)} partidas coinciden`,differences.length?'danger':'')}</div>
      <section class="card"><div class="card-head"><div><h3>Calendario semanal</h3><p>Programas de conteo por almacén y alcance.</p></div></div>${table(['Programa','Almacén','Días','Hora','Tipo','Alcance'],schedules.map(x=>[x.name,x.warehouse,weekdayLabels(x.weekdays),x.startTime,countTypeLabel(x.countType),x.scope]),'No hay auditorías programadas.')}</section>
      <section class="card page-gap"><div class="card-head"><div><h3>Diferencias recientes</h3><p>Sistema contra conteo físico, con responsable y observaciones.</p></div></div>${table(['Auditoría','Producto o material','Almacén y ubicación','Lote','Sistema','Conteo físico','Diferencia','Observaciones'],differences.slice(0,100).map(x=>[folio(x.countNumber),cell(x.item,`Código: ${x.sku}`),cell(x.warehouse,x.location),x.lot,`${n(x.systemQuantity)} ${x.uom}`,`${n(x.countedQuantity)} ${x.uom}`,delta(x.difference,x.uom),cell(x.observations,x.countedBy)]),'No se encontraron diferencias.')}</section>
      <section class="card page-gap"><div class="card-head"><div><h3>Historial de auditorías</h3><p>La captura se realiza desde Levantamiento de inventario.</p></div></div>${table(['Conteo','Almacén','Tipo','Fecha','Responsable','Resultado','Estado'], rows.map(x => [folio(x.id), x.warehouse, countTypeLabel(x.scope), x.planned, x.owner, x.variance, badge(x.status)]), 'No hay conteos con ese criterio.')}</section>`;
  }

  function renderMaintenance() {
    const rows = filterRows(state.data.maintenance, ['requestNumber', 'title', 'description', 'asset', 'location', 'technicians', 'status']);
    const canLead=state.data.user.isSuperAdmin||(state.data.user.areaCode==='MANTENIMIENTO'&&state.data.user.canManageArea);
    const canCreate=can('MAINTENANCE','CREATE');
    $('#view').innerHTML = `<div class="section-head"><div><h2>Solicitudes y tareas de Mantenimiento</h2><p class="muted">Asigna varios técnicos, registra horas, observaciones y evidencia fotográfica.</p></div>${canLead||canCreate?`<div class="actions">${canLead?'<button class="btn ghost" data-open-operation="technicianV14">Registrar técnico</button>':''}${canCreate?'<button class="btn primary" data-open-operation="maintenanceRequest">Nueva solicitud</button>':''}</div>`:''}</div>
      <section class="card">${table(['Solicitud','Trabajo','Equipo y ubicación','Prioridad','Fecha requerida','Técnicos','Horas','Evidencias','Estado','Acciones'], rows.map(x => [folio(x.requestNumber),cell(x.title,x.description),cell(x.asset,x.location||''),priorityLabel(x.priority),x.needed,x.technicians,`${n(x.actualHours)} de ${n(x.estimatedHours)} horas`,`${n(x.evidenceCount)} fotografía(s)`,badge(x.status),trusted(`<div class="row-actions"><button class="btn ghost small" data-maintenance-detail="${x.id}">Ver detalle</button>${canLead?`<button class="btn ghost small" data-maintenance-assign="${x.id}">Asignar</button>`:''}${canLead||Number(x.canRespond)===1?`<button class="btn ghost small" data-maintenance-update="${x.id}">Responder</button>`:''}</div>`)]), 'No hay solicitudes de Mantenimiento.')}</section>`;
    $$('[data-maintenance-detail]').forEach(button=>button.addEventListener('click',()=>openMaintenanceDetail(Number(button.dataset.maintenanceDetail))));
    $$('[data-maintenance-assign]').forEach(button=>button.addEventListener('click',()=>openOperation('maintenanceAssignment',{requestId:Number(button.dataset.maintenanceAssign)})));
    $$('[data-maintenance-update]').forEach(button=>button.addEventListener('click',()=>openOperation('maintenanceUpdate',{requestId:Number(button.dataset.maintenanceUpdate)})));
  }

  function openMaintenanceDetail(requestId) {
    const request=(state.data.maintenance||[]).find(row=>Number(row.id)===requestId);if(!request)return toast('No se encontró la solicitud.',true);
    const updates=(state.data.maintenanceUpdates||[]).filter(row=>Number(row.requestId)===requestId);
    const evidence=(state.data.maintenanceEvidence||[]).filter(row=>Number(row.requestId)===requestId);
    revokeEvidenceUrls();
    $('#detail-content').innerHTML=`<div class="dialog-head"><div><p class="eyebrow">${h(request.requestNumber)}</p><h2>${h(request.title)}</h2></div><button type="button" class="icon-btn" data-close-detail aria-label="Cerrar">×</button></div>
      <p>${h(request.description)}</p><div class="detail-grid"><div class="detail"><small>Área solicitante</small><strong>${h(request.requestingArea)}</strong></div><div class="detail"><small>Equipo</small><strong>${h(request.asset)}</strong></div><div class="detail"><small>Ubicación</small><strong>${h(request.location||'Sin ubicación')}</strong></div><div class="detail"><small>Fecha requerida</small><strong>${h(request.needed)}</strong></div><div class="detail"><small>Prioridad</small><strong>${h(priorityLabel(request.priority))}</strong></div><div class="detail"><small>Estado</small><strong>${h(statusLabel(request.status))}</strong></div><div class="detail span-2"><small>Técnicos asignados</small><strong>${h(request.technicians)}</strong></div><div class="detail span-2"><small>Materiales o refacciones</small><strong>${h(request.materials||'No indicados')}</strong></div></div>
      <hr class="divider"><h3>Bitácora de intervenciones</h3><div class="maintenance-timeline">${updates.map(update=>`<article><div><strong>${h(update.user)}</strong><span>${h(update.createdAt)} · ${h(statusLabel(update.status))} · ${n(update.hours)} horas</span></div><p>${h(update.observations)}</p></article>`).join('')||'<p class="muted">Todavía no hay intervenciones registradas.</p>'}</div>
      <hr class="divider"><h3>Evidencia fotográfica</h3><div class="evidence-grid">${evidence.map(file=>`<figure><div class="evidence-preview"><span>Cargando fotografía…</span><img data-evidence-image="${h(file.id)}" alt="${h(file.fileName)}"></div><figcaption><strong>${h(file.fileName)}</strong><small>${h(file.uploadedBy)} · ${h(file.uploadedAt)}</small></figcaption></figure>`).join('')||'<p class="muted">Todavía no hay evidencia fotográfica.</p>'}</div>`;
    $('#detail-content [data-close-detail]').addEventListener('click',()=>$('#detail-dialog').close());
    $('#detail-dialog').showModal();
    evidence.forEach(loadMaintenanceEvidence);
  }

  async function loadMaintenanceEvidence(file) {
    const imageElement=$(`[data-evidence-image="${CSS.escape(String(file.id))}"]`);if(!imageElement)return;
    try{const response=await fetch(`${API_URL}?action=maintenanceEvidence&id=${encodeURIComponent(file.id)}`,{headers:{Authorization:`Bearer ${state.token}`},cache:'no-store'});if(!response.ok)throw new Error('No se pudo abrir');const url=URL.createObjectURL(await response.blob());state.evidenceUrls.push(url);imageElement.src=url;imageElement.previousElementSibling?.remove();imageElement.addEventListener('click',()=>window.open(url,'_blank','noopener'));}catch{imageElement.previousElementSibling.textContent='No fue posible cargar esta fotografía.';}
  }

  function revokeEvidenceUrls(){for(const url of state.evidenceUrls)URL.revokeObjectURL(url);state.evidenceUrls=[];}

  function renderCatalogs() {
    const catalogs = [
      ['●','Materias primas y aceites','Aguacate en fruta, aceite crudo para refinar y aceite listo para envasar.','itemRaw',['ALMACEN']],
      ['▦','Materiales de empaque','Botellas, tapas, etiquetas, cajas y otros materiales de envasado.','itemPackaging',['ALMACEN']],
      ['⚙','Refacciones','Partes y refacciones requeridas por Mantenimiento y operación.','itemSpare',['ALMACEN']],
      ['✓','Producto terminado','Productos envasados con el código exacto que se utiliza en el Forecast.','itemFinished',['ALMACEN']],
      ['⌂','Almacenes','Materia prima, materiales de empaque, refacciones, proceso y producto terminado.','warehouse',['ALMACEN']],
      ['⌖','Ubicaciones','Recibo, cuarentena, almacenamiento, surtido, producción y devoluciones.','location',['ALMACEN']],
      ['◇','Proveedores','Información de Compras e iniciales únicas para el pre-lote.','supplier',['COMPRAS']],
      ['⌁','Orígenes de proveedor','Huertas, municipios y lugares de recolección.','origin',['COMPRAS']],
      ['♙','Clientes','Datos comerciales necesarios para pedidos, Forecast y devoluciones.','customer',['VENTAS']],
      ['▤','Listas de materiales','Agrega botellas, tapas, etiquetas, cajas, aceites y demás componentes por cada producto terminado.','bom',['PLANEACION','PRODUCCION','ALMACEN']],
      ['▦','Contenedores de fruta y retornables','Disponibilidad, asignación, ubicación, limpieza y mantenimiento.',null,['ALMACEN','LOGISTICA']],
      ['✓','Especificaciones de Calidad','Parámetros, límites, vigencias y métodos de prueba.',null,['CALIDAD']],
      ['⇧','Transportes','Unidades, capacidades y disponibilidad para Logística.',null,['LOGISTICA','COMPRAS']],
      ['⚙','Equipos de Mantenimiento','Máquinas y equipos vinculados con sus solicitudes.',null,['MANTENIMIENTO']],
      ['♙','Técnicos de Mantenimiento','Personas autorizadas para recibir y responder tareas.','technician',['MANTENIMIENTO']]
    ];
    const visible=state.data.user.isSuperAdmin?catalogs:catalogs.filter(item=>item[4].includes(state.data.user.areaCode));
    $('#view').innerHTML = `<div class="section-head"><div><h2>Catálogos de ${h(state.data.user.areaName)}</h2><p class="muted">Aquí aparecen únicamente los registros que corresponden a tu área.</p></div></div><div class="catalog-grid">${visible.map(([icon,title,copy,operation]) => `<article class="card catalog-card"><div class="card-icon">${icon}</div><div><h3>${h(title)}</h3><p>${h(copy)}</p></div>${operation ? `<button class="btn ghost small" data-open-operation="${operation}">Crear registro</button>` : '<span class="badge info">Siguiente etapa</span>'}</article>`).join('')||'<section class="card card-pad"><p>No hay catálogos asignados a esta área.</p></section>'}</div>${catalogRecordsMarkup()}`;
  }

  function catalogRecordsMarkup() {
    const lookups=state.data.lookups||{};const area=state.data.user.areaCode;const records=[];
    if(state.data.user.isSuperAdmin||area==='ALMACEN'){
      for(const item of lookups.items||[])records.push({catalog:'Producto o material',name:item.name,code:item.sku,detail:`${itemTypeLabel(item.item_type)} · ${unitLabel(item.uom_code)}`});
      for(const warehouse of lookups.warehouses||[])records.push({catalog:'Almacén',name:warehouse.name,code:warehouse.code,detail:warehouseTypeLabel(warehouse.warehouse_type)});
      for(const location of lookups.locations||[])records.push({catalog:'Ubicación',name:location.name,code:location.code,detail:location.warehouse_name});
    }
    if(state.data.user.isSuperAdmin||area==='COMPRAS')for(const supplier of lookups.suppliers||[])records.push({catalog:'Proveedor',name:supplier.name,code:supplier.supplier_code,detail:'Compras y abastecimiento'});
    if(state.data.user.isSuperAdmin||area==='VENTAS')for(const customer of lookups.customers||[])records.push({catalog:'Cliente',name:customer.name,code:customer.customer_code,detail:'Ventas y devoluciones'});
    if(state.data.user.isSuperAdmin||area==='MANTENIMIENTO'){
      for(const asset of lookups.assets||[])records.push({catalog:'Equipo',name:asset.asset_name,code:asset.asset_code,detail:'Mantenimiento'});
      for(const technician of lookups.technicians||[])records.push({catalog:'Técnico',name:technician.name,code:technician.email,detail:technician.specialties||'Sin especialidad indicada'});
    }
    const filtered=filterRows(records,['catalog','name','code','detail']).slice(0,200);
    return `<section class="card page-gap"><div class="card-head"><div><h3>Registros activos</h3><p>Aquí se muestran únicamente datos oficiales. Las sugerencias de captura no crean registros hasta que presiones Guardar.</p></div></div>${table(['Catálogo','Nombre','Código','Detalle'],filtered.map(row=>[row.catalog,cell(row.name,row.detail),folio(row.code),badge('Activo')]),'Todavía no hay registros activos en los catálogos de tu área.')}</section>`;
  }

  function renderUsers() {
    const rows = filterRows(state.data.users, ['name', 'email', 'area', 'role', 'modules', 'status']);
    const adminActions=state.data.user.isSuperAdmin?'<button class="btn ghost" data-open-operation="area">Nueva área</button><button class="btn ghost" data-open-operation="role">Nuevo rol</button>':'';
    $('#view').innerHTML = `<div class="section-head"><div><h2>Usuarios y accesos</h2><p class="muted">Sólo el Administrador del sistema puede crear o modificar cuentas y asignar sus módulos.</p></div><div class="actions">${adminActions}<button class="btn primary" data-open-operation="user">Nuevo usuario</button></div></div>` + `
      <section class="card">${table(['Usuario','Área','Rol','Módulos','Estado',''], rows.map(x => [cell(x.name, x.email), x.area, x.role, x.modules, badge(x.status), trusted(`<button class="btn ghost small" data-user-edit="${h(x.id)}">Configurar</button>`)]), 'No hay usuarios con ese criterio.')}</section>
      <section class="card card-pad page-gap"><h3>Separación por área</h3><p>Las casillas seleccionadas determinan las ventanas visibles. La autorización siempre se valida también en el servidor.</p></section>`;
  }

  function renderAudit() {
    const rows = filterRows(state.data.audit, ['date', 'user', 'area', 'action', 'entity', 'reference', 'detail']);
    $('#view').innerHTML = sectionHeader('Actividad del sistema', 'Consulta quién cambió qué, cuándo, desde qué área y con qué resultado.', null, null, true) + `
      <section class="card">${table(['Fecha y hora','Usuario','Área','Acción','Entidad','Referencia','Detalle'], rows.map(x => [x.date, x.user, x.area, badge(x.action), x.entity, folio(x.reference), x.detail]), 'No hay eventos con ese criterio.')}</section>`;
  }

  function sectionHeader(title, copy, actionLabel, operationType, exportButton = false) {
    return `<div class="section-head"><div><h2>${h(title)}</h2><p class="muted">${h(copy)}</p></div><div class="actions">${exportButton ? '<button class="btn ghost" data-export>⇩ Exportar CSV</button>' : ''}${actionLabel ? `<button class="btn primary" data-open-operation="${operationType || ''}">＋ ${h(actionLabel)}</button>` : ''}</div></div>`;
  }

  function inventoryTable(rows) {
    return table(['Producto o material','Tipo','Almacén','Lote','Existencia','Reservado','Disponible','Estado'], rows.map(x => [cell(x.item, `Código: ${x.sku}`), itemTypeLabel(x.type), x.warehouse, folio(x.lot), numCell(x.onHand, '', unitLabel(x.uom)), numCell(x.reserved, '', unitLabel(x.uom)), numCell(x.available, x.available <= 0 ? 'negative' : 'positive', unitLabel(x.uom)), badge(x.status)]), 'No hay existencias con ese criterio.');
  }

  function movementTable(rows, compact = false) {
    return table(['Movimiento','Fecha','Tipo','Producto o lote','Cantidad','Ubicación','Usuario','Estado'], rows.map(x => [folio(x.id), x.date, movementTypeLabel(x.type), cell(x.item||x.sku, x.item?`Código: ${x.sku} · Lote: ${x.lot}`:x.lot), delta(x.qty, unitLabel(x.uom)), x.location, x.user, badge(x.status)]), 'No hay movimientos con ese criterio.', compact ? 'compact' : '');
  }

  function table(headers, rows, emptyText, extraClass = '') {
    if (!rows.length) return `<div class="empty"><strong>Sin resultados</strong>${h(emptyText)}</div>`;
    return `<div class="table-wrap"><table class="table ${extraClass}"><thead><tr>${headers.map(x => `<th>${h(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(value => `<td>${tableValue(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  function metric(label, value, icon, note, tone = '') { return `<article class="metric ${tone}"><div class="metric-head"><span>${h(label)}</span><span class="metric-icon">${icon}</span></div><strong>${h(String(value))}</strong><small>${h(note)}</small></article>`; }
  function trusted(markup) { return { markup }; }
  function tableValue(value) { return value && typeof value === 'object' && Object.hasOwn(value, 'markup') ? value.markup : h(value ?? '—'); }
  function cell(primary, secondary) { return trusted(`<span class="primary-cell">${h(primary)}</span>${secondary ? `<span class="secondary-cell">${h(secondary)}</span>` : ''}`); }
  function folio(value) { return trusted(`<span class="folio">${h(value)}</span>`); }
  function numCell(value, className = '', uom = '') { return trusted(`<span class="${className}">${n(value)}${uom ? ` ${h(uom)}` : ''}</span>`); }
  function delta(value, uom = '') { const number = Number(value); return trusted(`<span class="${number > 0 ? 'positive' : number < 0 ? 'negative' : ''}">${number > 0 ? '+' : ''}${n(number)}${uom ? ` ${h(uom)}` : ''}</span>`); }
  function badge(value) { const label=statusLabel(value);const slug=label.toLowerCase(); let tone = 'info'; if (/aprob|confirm|complet|termin|cerrad|listo|cubiert|activo|disponible|contabilizado|entregada|liberado|verificado/.test(slug)) tone = 'good'; if (/pend|solicit|parcial|condicional|reconteo|por confirmar|por surtir|bajo|proceso|asignado|planeado/.test(slug)) tone = 'warning'; if (/rechaz|faltante|riesgo|crítico|sin existencia|retras|vencid|por devolver|cancelado/.test(slug)) tone = 'danger'; return trusted(`<span class="badge ${tone}">${h(label)}</span>`); }
  function coverage(items) { return `<div class="progress-list">${items.map(item => `<div class="progress-row"><div class="progress-label"><span>${h(item.name)}</span><strong>${n(item.value)}%</strong></div><div class="track"><div class="bar ${item.tone === 'red' ? 'red' : item.tone === 'amber' ? 'amber' : ''}" style="width:${Math.max(0, Math.min(100, item.value))}%"></div></div></div>`).join('')}</div>`; }
  function agenda(items) { return `<div class="agenda">${items.map(item => `<div class="agenda-item"><div class="agenda-time">${h(item.time)}</div><div class="agenda-rail"><span class="agenda-dot"></span></div><div class="agenda-copy"><strong>${h(item.supplier)}</strong><span>${h(item.material)} · ${h(item.dock)}</span></div></div>`).join('')}</div>`; }
  function alertRows(items) { return `<div class="alert-stack">${items.map(item => `<article class="alert-row ${item.severity}"><h4>${h(item.title)}</h4><p>${h(item.message)}</p><time>${h(item.time)}</time></article>`).join('')}</div>`; }
  function traceNode(type, code, copy) { return `<article class="trace-node"><span class="node-type">${h(type)}</span><strong>${h(code)}</strong><small>${h(copy)}</small></article>`; }

  function filterRows(rows, fields) {
    if (!state.query) return rows;
    return rows.filter(row => fields.some(field => String(row[field] ?? '').toLowerCase().includes(state.query)));
  }

  function bindCommonActions() {
    $$('[data-page-link]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.pageLink, true)));
    $$('[data-open-operation]').forEach(button => button.addEventListener('click', () => openOperation(button.dataset.openOperation,{warehouseType:button.dataset.warehouseType||''})));
    $$('[data-open-alerts]').forEach(button => button.addEventListener('click', openAlerts));
    $$('[data-export]').forEach(button => button.addEventListener('click', exportCurrentPage));
    $$('[data-executive-report]').forEach(button => button.addEventListener('click', exportExecutiveReport));
    $$('[data-audit-report]').forEach(button => button.addEventListener('click', exportInventoryAuditReport));
    $$('[data-user-edit]').forEach(button => button.addEventListener('click', () => {const selected=(state.data.users||[]).find(user=>String(user.id)===String(button.dataset.userEdit));if(!selected)return toast('No se encontró el usuario.',true);openOperation('userEdit',{user:selected});}));
    $$('[data-recalculate-mrp]').forEach(button=>button.addEventListener('click',recalculateMrp));
    $$('[data-stocktake-type]').forEach(button=>button.addEventListener('click',()=>{state.inventoryWarehouseType=button.dataset.stocktakeType||'';state.inventoryCaptureMode=button.dataset.auditMode==='audit'?'audit':'initial';state.inventoryCaptureLines=[];navigate('warehouseAudits',true);}));
    $$('[data-quality-decision]').forEach(button=>button.addEventListener('click',()=>openOperation('qualityDecisionV14',{requestId:Number(button.dataset.qualityDecision)})));
    $$('[data-quality-cancel]').forEach(button=>button.addEventListener('click',()=>openOperation('qualityCancel',{requestId:Number(button.dataset.qualityCancel)})));
    $$('[data-production-complete]').forEach(button=>button.addEventListener('click',()=>openOperation('productionCompletion',{orderId:Number(button.dataset.productionComplete)})));
    $$('[data-assign-collection]').forEach(button=>button.addEventListener('click',()=>openOperation('collectionAssignmentV15',{collectionId:Number(button.dataset.assignCollection)})));
    $$('[data-driver-action]').forEach(button=>button.addEventListener('click',()=>runDriverCollectionAction(Number(button.dataset.collectionId),button.dataset.driverAction)));
    $$('[data-initial-setting]').forEach(button=>button.addEventListener('click',()=>changeInitialInventorySetting(Number(button.dataset.initialSetting),button.dataset.enabled==='1')));
  }

  async function changeInitialInventorySetting(warehouseId,enabled){
    if(!enabled&&!confirm('¿Cerrar la captura de inventario inicial? Los saldos futuros se corregirán mediante auditorías trazables.'))return;
    setLoading(true,enabled?'Reabriendo captura inicial…':'Cerrando captura inicial…');
    try{await api('createOperation',{operation_type:'initialInventorySettingV18',warehouse_id:warehouseId,enabled,idempotency_key:crypto.randomUUID()});state.data=await api('bootstrap');toast(enabled?'Captura inicial habilitada.':'Captura inicial cerrada; las auditorías siguen disponibles.');renderPage();}catch(error){toast(error.message,true);}finally{setLoading(false);}
  }

  function renderFilling() {
    const orders=filterRows(state.data.production||[],['id','item','sku','customer','material','status','bomCode']);const boms=state.data.bomCatalog||[];const completions=state.data.productionCompletions||[];
    const canCreate=can('FILLING','CREATE')||can('PRODUCTION','CREATE');
    const canComplete=can('FILLING','POST')||can('PRODUCTION','POST')||can('WAREHOUSE_FINISHED','POST');
    $('#view').innerHTML=`<div class="section-head"><div><h2>Envasado y órdenes de producción</h2><p class="muted">Crea la orden con una lista de materiales. El sistema calcula si alcanza cada aceite, botella, tapa, sello, etiqueta y caja.</p></div>${canCreate?'<div class="actions"><button class="btn ghost" data-open-operation="bom">Agregar o modificar componente</button><button class="btn primary" data-open-operation="productionOrder">Nueva orden</button></div>':''}</div>
      <section class="card"><div class="card-head"><div><h3>Órdenes de producción</h3><p>La disponibilidad se valida al crear y nuevamente al registrar el producto terminado.</p></div></div>${table(['Orden','Producto','Lista de materiales','Planeado','Terminado','Ventana','Materiales','Estado','Acción'],orders.map(x=>[folio(x.id),cell(x.item,x.sku),x.bomCode||'Sin lista',x.planned,x.completed,x.date,badge(x.material),badge(x.status),!['COMPLETED','CLOSED','CANCELLED'].includes(x.status)&&canComplete?trusted(`<button class="btn primary small" data-production-complete="${x.internalId}">Registrar terminado</button>`):(['COMPLETED','CLOSED','CANCELLED'].includes(x.status)?'Cerrada':'Sólo consulta')]),'No hay órdenes de producción.')}</section>
      <section class="card page-gap"><div class="card-head"><div><h3>Listas de materiales activas</h3><p>Cantidades y merma esperada por producto terminado.</p></div></div>${table(['Producto terminado','Lista','Versión','Base','Componente','Cantidad','Merma'],boms.map(x=>[cell(x.product,x.productSku),folio(x.bomCode),x.versionNo,`${n(x.outputQty)} ${x.outputUom}`,cell(x.component||'Sin componentes',x.componentSku||''),x.component?`${n(x.componentQty)} ${x.componentUom}`:'—',x.component?pct(x.scrapPct):'—']),'Crea primero el producto terminado y agrega sus componentes.')}</section>
      <section class="card page-gap"><div class="card-head"><div><h3>Entradas a producto terminado</h3><p>Cada registro conserva orden, lista, lote, consumo y mermas.</p></div></div>${table(['Folio','Orden','Producto','Lote','Cantidad','Fecha','Responsable'],completions.map(x=>[folio(x.number),folio(x.productionOrder),x.item,folio(x.lot),`${n(x.completedQty)} ${x.uom}`,x.completedAt,x.completedBy]),'No hay entradas de producto terminado.')}</section>`;
  }

  function renderExtraction() {
    const rows=filterRows(state.data.extractionRuns||[],['batchCode','sourceLot','sourceItem','outputLot','outputItem','shift','qualityStatus','status']);const results=state.data.extractionQualityMaster||[];
    const canProcess=can('EXTRACTION','POST');const canExport=can('EXTRACTION','EXPORT')||state.data.user.isSuperAdmin;
    $('#view').innerHTML=`<div class="section-head"><div><h2>Extracción con trazabilidad</h2><p class="muted">Selecciona el lote real de aguacate y registra contenedores y horas. La meta operativa es 13 contenedores por hora.</p></div>${canProcess||canExport?`<div class="actions">${canExport?'<button class="btn ghost" data-export>Descargar maestro</button>':''}${canProcess?'<button class="btn primary" data-open-operation="extractionBatch">Ingresar lote a proceso</button>':''}</div>`:''}</div>
      <div class="metric-grid">${metric('Procesos registrados',n(rows.length),'⌁','Lotes de extracción')}${metric('Meta',13,'◷','Contenedores por hora')}${metric('Dentro de meta',n(rows.filter(x=>Number(x.actualBeansHour)>=13).length),'✓','Ritmo igual o superior')}${metric('Pendientes de Calidad',n(rows.filter(x=>!['COMPLETED','CANCELLED'].includes(x.qualityStatus)).length),'!','Muestras por dictaminar',rows.some(x=>!['COMPLETED','CANCELLED'].includes(x.qualityStatus))?'warning':'')}</div>
      <section class="card">${table(['Lote de proceso','Inicio','Turno','Lote de aguacate origen','Alimentación','Ritmo real','Lote de aceite','Solicitud de Calidad','Estado'],rows.map(x=>[folio(x.batchCode),x.startedAt,x.shift,cell(x.sourceLot,x.sourceItem),`${n(x.beans)} contenedores`,`${n(x.actualBeansHour)} por hora`,cell(x.outputLot,x.outputItem),badge(x.qualityStatus),badge(x.status)]),'No hay procesos de extracción.')}</section>
      <section class="card page-gap"><div class="card-head"><div><h3>Resultados analíticos vinculados</h3><p>El lote de muestra nunca sustituye al lote de origen.</p></div></div>${table(['Proceso','Muestra','Fecha','Turno','Tipo','Aceite base seca','Aceite retenido','Aceite obtenido','Materia seca','Humedad'],results.map(x=>[folio(x.processLot),folio(x.sampleLot),dateFmt(x.sampleDate),x.shift,sampleTypeLabel(x.sampleType),pct(x.oilDryBasisPct),pct(x.retainedOilPct),n(x.oilObtainedQty),pct(x.dryMatterPct),pct(x.humidityPct)]),'Todavía no hay resultados de laboratorio.')}</section>`;
  }

  async function runDriverCollectionAction(collectionId,tripAction) {
    const labels={LOADED:'Confirmando carga…',START_ROUTE:'Obteniendo ubicación e iniciando recorrido…',LOCATION_UPDATE:'Actualizando ubicación…',ARRIVED:'Confirmando llegada…'};
    setLoading(true,labels[tripAction]||'Actualizando recorrido…');
    try{
      const payload={operation_type:'driverCollectionActionV15',collection_plan_id:collectionId,trip_action:tripAction,idempotency_key:crypto.randomUUID()};
      if(tripAction!=='LOADED'){
        const location=await currentPosition();payload.latitude=location.coords.latitude;payload.longitude=location.coords.longitude;payload.accuracy_m=location.coords.accuracy;
        const site=state.data.logisticsSite;const estimate=site?await estimateRoute(payload.latitude,payload.longitude,Number(site.latitude),Number(site.longitude)):null;
        if(estimate){payload.route_distance_km=estimate.distanceKm;payload.route_duration_minutes=estimate.durationMinutes;}
      }
      await api('createOperation',payload);state.data=await api('bootstrap');toast(tripAction==='START_ROUTE'?'Recorrido iniciado. Almacén fue notificado.':tripAction==='ARRIVED'?'Llegada confirmada. Almacén fue notificado.':'Avance guardado.');renderPage();
    }catch(error){toast(error.message,true);}finally{setLoading(false);}
  }

  function currentPosition() {
    return new Promise((resolve,reject)=>{
      if(!navigator.geolocation)return reject(new Error('Este dispositivo no permite compartir ubicación.'));
      navigator.geolocation.getCurrentPosition(resolve,error=>reject(new Error(error.code===1?'Debes permitir la ubicación para iniciar o actualizar el recorrido.':'No se pudo obtener la ubicación. Revisa GPS y conexión.')),{enableHighAccuracy:true,timeout:15000,maximumAge:30000});
    });
  }

  async function estimateRoute(latitude,longitude,destinationLatitude,destinationLongitude) {
    try{const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),8000);const response=await fetch(`https://router.project-osrm.org/route/v1/driving/${longitude},${latitude};${destinationLongitude},${destinationLatitude}?overview=false&steps=false`,{signal:controller.signal});clearTimeout(timeout);if(!response.ok)return null;const result=await response.json();const route=result.routes?.[0];return route?{distanceKm:Math.round(route.distance/10)/100,durationMinutes:Math.max(1,Math.round(route.duration/60))}:null;}catch(_){return null;}
  }

  function openOperation(type, context = {}) {
    if (!type || !OPERATION_META[type]) return toast('Esta ventana no tiene una captura rápida configurada.', true);
    const form=$('#operation-form');if(!form)return toast('La interfaz no terminó de actualizarse. Presiona Ctrl+F5 y vuelve a intentarlo.',true);form.reset();state.operationContext=context;state.forecastPreview=null;state.forecastFile=null;
    $('#operation-type').value=type;const meta=OPERATION_META[type];$('#operation-kicker').textContent=meta[0];$('#operation-title').textContent=meta[1];
    renderOperationFields();$('#operation-dialog').showModal();
  }

  function renderOperationFields() {
    const type=$('#operation-type').value;const lookups=state.data?.lookups||{};let markup=operationFields[type]||'';
    if(type==='user'||type==='userEdit') markup=userFields(lookups,type==='userEdit'?state.operationContext?.user:null);
    if(['item','itemRaw','itemPackaging','itemSpare','itemFinished'].includes(type)) markup=itemFields(lookups,type);
    if(type==='warehouseModule') markup=warehouseModuleFields(state.operationContext?.warehouseType);
    if(type==='locationModule') markup=locationModuleFields(lookups,state.operationContext?.warehouseType);
    if(type==='role') markup=roleFields(lookups);
    if(type==='origin') markup=originFields(lookups);
    if(type==='bom') markup=bomFields(lookups);
    if(type==='technicianV14') markup=technicianFields(lookups);
    if(type==='maintenanceRequest') markup=maintenanceRequestFields(lookups);
    if(type==='maintenanceAssignment') markup=maintenanceAssignmentFields(lookups,state.operationContext?.requestId);
    if(type==='maintenanceUpdate') markup=maintenanceUpdateFields(lookups,state.operationContext?.requestId);
    if(type==='forecastImport') markup=forecastImportFields();
    if(type==='auditSchedule') markup=auditScheduleFields(lookups);
    if(type==='appointmentV14') markup=appointmentV14Fields(lookups);
    if(type==='materialDeliveryV15') markup=materialDeliveryV15Fields(lookups);
    if(type==='receiptV14') markup=receiptV14Fields(lookups);
    if(type==='vehicleV15') markup=vehicleV15Fields(lookups);
    if(type==='logisticsSiteV15') markup=logisticsSiteV15Fields();
    if(type==='collectionAssignmentV15') markup=collectionAssignmentV15Fields(lookups,state.operationContext?.collectionId);
    if(type==='productionOrder') markup=productionOrderFields(lookups);
    if(type==='productionCompletion') markup=productionCompletionFields(lookups,state.operationContext?.orderId);
    if(type==='extractionBatch') markup=extractionBatchFields(lookups);
    if(type==='qualityDecisionV14') markup=qualityDecisionV14Fields(lookups,state.operationContext?.requestId);
    if(type==='qualityCancel') markup=qualityCancelFields(lookups,state.operationContext?.requestId);
    if(type==='productFormulaV18') markup=productFormulaV18Fields(lookups);
    if(type==='packagingComponentV18') markup=packagingComponentV18Fields(lookups);
    if(type==='plannedArrivalV18') markup=plannedArrivalV18Fields(lookups);
    if(type==='warehouseMovementV18') markup=warehouseMovementV18Fields(lookups,state.operationContext?.warehouseType||'');
    $('#operation-fields').innerHTML=markup;
    if(type==='forecastImport') $('#forecast-file')?.addEventListener('change',analyzeForecastFile);
    bindOperationDependencies(type);
  }

  function userFields(lookups,user=null) {
    const editing=Boolean(user),protectedAdmin=Number(user?.isSystemAdmin)===1;
    const selectedModules=String(user?.moduleCodes||'').split(',').filter(Boolean);
    const accessFields=protectedAdmin?'<div class="span-2 notice"><strong>Cuenta protegida</strong><p>Es el único administrador del sistema. Puedes actualizar sus datos y contraseña, pero no quitarle el acceso total ni desactivarla.</p></div>':`<label>Área<select name="area_id" required><option value="">Selecciona el área</option>${(lookups.areas||[]).map(x=>`<option value="${h(x.id)}" ${String(x.id)===String(user?.primaryAreaId||'')?'selected':''}>${h(x.name)}</option>`).join('')}</select></label>
      <label>Rol<select name="role_code" required><option value="">Selecciona el rol</option>${(lookups.roles||[]).map(x=>`<option value="${h(x.code)}" ${String(x.code)===String(user?.roleCode||'')?'selected':''}>${h(x.name)}</option>`).join('')}</select></label>
      <fieldset class="span-2 check-field"><legend>Ventanas y módulos autorizados</legend><p>Marca únicamente las ventanas que esta persona debe utilizar.</p><div class="check-grid">${moduleChecks(lookups.modules||[],selectedModules)}</div></fieldset>`;
    return `${editing?`<input name="user_id" type="hidden" value="${h(user.id)}">`:''}<label>Nombre completo<input name="display_name" required maxlength="160" value="${h(user?.name||'')}"></label><label>Correo electrónico<input name="email" type="email" required maxlength="190" value="${h(user?.email||'')}"></label>
      <label>Teléfono<input name="phone_number" type="tel" maxlength="40" value="${h(user?.phone||'')}" placeholder="Ej. 443 000 0000"></label>${editing?`<label>Estado<select name="status" required><option value="ACTIVE" ${user.status==='ACTIVE'?'selected':''}>Activo</option>${protectedAdmin?'':`<option value="DISABLED" ${user.status==='DISABLED'?'selected':''}>Desactivado</option>`}</select></label>`:'<div></div>'}
      ${accessFields}
      <label class="span-2">${editing?'Nueva contraseña (opcional)':'Contraseña inicial segura'}<input name="password" type="password" minlength="12" autocomplete="new-password" ${editing?'':'required'}><small>${editing?'Déjala vacía para conservar la contraseña actual.':'Mínimo 12 caracteres.'}</small></label>`;
  }

  function itemFields(lookups, variant='item') {
    const typeField={itemRaw:'<label>Tipo de materia prima<select name="item_type" required><option value="RAW_FRUIT">Aguacate en fruta</option><option value="BULK_OIL">Aceite crudo, para refinar o listo para envasar</option><option value="RAW_OTHER">Otra materia prima</option></select></label>',itemPackaging:'<input name="item_type" type="hidden" value="PACKAGING">',itemSpare:'<input name="item_type" type="hidden" value="SPARE_PART">',itemFinished:'<input name="item_type" type="hidden" value="FINISHED_GOOD">'}[variant]||'<label>Tipo<select name="item_type" required><option value="RAW_FRUIT">Aguacate en fruta</option><option value="BULK_OIL">Aceite crudo, para refinar o listo para envasar</option><option value="RAW_OTHER">Otra materia prima</option><option value="PACKAGING">Material de empaque</option><option value="SPARE_PART">Refacción</option><option value="CONSUMABLE">Consumible</option><option value="FINISHED_GOOD">Producto terminado</option></select></label>';
    const example=variant==='itemFinished'?'Código exacto usado en el Forecast':variant==='itemPackaging'?'Ej. BOTELLA-VIDRIO-500-ML':'Código interno único';
    const category=variant==='item'?`<label>Categoría<select name="category_code" required><option value="">Selecciona la categoría</option>${(lookups.categories||[]).map(x=>`<option value="${h(x.code)}">${h(x.name)}</option>`).join('')}</select></label>`:'';
    const hint=variant==='itemPackaging'?'<p class="span-2 muted">Registra cada material por su nombre completo: botella, tapa, sello, etiqueta frontal, etiqueta trasera o caja.</p>':variant==='itemFinished'?'<p class="span-2 muted">El código debe coincidir exactamente con el usado en el Forecast.</p>':'';
    const suggestions={itemRaw:['Aguacate Hass en fruta','Aceite crudo de aguacate','Aceite refinado listo para envasar'],itemPackaging:['Botella de vidrio de 500 mililitros','Tapa para botella de 500 mililitros','Sello para botella de 500 mililitros','Etiqueta frontal de 500 mililitros','Etiqueta trasera de 500 mililitros','Caja para doce botellas de 500 mililitros'],itemSpare:['Rodamiento para equipo de extracción'],itemFinished:['Aceite de aguacate en botella de 500 mililitros']}[variant]||[];
    const suggestionList=suggestions.length?`<datalist id="item-name-suggestions">${suggestions.map(name=>`<option value="${h(name)}"></option>`).join('')}</datalist>`:'';
    const allowedUnits={itemRaw:['KG','L'],itemPackaging:['EA','BOX','PALLET','KG','L','ROLL','BAG','DRUM'],itemSpare:['EA','BOX','PALLET','KG','L'],itemFinished:['EA','BOX','PALLET','KG','L']}[variant]||null;
    const units=(lookups.units||[]).filter(x=>!allowedUnits||allowedUnits.includes(x.code));
    return `<label>Código del producto o material<input name="sku" required maxlength="80" placeholder="${example}"></label><label>Nombre completo<input name="item_name" required maxlength="190" ${suggestions.length?'list="item-name-suggestions"':''} placeholder="Escribe o elige una sugerencia">${suggestionList}</label>${typeField}${category}<label>Unidad base<select id="item-uom" name="uom_code" required><option value="">Selecciona la unidad</option>${units.map(x=>`<option value="${h(x.code)}">${h(x.name)}</option>`).join('')}</select><small id="item-uom-help">La unidad quedará fija para todas sus existencias.</small></label><label>Punto de reorden<input name="reorder_point" type="number" min="0" step="0.001" value="0"></label>${hint}`;
  }

  function warehouseModuleFields(warehouseType) {
    const labels={RAW_MATERIAL:['MP','Almacén de materia prima'],PACKAGING:['EMPAQUE','Almacén de materiales de empaque'],SPARE_PARTS:['REFACCIONES','Almacén de refacciones'],FINISHED_GOODS:['PT','Almacén de producto terminado']};
    const [code,name]=labels[warehouseType]||['ALMACEN','Almacén operativo'];
    return `<input name="warehouse_type" type="hidden" value="${h(warehouseType||'')}"><label>Código interno<input name="warehouse_code" required maxlength="30" placeholder="${h(code)}"><small>Se usa para trazabilidad; el usuario verá principalmente el nombre.</small></label><label>Nombre visible<input name="warehouse_name" required maxlength="120" value="${h(name)}"></label><p class="span-2 muted">Este registro representa el almacén físico oficial. Después agrega sus zonas, como existencia disponible o recepción temporal.</p>`;
  }

  function locationModuleFields(lookups,warehouseType) {
    const warehouses=(lookups.warehouses||[]).filter(x=>x.warehouse_type===warehouseType);
    return `<label class="span-2">Almacén<select name="warehouse_code" required><option value="">Selecciona el almacén físico</option>${warehouses.map(x=>`<option value="${h(x.code)}">${h(x.name)}</option>`).join('')}</select></label><label>Tipo de zona<select id="location-type" name="location_type" required><option value="STORAGE">Existencia disponible</option><option value="RECEIVING">Recepción temporal · recién llegada</option><option value="QUALITY_HOLD">Pendiente de liberación por Calidad</option><option value="PICKING">Preparación de surtido</option><option value="SHIPPING">Preparación de embarque</option><option value="REJECTED">Producto rechazado · no disponible</option></select></label><label>Código interno<input id="location-code" name="location_code" required maxlength="50" value="ALMACENAMIENTO"></label><label class="span-2">Nombre visible<input id="location-name" name="location_name" required maxlength="120" value="Existencia disponible"></label><input id="location-blocked" name="is_blocked" type="hidden" value="0"><p class="span-2 muted">La aplicación usa la zona para separar material disponible, recién recibido, pendiente de Calidad o rechazado sin perder trazabilidad.</p>`;
  }

  function roleFields(lookups) {
    return `<label>Nombre del rol<input name="role_name" maxlength="100" required placeholder="Ej. Coordinador de producto terminado"></label><label>Nivel de responsabilidad<select name="permission_profile" required><option value="VIEWER">Solo consulta</option><option value="OPERATOR">Captura y movimientos</option><option value="APPROVER">Aprobación y rechazo</option><option value="MANAGER">Jefatura completa</option></select></label><label class="span-2">Descripción<input name="description" maxlength="255"></label><fieldset class="span-2 check-field"><legend>Módulos incluidos en el rol</legend><div class="check-grid">${moduleChecks(lookups.modules||[])}</div></fieldset>`;
  }

  function bomFields(lookups) {
    const components=(lookups.items||[]).filter(item=>!['FINISHED_GOOD','SERVICE'].includes(item.item_type));
    return `<label class="span-2">Producto terminado<select name="finished_item_id" required><option value="">Selecciona el producto</option>${(lookups.finishedGoods||[]).map(item=>`<option value="${h(item.id)}">${h(item.name)} · ${h(item.sku)}</option>`).join('')}</select></label><label>Cantidad de producto terminado<input name="output_quantity" type="number" min="0.000001" step="0.000001" value="1" required><small>Base para expresar el consumo.</small></label><label>Material o materia prima<select name="component_item_id" required><option value="">Selecciona el componente</option>${components.map(item=>`<option value="${h(item.id)}">${h(item.name)} · ${h(item.sku)}</option>`).join('')}</select></label><label>Cantidad necesaria del componente<input name="component_quantity" type="number" min="0.000001" step="0.000001" required></label><label>Merma esperada en porcentaje<input name="scrap_percent" type="number" min="0" max="100" step="0.01" value="0" required></label><p class="span-2 muted">Guarda una vez por cada componente. Si ya existe, su cantidad se actualizará.</p>`;
  }

  function originFields(lookups) {
    return `<label>Proveedor<select name="supplier_code" required><option value="">Selecciona el proveedor</option>${(lookups.suppliers||[]).map(x=>`<option value="${h(x.supplier_code)}">${h(x.name)} · ${h(x.supplier_code)}</option>`).join('')}</select></label><label>Código corto del origen<input name="origin_code" required maxlength="12" placeholder="Ej. URU"></label><label class="span-2">Nombre del origen<input name="origin_name" required maxlength="160" placeholder="Ej. Huerta Uruapan"></label><label>Municipio<input name="municipality" maxlength="120"></label><label>Estado<input name="state_name" maxlength="120"></label><label class="span-2">Dirección para recolección<input name="address_text" maxlength="500" required placeholder="Calle, número, colonia, municipio y estado"></label><label>Latitud opcional<input name="latitude" type="number" min="-90" max="90" step="any" placeholder="19.4326"></label><label>Longitud opcional<input name="longitude" type="number" min="-180" max="180" step="any" placeholder="-99.1332"></label>`;
  }

  function appointmentV14Fields(lookups) {
    const warehouses=lookups.rawWarehouses||[];
    const items=lookups.rawItems||[];
    return `<div class="span-2 notice"><strong>Recolección de materia prima</strong><p>Al guardar se generan automáticamente la cita, recolección, prefolio y WID. Logística recibirá la tarea para asignar unidad y conductor.</p></div><label>Proveedor<select id="appointment-supplier" name="supplier_id" required><option value="">Selecciona el proveedor</option>${(lookups.suppliers||[]).map(x=>`<option value="${h(x.id)}">${h(x.name)} · ${h(x.supplier_code)}</option>`).join('')}</select></label><label>Origen de recolección<select id="appointment-origin" name="origin_id" required><option value="">Selecciona primero el proveedor</option>${(lookups.origins||[]).map(x=>`<option value="${h(x.id)}" data-supplier="${h(x.supplier_id)}">${h(x.origin_name)} · ${h(x.origin_code)}</option>`).join('')}</select></label><label>Materia prima<select id="appointment-item" name="item_id" required><option value="">Selecciona aguacate o aceite</option>${items.map(x=>`<option value="${h(x.id)}" data-item-type="${h(x.item_type)}" data-uom="${h(x.uom_code)}">${h(x.name)} · ${h(x.sku)} · ${h(unitLabel(x.uom_code))}</option>`).join('')}</select></label><label>Almacén destino<select id="appointment-warehouse" name="warehouse_id" required><option value="">Selecciona el almacén</option>${warehouses.map(x=>`<option value="${h(x.id)}" data-warehouse-type="${h(x.warehouse_type)}">${h(x.name)}</option>`).join('')}</select></label><label>Cantidad total a recolectar<input name="expected_qty" type="number" min="0.000001" step="any" required><small id="appointment-uom-help">Selecciona el material para ver la unidad.</small></label><label>Presentación<select id="appointment-presentation" name="transport_presentation" required><option value="">Selecciona el material primero</option></select></label><label>Fecha y hora de la cita<input name="scheduled_at" type="datetime-local" required></label><label>Duración<select name="duration"><option value="60">1 hora</option><option value="90">1 hora 30 minutos</option><option value="120">2 horas</option></select></label><label>Folio de orden de compra<input name="purchase_order_reference" maxlength="80" placeholder="Opcional"></label><label class="span-2">Comentarios de Compras<textarea name="notes" rows="3" maxlength="1000"></textarea></label>`;
  }

  function materialDeliveryV15Fields(lookups) {
    const items=lookups.deliveryItems||[];
    const warehouses=lookups.deliveryWarehouses||[];
    return `<div class="span-2 notice"><strong>Entrega directa de proveedor</strong><p>Para materiales de empaque o refacciones. Genera WID y avisa al almacén correspondiente; no crea una ruta para conductor.</p></div><label>Proveedor<select id="appointment-supplier" name="supplier_id" required><option value="">Selecciona el proveedor</option>${(lookups.suppliers||[]).map(x=>`<option value="${h(x.id)}">${h(x.name)} · ${h(x.supplier_code)}</option>`).join('')}</select></label><label>Origen<select id="appointment-origin" name="origin_id" required><option value="">Selecciona primero el proveedor</option>${(lookups.origins||[]).map(x=>`<option value="${h(x.id)}" data-supplier="${h(x.supplier_id)}">${h(x.origin_name)} · ${h(x.origin_code)}</option>`).join('')}</select></label><label>Material o refacción<select id="appointment-item" name="item_id" required><option value="">Selecciona del catálogo</option>${items.map(x=>`<option value="${h(x.id)}" data-item-type="${h(x.item_type)}" data-uom="${h(x.uom_code)}">${h(x.name)} · ${h(x.sku)} · ${h(unitLabel(x.uom_code))}</option>`).join('')}</select></label><label>Almacén destino<select id="appointment-warehouse" name="warehouse_id" required><option value="">Selecciona el material</option>${warehouses.map(x=>`<option value="${h(x.id)}" data-warehouse-type="${h(x.warehouse_type)}">${h(x.name)}</option>`).join('')}</select></label><label>Cantidad esperada<input name="expected_qty" type="number" min="0.000001" step="any" required><small id="appointment-uom-help">Selecciona el material para ver la unidad.</small></label><label>Fecha y hora de entrega<input name="scheduled_at" type="datetime-local" required></label><label>Duración<select name="duration"><option value="60">1 hora</option><option value="90">1 hora 30 minutos</option><option value="120">2 horas</option></select></label><label class="span-2">Observaciones<textarea name="notes" rows="3" maxlength="1000"></textarea></label>`;
  }

  function vehicleV15Fields(lookups) {
    return `<label>Código de unidad<input name="unit_code" required maxlength="40" placeholder="Ej. PIPA-01"></label><label>Placas<input name="plate_number" maxlength="30"></label><label>Tipo de unidad<select name="vehicle_type" required><option value="PIPA">Pipa</option><option value="TRACTOCAMION">Tractocamión</option><option value="CAMION">Camión</option><option value="CAMIONETA">Camioneta</option><option value="OTRA">Otra</option></select></label><label>Transportista<input name="carrier_name" maxlength="160" placeholder="Propia u operador logístico"></label><label>Marca o modelo<input name="make_model" maxlength="160"></label><label>Capacidad en kilogramos<input name="capacity_kg" type="number" min="0.001" step="any"></label><label class="span-2">Conductor habitual<select name="default_driver_user_id"><option value="">Sin conductor fijo</option>${(lookups.drivers||[]).map(x=>`<option value="${h(x.id)}">${h(x.name)} · ${h(x.email)}</option>`).join('')}</select></label><label class="span-2">Observaciones<textarea name="notes" rows="3" maxlength="1000"></textarea></label>`;
  }

  function logisticsSiteV15Fields() {
    const site=state.data.logisticsSite||{};
    return `<label>Nombre visible<input name="site_name" required maxlength="160" value="${h(site.siteName||'Planta Oleolab')}"></label><label class="span-2">Dirección completa<input name="address_text" required maxlength="500" value="${h(site.address||'')}"></label><label>Latitud<input name="latitude" type="number" min="-90" max="90" step="any" required value="${h(site.latitude||'')}"></label><label>Longitud<input name="longitude" type="number" min="-180" max="180" step="any" required value="${h(site.longitude||'')}"></label><p class="span-2 muted">Se configura una sola vez y se usa para estimar la ruta de regreso de todas las recolecciones.</p>`;
  }

  function collectionAssignmentV15Fields(lookups,collectionId) {
    const plans=lookups.logisticsPlans||[];
    return `<label class="span-2">Recolección<select id="logistics-plan" name="collection_plan_id" required><option value="">Selecciona la recolección</option>${plans.map(x=>`<option value="${h(x.id)}" data-item="${h(x.item)}" data-item-type="${h(x.item_type)}" data-appointment="${h(x.appointment_at)}" data-presentation="${h(x.transport_presentation||'')}" ${String(x.id)===String(collectionId)?'selected':''}>${h(x.plan_number)} · ${h(x.supplier)} · ${h(x.item)} · ${n(x.expected_qty)} ${h(unitLabel(x.uom_code))}</option>`).join('')}</select></label><label>Unidad<select id="logistics-vehicle" name="vehicle_id" required><option value="">Selecciona la unidad</option>${(lookups.vehicles||[]).map(x=>`<option value="${h(x.id)}" data-driver="${h(x.default_driver_user_id||'')}">${h(x.unit_code)} · ${h(x.plate_number||'sin placas')}</option>`).join('')}</select></label><label>Conductor<select id="logistics-driver" name="driver_user_id" required><option value="">Selecciona el conductor</option>${(lookups.drivers||[]).map(x=>`<option value="${h(x.id)}">${h(x.name)} · ${h(x.email)}</option>`).join('')}</select></label><label>Presentación<select id="logistics-presentation" name="transport_presentation" required></select></label><label>Número de contenedores<input id="logistics-bins" name="bin_count" type="number" min="0" max="1000" step="1" value="0"><small id="logistics-bins-help">Para aceites deja cero.</small></label><label>Horario de recolección<select id="appointment-time-mode" name="appointment_time_mode"><option value="ON_APPOINTMENT">Llegará en la fecha y hora de la cita</option><option value="RESCHEDULED">Usará otra fecha u hora</option></select></label><label id="pickup-reschedule" class="hidden">Nueva fecha y hora<input name="pickup_scheduled_at" type="datetime-local"></label><label>Llegada estimada inicial a planta<input name="planned_arrival" type="datetime-local"><small>Se recalculará con ubicación real al iniciar el recorrido.</small></label><label class="span-2">Comentarios de Logística<textarea name="logistics_notes" rows="3" maxlength="1000"></textarea></label>`;
  }

  function receiptV14Fields(lookups) {
    const lines=lookups.openAppointmentLines||[],locations=lookups.locationsV14||[];
    return `<label class="span-2">Partida esperada en WID<select id="receipt-line" name="appointment_line_id" required><option value="">Selecciona la cita y el material</option>${lines.map(x=>`<option value="${h(x.id)}" data-warehouse="${h(x.destination_warehouse_id)}" data-pending="${h(x.pending_qty)}">${h(x.appointment_number)} · ${h(x.supplier_name)} · ${h(x.item_name)} · pendiente ${n(x.pending_qty)} ${h(x.uom_code)}</option>`).join('')}</select></label><label>Cantidad recibida<input id="receipt-quantity" name="received_qty" type="number" min="0.000001" step="0.001" required></label><label>Ubicación de recibo o cuarentena<select id="receipt-location" name="location_id" required><option value="">Selecciona la cita</option>${locations.filter(x=>['RECEIVING','QUALITY_HOLD'].includes(x.location_type)).map(x=>`<option value="${h(x.id)}" data-warehouse="${h(x.warehouse_id)}">${h(x.warehouse_name)} · ${h(x.name)}</option>`).join('')}</select></label><label class="span-2">Observaciones<textarea name="notes" rows="3" maxlength="500"></textarea></label>`;
  }

  function productionOrderFields(lookups) {
    const products=lookups.finishedProductsV18||[];
    const selector=products.length?`<select id="production-bom" name="finished_item_id" required><option value="">Selecciona el producto terminado</option>${products.map(x=>`<option value="${h(x.id)}" data-version="${h(x.compiledBomVersionId||'')}" ${x.assignmentStatus==='ACTIVE'?'':'disabled'}>${h(x.name)} · ${h(x.sku)} · ${n(x.presentationMl)} ml${x.assignmentStatus==='ACTIVE'?'':' · falta formulación'}</option>`).join('')}</select><small>La aplicación fija automáticamente la versión vigente de empaque y aceite.</small>`:`<select id="production-bom" name="bom_version_id" required><option value="">Selecciona el producto y su lista</option>${(lookups.bomVersions||[]).map(x=>`<option value="${h(x.id)}">${h(x.output_name)} · ${h(x.output_sku)} · ${h(x.bom_code)} versión ${h(x.version_no)}</option>`).join('')}</select>`;
    return `<label class="span-2">Producto y lista de materiales${selector}</label><label>Cantidad a fabricar<input id="production-quantity" name="planned_qty" type="number" min="0.000001" step="1" required><small>Botellas o piezas terminadas.</small></label><label>Cliente opcional<select name="customer_id"><option value="">Sin cliente específico</option>${(lookups.customers||[]).map(x=>`<option value="${h(x.id)}">${h(x.name)}</option>`).join('')}</select></label><div id="bom-material-check" class="span-2 import-preview"><strong>Selecciona producto y cantidad</strong><span>Verás cada aceite, botella, tapa, etiqueta y caja necesarios.</span></div><label>Inicio planeado<input name="planned_start" type="datetime-local" required></label><label>Fin planeado<input name="planned_end" type="datetime-local" required></label>`;
  }

  function productFormulaV18Fields(lookups){
    const products=lookups.finishedProductsV18||[],formulas=lookups.oilFormulaVersionsV18||[],today=new Date().toISOString().slice(0,10);
    return `<div class="span-2 notice"><strong>Asignación versionada</strong><p>La lista de empaque ya proviene del catálogo. Selecciona únicamente la formulación correcta; la cantidad de aceite se calcula con los mililitros del producto.</p></div><label class="span-2">Producto terminado<select id="formula-product" name="finished_item_id" required><option value="">Selecciona un producto</option>${products.map(x=>`<option value="${h(x.id)}" data-status="${h(x.assignmentStatus)}">${h(x.name)} · ${h(x.sku)} · ${n(x.presentationMl)} ml${x.assignmentStatus==='PENDING_FORMULATION'?' · pendiente':''}</option>`).join('')}</select></label><label class="span-2">Formulación de aceite<select name="oil_formula_version_id" required><option value="">Selecciona la formulación</option>${formulas.map(x=>`<option value="${h(x.id)}">${h(x.name)} · versión ${h(x.versionNo)} · ${h(x.components)}</option>`).join('')}</select></label><label>Vigente desde<input id="formula-effective" name="effective_from" type="date" min="${today}" value="${today}" required><small id="formula-effective-help">La primera asignación puede iniciar hoy.</small></label><label>Motivo del cambio<input name="change_reason" maxlength="500" required placeholder="Ej. Asignación inicial validada por Producción"></label>`;
  }

  function plannedArrivalV18Fields(lookups){
    const items=lookups.plannedArrivalItemsV18||[];
    return `<div class="span-2 notice"><strong>Planeación, no inventario</strong><p>Esta llegada mejora la proyección semanal, pero no estará disponible hasta confirmar la recepción y el dictamen de Calidad.</p></div><label class="span-2">Producto o material<select id="planned-arrival-item" name="item_id" required><option value="">Selecciona del catálogo oficial</option>${items.map(x=>`<option value="${h(x.id)}" data-warehouse="${h(x.warehouseId)}" data-uom="${h(x.uom)}">${h(x.name)} · ${h(x.sku)} · ${h(x.warehouse)}</option>`).join('')}</select><input id="planned-arrival-warehouse" name="warehouse_id" type="hidden"><small id="planned-arrival-help">El almacén y la unidad se asignan automáticamente.</small></label><label>Semana de llegada<input name="planned_week" type="date" required><small>Selecciona el lunes.</small></label><label>Cantidad esperada<input name="expected_qty" type="number" min="0.000001" step="any" required></label><label>Proveedor opcional<select name="supplier_id"><option value="">Sin proveedor confirmado</option>${(lookups.suppliers||[]).map(x=>`<option value="${h(x.id)}">${h(x.name)}</option>`).join('')}</select></label><label class="span-2">Observaciones<textarea name="notes" rows="3" maxlength="1000"></textarea></label>`;
  }

  function warehouseMovementV18Fields(lookups,warehouseType=''){
    const itemWarehouseType=type=>['RAW_FRUIT','RAW_OTHER','BULK_OIL'].includes(type)?'RAW_MATERIAL':type==='PACKAGING'?'PACKAGING':type==='SPARE_PART'?'SPARE_PARTS':type==='FINISHED_GOOD'?'FINISHED_GOODS':'';
    const coreTypes=['RAW_FRUIT','RAW_OTHER','BULK_OIL','PACKAGING','FINISHED_GOOD'];
    const items=(lookups.items||[]).filter(x=>coreTypes.includes(x.item_type)&&x.item_type!=='FINISHED_GOOD'&&(!warehouseType||itemWarehouseType(x.item_type)===warehouseType));
    const stock=(lookups.availableLots||[]).filter(x=>coreTypes.includes(x.item_type)&&(!warehouseType||itemWarehouseType(x.item_type)===warehouseType));
    const directionOptions=warehouseType==='FINISHED_GOODS'?'<option value="EXIT">Salida de producto terminado</option>':'<option value="ENTRY">Entrada de material</option><option value="EXIT">Salida de material</option>';
    return `<input name="warehouse_type" type="hidden" value="${h(warehouseType)}"><div class="span-2 notice"><strong>Ubicación automática</strong><p>Las entradas pasan a Pendiente de Calidad (WID) y no se consideran disponibles hasta el dictamen. Las salidas sólo permiten elegir existencias previamente liberadas.</p></div><label class="span-2">Operación<select id="warehouse-movement-direction" name="movement_direction" required>${directionOptions}</select></label><div id="warehouse-entry-fields" class="span-2 form-grid"><label class="span-2">Producto o material<select id="warehouse-entry-item" name="item_id" required><option value="">Selecciona del catálogo oficial</option>${items.map(x=>`<option value="${h(x.id)}" data-uom="${h(x.uom_code)}" data-decimals="${h(x.decimal_places)}">${h(x.name)} · ${h(x.sku)} · ${h(unitLabel(x.uom_code))}</option>`).join('')}</select></label><label>Lote<input id="warehouse-entry-lot" name="lot_code" maxlength="100" required placeholder="Código único del lote"></label><label>Referencia opcional<input id="warehouse-entry-reference" name="reference" maxlength="100" placeholder="Factura, remisión u orden"></label></div><div id="warehouse-exit-fields" class="span-2 form-grid hidden"><label class="span-2">Existencia liberada<select id="warehouse-exit-stock" name="source_inventory_key"><option value="">Selecciona producto y lote</option>${stock.map(x=>{const item=(lookups.items||[]).find(item=>Number(item.id)===Number(x.item_id));return `<option value="${h(`${x.item_id}|${x.inventory_lot_id}|${x.warehouse_id}|${x.location_id}`)}" data-uom="${h(x.uom_code)}" data-decimals="${h(item?.decimal_places??3)}">${h(x.item_name)} · lote ${h(x.lot_code)} · disponible ${n(x.available_qty)} ${h(unitLabel(x.uom_code))}</option>`;}).join('')}</select></label></div><label>Cantidad<input id="warehouse-movement-quantity" name="quantity" type="number" min="0.000001" step="any" required><small id="warehouse-movement-help">Selecciona el material para confirmar su unidad.</small></label><label>Motivo u observaciones<input name="notes" maxlength="500" required placeholder="Ej. Entrada por compra o salida por consumo"></label>`;
  }

  function packagingComponentV18Fields(lookups){
    const products=lookups.finishedProductsV18||[],components=lookups.packagingItemsV18||[],today=new Date().toISOString().slice(0,10);
    return `<div class="span-2 notice"><strong>Cambio con vigencia</strong><p>Se crea una versión nueva; las órdenes ya creadas conservan exactamente la lista anterior.</p></div><label class="span-2">Producto terminado<select name="finished_item_id" required><option value="">Selecciona el producto</option>${products.map(x=>`<option value="${h(x.id)}">${h(x.name)} · ${h(x.sku)}</option>`).join('')}</select></label><label class="span-2">Material de empaque<select name="component_item_id" required><option value="">Selecciona botella, tapa, etiqueta, caja u otro empaque</option>${components.map(x=>`<option value="${h(x.id)}">${h(x.name)} · ${h(x.sku)} · ${h(unitLabel(x.uom))}</option>`).join('')}</select></label><label>Cantidad por una pieza terminada<input name="component_quantity" type="number" min="0.00000001" step="0.00000001" required></label><label>Vigente desde<input name="effective_from" type="date" min="${today}" value="${today}" required><small>Si ya existe una asignación activa, usa el próximo lunes.</small></label><label class="span-2">Motivo del cambio<input name="change_reason" maxlength="500" required placeholder="Ej. Sustitución de etiqueta aprobada"></label>`;
  }

  function productionCompletionFields(lookups,orderId) {
    const orders=lookups.productionOrdersV14||[];
    return `<div class="span-2 notice"><strong>Entrada automática a WID</strong><p>El producto terminado quedará bloqueado y Calidad recibirá una solicitud. Después del dictamen pasará a disponible o rechazado.</p></div><label class="span-2">Orden de producción y lista de materiales<select id="completion-order" name="production_order_id" required><option value="">Selecciona la orden</option>${orders.map(x=>`<option value="${h(x.id)}" ${String(x.id)===String(orderId)?'selected':''}>${h(x.order_number)} · ${h(x.item_name)} · lista ${h(x.bom_code)} · pendiente ${n(x.pending_qty)} ${h(x.uom_code)}</option>`).join('')}</select><small>La lista queda fijada en la orden para impedir consumir materiales de otra presentación.</small></label><label>Cantidad terminada<input name="completed_qty" type="number" min="0.000001" step="1" required></label><label>Lote de producto terminado<input name="finished_lot_code" maxlength="100" placeholder="Vacío para generar automáticamente"></label><input name="output_location_id" type="hidden" value="0"><fieldset class="span-2 check-field"><legend>Mermas reales adicionales</legend><p>Escribe únicamente la merma adicional por material; el consumo normal se calcula desde la lista.</p><div id="completion-waste-lines" class="waste-grid"></div></fieldset><label class="span-2">Observaciones<textarea name="observations" rows="3" maxlength="1000"></textarea></label>`;
  }

  function extractionBatchFields(lookups) {
    const lots=(lookups.availableLots||[]).filter(x=>x.item_type==='RAW_FRUIT');const oils=(lookups.items||[]).filter(x=>x.item_type==='BULK_OIL');const locations=lookups.locationsV14||[];
    return `<label class="span-2">Lote de aguacate de origen<select id="extraction-source" name="source_lot_id" required><option value="">Selecciona un lote disponible</option>${lots.map(x=>`<option value="${h(x.inventory_lot_id)}" data-location="${h(x.location_id)}">${h(x.lot_code)} · ${h(x.item_name)} · ${n(x.available_qty)} ${h(x.uom_code)} · ${h(x.warehouse_name)}</option>`).join('')}</select><input id="extraction-source-location" name="source_location_id" type="hidden"></label><label>Cantidad alimentada<input name="input_qty" type="number" min="0.000001" step="0.001" required></label><label>Número de contenedores<input name="beans_count" type="number" min="1" step="1" required></label><label>Horas reales de operación<input name="operating_hours" type="number" min="0.01" step="0.01" required><small>La aplicación calcula contenedores por hora contra meta 13.</small></label><label>Turno<select name="shift_code" required><option value="1">Turno 1</option><option value="2">Turno 2</option><option value="3">Turno 3</option></select></label><label>Aceite crudo resultante<select name="output_item_id" required><option value="">Selecciona el producto de proceso</option>${oils.map(x=>`<option value="${h(x.id)}">${h(x.name)} · ${h(x.sku)}</option>`).join('')}</select></label><label class="span-2">Ubicación futura del aceite<select name="output_location_id" required><option value="">Selecciona ubicación</option>${locations.filter(x=>['PROCESS','RAW_MATERIAL'].includes(x.warehouse_type)).map(x=>`<option value="${h(x.id)}">${h(x.warehouse_name)} · ${h(x.name)}</option>`).join('')}</select></label>`;
  }

  function qualityDecisionV14Fields(lookups,requestId) {
    const requests=lookups.qualityRequestsV14||[],locations=lookups.locationsV14||[];const accepted=locations.filter(x=>['STORAGE','PRODUCTION','PICKING'].includes(x.location_type)&&Number(x.is_blocked)===0),rejected=locations.filter(x=>x.location_type==='REJECTED');
    const number=(name,label,step='0.01')=>`<label>${label}<input name="${name}" type="number" step="${step}"></label>`;
    return `<label class="span-2">Solicitud pendiente<select id="quality-request" name="quality_request_id" required><option value="">Selecciona la solicitud</option>${requests.map(x=>`<option value="${h(x.request_id)}" data-request-type="${h(x.request_type)}" data-received="${h(x.received_qty)}" data-uom="${h(x.uom_code)}" data-warehouse="${h(x.warehouse_id||'')}" ${String(x.request_id)===String(requestId)?'selected':''}>${h(x.request_number)} · ${h(qualityRequestTypeLabel(x.request_type))} · ${h(x.item_name||'Sin material')} · ${h(x.lot_code||'Sin lote')}</option>`).join('')}</select><small id="quality-quantity-help">Selecciona la solicitud para conocer la cantidad.</small></label><label>Fecha de muestra<input name="sample_date" type="date" value="${new Date().toISOString().slice(0,10)}" required></label><label>Semana<input name="week_number" type="number" min="1" max="53" value="${isoWeek(new Date())}" required></label>
      <fieldset id="quality-raw-fields" class="span-2 check-field hidden"><legend>Resultados de materia prima · aguacate</legend><div class="form-grid">${number('quantity_kg','Cantidad de muestra o lote (kg)','0.001')}${number('dry_matter_equipment_pct','Materia seca · equipo Felix (%)')}${number('dry_matter_avocado_pulp_pct','Materia seca · aguacate pulpa (%)')}${number('dry_matter_pulp_method_pct','Materia seca · método de pulpa (%)')}${number('firmness_pa','Dureza (Pa)')}${number('avocado_yield_soxhlet_pct','Rendimiento de aguacate Soxhlet (%)')}${number('pulp_yield_soxhlet_pct','Rendimiento de pulpa Soxhlet (%)')}${number('free_fatty_acids_pct','Ácidos grasos libres (%)')}<label>Estado de la fruta<select name="fruit_status"><option value="">Selecciona</option><option value="RECEIVED">Recibida</option><option value="PROCESSING">En proceso</option><option value="PROCESSED">Procesada</option><option value="REJECTED">Rechazada</option></select></label><label>Fecha fin de proceso<input name="process_end_date" type="date"></label>${number('extracted_oil_qty','Cantidad de aceite extraído','0.001')}${number('acidity_pct','Acidez (%)')}</div></fieldset>
      <fieldset id="quality-extraction-fields" class="span-2 check-field hidden"><legend>Resultados de extracción</legend><div class="form-grid"><label>Turno<select name="shift_code"><option value="1">Turno 1</option><option value="2">Turno 2</option><option value="3">Turno 3</option></select></label><label>Equipo<input name="equipment_code" maxlength="50"></label><label>Tipo de muestra<select name="sample_type"><option value="PULP">Pulpa</option><option value="WET_PASTE">Pasta húmeda</option><option value="DRY_PASTE">Pasta seca</option></select></label>${number('fruit_per_shift_kg','Fruta por turno (kg)','0.001')}${number('grinding_against_target_pct','Molienda contra meta (%)')}${number('oil_wet_basis_pct','Aceite base húmeda (%)')}${number('oil_dry_basis_pct','Aceite base seca (%)')}${number('oil_in_fruit_pulp_pct','Aceite en fruta / pulpa (%)')}${number('retained_oil_pct','Aceite retenido (%)')}${number('obtaining_against_target_pct','Obtención contra meta (%)')}${number('oil_obtained_qty','Aceite obtenido','0.001')}${number('dry_matter_pct','Materia seca (%)')}${number('humidity_pct','Humedad (%)')}${number('humidity_plus_dry_matter_pct','Humedad + materia seca (%)')}</div></fieldset>
      <label>Dictamen<select id="quality-disposition" name="disposition" required><option value="APPROVED">Liberado</option><option value="CONDITIONAL">Liberado parcial o con condición</option><option value="REJECTED">Rechazado</option></select></label><label>Cantidad liberada<input id="quality-accepted" name="accepted_qty" type="number" min="0" step="0.001" required></label><label>Cantidad rechazada<input id="quality-rejected" name="rejected_qty" type="number" min="0" step="0.001" required></label><label>Ubicación liberada<select id="quality-accepted-location" name="accepted_location_id"><option value="">No aplica</option>${accepted.map(x=>`<option value="${h(x.id)}" data-warehouse="${h(x.warehouse_id)}" data-warehouse-type="${h(x.warehouse_type)}">${h(x.warehouse_name)} · ${h(x.name)}</option>`).join('')}</select></label><label>Ubicación de rechazados<select id="quality-rejected-location" name="rejected_location_id"><option value="">No aplica</option>${rejected.map(x=>`<option value="${h(x.id)}" data-warehouse="${h(x.warehouse_id)}" data-warehouse-type="${h(x.warehouse_type)}">${h(x.warehouse_name)} · ${h(x.name)}</option>`).join('')}</select></label><label class="span-2">Observaciones y justificación<textarea name="reason" rows="4" maxlength="1000" required></textarea></label>`;
  }

  function qualityCancelFields(lookups,requestId) {
    return `<label class="span-2">Solicitud<select name="quality_request_id" required><option value="">Selecciona la solicitud</option>${(lookups.qualityRequestsV14||[]).map(x=>`<option value="${h(x.request_id)}" ${String(x.request_id)===String(requestId)?'selected':''}>${h(x.request_number)} · ${h(x.item_name||'Sin material')}</option>`).join('')}</select></label><label class="span-2">Motivo de cancelación<textarea name="reason" rows="4" maxlength="500" required></textarea></label>`;
  }

  function bindOperationDependencies(type) {
    if(['user','userEdit'].includes(type)){$('[name="role_code"]')?.addEventListener('change',configureRoleModules);configureRoleModules();}
    if(['appointmentV14','materialDeliveryV15'].includes(type)){$('#appointment-supplier')?.addEventListener('change',filterAppointmentOrigins);$('#appointment-item')?.addEventListener('change',()=>{filterAppointmentWarehouses();configureAppointmentMaterial(type);});filterAppointmentOrigins();filterAppointmentWarehouses();configureAppointmentMaterial(type);}
    if(type==='collectionAssignmentV15'){$('#logistics-vehicle')?.addEventListener('change',selectDefaultDriver);$('#logistics-plan')?.addEventListener('change',configureCollectionAssignment);$('#appointment-time-mode')?.addEventListener('change',configureCollectionAssignment);configureCollectionAssignment();}
    if(type==='itemRaw'){$('[name="item_type"]')?.addEventListener('change',configureRawItemUnit);configureRawItemUnit();}
    if(type==='receiptV14'){$('#receipt-line')?.addEventListener('change',filterReceiptLocations);filterReceiptLocations();}
    if(type==='extractionBatch'){$('#extraction-source')?.addEventListener('change',()=>{$('#extraction-source-location').value=$('#extraction-source').selectedOptions[0]?.dataset.location||'';});$('#extraction-source')?.dispatchEvent(new Event('change'));}
    if(type==='qualityDecisionV14'){$('#quality-request')?.addEventListener('change',configureQualityForm);$('#quality-disposition')?.addEventListener('change',configureQualityQuantities);$('[name="oil_obtained_qty"]')?.addEventListener('input',configureQualityQuantities);configureQualityForm();}
    if(type==='productionCompletion'){$('#completion-order')?.addEventListener('change',renderCompletionWaste);renderCompletionWaste();}
    if(type==='productionOrder'){$('#production-bom')?.addEventListener('change',renderProductionMaterialCheck);$('#production-quantity')?.addEventListener('input',renderProductionMaterialCheck);renderProductionMaterialCheck();}
    if(type==='productFormulaV18'){$('#formula-product')?.addEventListener('change',configureFormulaEffective);configureFormulaEffective();}
    if(type==='plannedArrivalV18'){$('#planned-arrival-item')?.addEventListener('change',configurePlannedArrival);configurePlannedArrival();}
    if(type==='warehouseMovementV18'){$('#warehouse-movement-direction')?.addEventListener('change',configureWarehouseMovement);$('#warehouse-entry-item')?.addEventListener('change',configureWarehouseMovement);$('#warehouse-exit-stock')?.addEventListener('change',configureWarehouseMovement);configureWarehouseMovement();}
    if(type==='locationModule'){$('#location-type')?.addEventListener('change',configureLocationType);configureLocationType();}
  }

  function configureLocationType(){const type=$('#location-type')?.value||'STORAGE';const values={STORAGE:['ALMACENAMIENTO','Existencia disponible','0'],RECEIVING:['RECIBO','Recepción temporal · mercancía recién llegada','0'],QUALITY_HOLD:['CUARENTENA','Pendiente de liberación por Calidad','1'],PICKING:['SURTIDO','Preparación de surtido','0'],SHIPPING:['EMBARQUE','Preparación de embarque','0'],REJECTED:['RECHAZADO','Producto rechazado · no disponible','1']}[type];if(!values)return;$('#location-code').value=values[0];$('#location-name').value=values[1];$('#location-blocked').value=values[2];}

  function filterAppointmentOrigins(){const supplier=$('#appointment-supplier')?.value||'';$$('#appointment-origin option[data-supplier]').forEach(x=>x.hidden=x.dataset.supplier!==supplier);if($('#appointment-origin')?.selectedOptions[0]?.hidden)$('#appointment-origin').value='';}
  function configureRoleModules(){const role=$('[name="role_code"]')?.value||'',forced={DRIVER:'DRIVER_COLLECTIONS',LOGISTICS_COORDINATOR:'LOGISTICS'}[role]||'';$$('[name="module_codes"]').forEach(input=>{if(forced){input.checked=input.value===forced;input.disabled=input.value!==forced;}else input.disabled=false;});}
  function filterAppointmentWarehouses(){const type=$('#appointment-item')?.selectedOptions[0]?.dataset.itemType||'';const expected={RAW_FRUIT:'RAW_MATERIAL',RAW_OTHER:'RAW_MATERIAL',BULK_OIL:'RAW_MATERIAL',PACKAGING:'PACKAGING',SPARE_PART:'SPARE_PARTS'}[type]||'',visible=[];$$('#appointment-warehouse option[data-warehouse-type]').forEach(x=>{x.hidden=x.dataset.warehouseType!==expected;if(!x.hidden)visible.push(x);});if($('#appointment-warehouse')?.selectedOptions[0]?.hidden)$('#appointment-warehouse').value='';if(visible.length===1)$('#appointment-warehouse').value=visible[0].value;}
  function configureAppointmentMaterial(type){const option=$('#appointment-item')?.selectedOptions[0],itemType=option?.dataset.itemType||'',uom=option?.dataset.uom||'',integerUnits=['EA','BOX','BEAN','PALLET','ROLL','BAG','DRUM'];if($('#appointment-uom-help'))$('#appointment-uom-help').textContent=uom?`Captura la cantidad en ${unitLabel(uom)}${integerUnits.includes(uom)?' enteros':''}.`:'Selecciona el material para ver la unidad.';const quantity=$('[name="expected_qty"]');if(quantity)quantity.step=integerUnits.includes(uom)?'1':'any';const presentation=$('#appointment-presentation');if(!presentation||type!=='appointmentV14')return;const values=itemType==='RAW_FRUIT'?[['BINS','Contenedores de fruta'],['OTHER','Otra presentación']]:itemType?[['TANKER','Pipa'],['IBC','Contenedor intermedio'],['OTHER','Otra presentación']]:[];presentation.innerHTML=`<option value="">${values.length?'Selecciona la presentación':'Selecciona el material primero'}</option>${values.map(x=>`<option value="${x[0]}">${x[1]}</option>`).join('')}`;}
  function selectDefaultDriver(){const driver=$('#logistics-vehicle')?.selectedOptions[0]?.dataset.driver;if(driver)$('#logistics-driver').value=driver;}
  function configureCollectionAssignment(){const plan=$('#logistics-plan')?.selectedOptions[0],itemType=plan?.dataset.itemType||'',presentation=plan?.dataset.presentation||'',select=$('#logistics-presentation');const values=itemType==='RAW_FRUIT'?[['BINS','Contenedores de fruta'],['OTHER','Otra']]:[['TANKER','Pipa'],['IBC','Contenedor intermedio'],['OTHER','Otra']];if(select){select.innerHTML=values.map(x=>`<option value="${x[0]}">${x[1]}</option>`).join('');if(values.some(x=>x[0]===presentation))select.value=presentation;}const bins=$('#logistics-bins');if(bins){bins.required=itemType==='RAW_FRUIT';bins.min=itemType==='RAW_FRUIT'?'1':'0';if(itemType==='RAW_FRUIT'&&Number(bins.value)<1)bins.value='1';if(itemType!=='RAW_FRUIT')bins.value='0';}if($('#logistics-bins-help'))$('#logistics-bins-help').textContent=itemType==='RAW_FRUIT'?'Indica cuántos contenedores llevará la unidad.':'Para aceites deja cero.';const mode=$('#appointment-time-mode')?.value||'ON_APPOINTMENT';$('#pickup-reschedule')?.classList.toggle('hidden',mode!=='RESCHEDULED');const input=$('#pickup-reschedule input');if(input)input.required=mode==='RESCHEDULED';}
  function configureRawItemUnit(){const type=$('[name="item_type"]')?.value||'',select=$('#item-uom');if(!select)return;if(type==='RAW_FRUIT'){select.value='KG';select.disabled=true;if(!$('#item-uom-hidden'))select.insertAdjacentHTML('afterend','<input id="item-uom-hidden" type="hidden" name="uom_code" value="KG">');$('#item-uom-help').textContent='El aguacate en fruta siempre se registra en kilogramos.';}else{select.disabled=false;$('#item-uom-hidden')?.remove();if(!['KG','L'].includes(select.value))select.value='';$('#item-uom-help').textContent='Para aceites y otras materias primas selecciona kilogramos o litros.';}}
  function filterReceiptLocations(){const option=$('#receipt-line')?.selectedOptions[0],warehouse=option?.dataset.warehouse||'';$$('#receipt-location option[data-warehouse]').forEach(x=>x.hidden=x.dataset.warehouse!==warehouse);if($('#receipt-location')?.selectedOptions[0]?.hidden)$('#receipt-location').value='';if(option?.dataset.pending)$('#receipt-quantity').value=option.dataset.pending;}
  function configureQualityForm(){const option=$('#quality-request')?.selectedOptions[0],type=option?.dataset.requestType||'',received=Number(option?.dataset.received||0),warehouse=option?.dataset.warehouse||'';$('#quality-raw-fields')?.classList.toggle('hidden',type!=='INBOUND_FRUIT');$('#quality-extraction-fields')?.classList.toggle('hidden',type!=='IN_PROCESS');$('#quality-quantity-help').textContent=type==='IN_PROCESS'?'Captura Aceite obtenido; liberada + rechazada deben coincidir con ese resultado.':`Cantidad recibida o producida: ${n(received)} ${option?.dataset.uom||''}`;$$('#quality-accepted-location option[data-warehouse]').forEach(x=>x.hidden=type==='IN_PROCESS'?!['RAW_MATERIAL','PROCESS'].includes(x.dataset.warehouseType):x.dataset.warehouse!==warehouse);$$('#quality-rejected-location option[data-warehouse]').forEach(x=>x.hidden=type==='IN_PROCESS'?!['RAW_MATERIAL','PROCESS'].includes(x.dataset.warehouseType):x.dataset.warehouse!==warehouse);if($('#quality-accepted-location')?.selectedOptions[0]?.hidden)$('#quality-accepted-location').value='';if($('#quality-rejected-location')?.selectedOptions[0]?.hidden)$('#quality-rejected-location').value='';configureQualityQuantities();}
  function configureQualityQuantities(){const option=$('#quality-request')?.selectedOptions[0],type=option?.dataset.requestType||'',received=type==='IN_PROCESS'?Number($('[name="oil_obtained_qty"]')?.value||0):Number(option?.dataset.received||0),disposition=$('#quality-disposition')?.value||'APPROVED';$('#quality-accepted').value=disposition==='REJECTED'?0:(received||'');$('#quality-rejected').value=disposition==='REJECTED'?(received||''):0;}
  function renderProductionMaterialCheck(){const host=$('#bom-material-check');if(!host)return;const select=$('#production-bom'),versionId=Number(select?.selectedOptions[0]?.dataset.version||select?.value||0),quantity=Number($('#production-quantity')?.value||0);if(!versionId||!Number.isFinite(quantity)||quantity<=0){host.innerHTML='<strong>Selecciona producto y cantidad</strong><span>Verás cada material requerido, la existencia disponible y el faltante antes de crear la orden.</span>';return;}const components=(state.data.bomCatalog||[]).filter(x=>Number(x.versionId)===versionId&&x.componentItemId);const availability=new Map((state.data.bomAvailability||[]).map(x=>[Number(x.itemId),Number(x.availableQty||0)]));const results=components.map(component=>{const required=quantity/Number(component.outputQty||1)*Number(component.componentQty||0)*(1+Number(component.scrapPct||0)/100),available=availability.get(Number(component.componentItemId))||0,missing=Math.max(0,required-available);return {component,required,available,missing};});const rows=results.map(({component,required,available,missing})=>[cell(component.component,component.componentSku),`${n(required)} ${h(component.componentUom)}`,`${n(available)} ${h(component.componentUom)}`,missing>0?trusted(`<span class="negative">Faltan ${n(missing)}</span>`):trusted('<span class="positive">Completo</span>')]);const missingCount=results.filter(result=>result.missing>0).length;host.innerHTML=`<strong>${missingCount?`${n(missingCount)} material(es) con faltante`:'Materiales suficientes para crear la orden'}</strong><span>El servidor volverá a validar las cantidades al guardar y al registrar el producto terminado.</span>${table(['Material','Necesario','Disponible','Resultado'],rows,'Esta lista no tiene componentes.')}`;}

  function configureFormulaEffective(){const option=$('#formula-product')?.selectedOptions[0],active=option?.dataset.status==='ACTIVE',input=$('#formula-effective'),help=$('#formula-effective-help');if(!input||!help)return;const date=new Date();if(active){const days=(8-date.getDay())%7||7;date.setDate(date.getDate()+days);input.value=date.toISOString().slice(0,10);help.textContent='Los cambios posteriores comienzan el próximo lunes para proteger órdenes actuales.';}else{input.value=new Date().toISOString().slice(0,10);help.textContent='La primera asignación puede iniciar hoy.';}}

  function configurePlannedArrival(){const option=$('#planned-arrival-item')?.selectedOptions[0],warehouse=option?.dataset.warehouse||'',uom=option?.dataset.uom||'';if($('#planned-arrival-warehouse'))$('#planned-arrival-warehouse').value=warehouse;if($('#planned-arrival-help'))$('#planned-arrival-help').textContent=uom?`Se registrará en ${unitLabel(uom)} y se dirigirá al almacén correspondiente.`:'El almacén y la unidad se asignan automáticamente.';}

  function configureWarehouseMovement(){const direction=$('#warehouse-movement-direction')?.value||'ENTRY',entry=direction==='ENTRY',entryBlock=$('#warehouse-entry-fields'),exitBlock=$('#warehouse-exit-fields'),entryItem=$('#warehouse-entry-item'),entryLot=$('#warehouse-entry-lot'),entryReference=$('#warehouse-entry-reference'),exitStock=$('#warehouse-exit-stock'),quantity=$('#warehouse-movement-quantity'),option=(entry?entryItem:exitStock)?.selectedOptions[0],uom=option?.dataset.uom||'',decimals=Number(option?.dataset.decimals??3);entryBlock?.classList.toggle('hidden',!entry);exitBlock?.classList.toggle('hidden',entry);if(entryItem){entryItem.disabled=!entry;entryItem.required=entry;}if(entryLot){entryLot.disabled=!entry;entryLot.required=entry;}if(entryReference)entryReference.disabled=!entry;if(exitStock){exitStock.disabled=entry;exitStock.required=!entry;}if(quantity)quantity.step=decimals===0?'1':'any';if($('#warehouse-movement-help'))$('#warehouse-movement-help').textContent=uom?`Captura la cantidad en ${unitLabel(uom)}${decimals===0?' enteros':''}.`:entry?'Selecciona el material para confirmar su unidad.':'Selecciona una existencia liberada para ver la unidad.';}

  function renderCompletionWaste(){const orderId=Number($('#completion-order')?.value||0),order=(state.data.lookups?.productionOrdersV14||[]).find(x=>Number(x.id)===orderId),host=$('#completion-waste-lines');if(!host)return;const components=(state.data.bomCatalog||[]).filter(x=>Number(x.versionId)===Number(order?.bom_version_id));host.innerHTML=components.map(x=>`<label>${h(x.component)}<input name="waste_${h(x.componentItemId)}" data-waste-item="${h(x.componentItemId)}" type="number" min="0" step="0.001" value="0"><small>${h(x.componentUom)}</small></label>`).join('')||'<p>Selecciona una orden con lista de materiales.</p>';}

  function moduleChecks(modules,selected=[]) { return modules.map(x=>`<label class="check-card"><input type="checkbox" name="module_codes" value="${h(x.code)}" ${selected.includes(String(x.code))?'checked':''}><span>✓</span><strong>${h(x.name)}</strong></label>`).join(''); }

  function technicianFields(lookups) {
    return `<label class="span-2">Usuario del área de Mantenimiento<select name="technician_user_id" required><option value="">Selecciona un usuario</option>${(lookups.maintenanceUsers||[]).map(x=>`<option value="${h(x.id)}">${h(x.name)} · ${h(x.email)}</option>`).join('')}</select><small>Las cuentas únicamente se crean desde Administración del sistema.</small></label><label>Especialidades<input name="specialties" maxlength="500" placeholder="Ej. Electricidad, mecánica, refrigeración"></label><label>Teléfono<input name="phone" maxlength="40"></label>`;
  }

  function maintenanceRequestFields(lookups) {
    return `<label class="span-2">Trabajo solicitado<input name="title" maxlength="190" required placeholder="Ej. Revisar fuga en llenadora"></label><label class="span-2">Descripción completa<textarea name="description" rows="4" maxlength="3000" required></textarea></label><label>Área solicitante<select name="area_id"><option value="">Mi área</option>${(lookups.areas||[]).map(x=>`<option value="${h(x.id)}">${h(x.name)}</option>`).join('')}</select></label><label>Equipo<select name="asset_id"><option value="">Sin equipo asociado</option>${(lookups.assets||[]).map(x=>`<option value="${h(x.id)}">${h(x.asset_name)}</option>`).join('')}</select></label><label>Ubicación<input name="location_description" maxlength="255"></label><label>Prioridad<select name="priority_code"><option value="LOW">Baja</option><option value="NORMAL" selected>Normal</option><option value="HIGH">Alta</option><option value="CRITICAL">Crítica</option></select></label><label>Fecha y hora requerida<input name="needed_at" type="datetime-local" required></label><label>Materiales o refacciones requeridos<textarea name="requested_materials" rows="3" maxlength="2000"></textarea></label><label class="span-2">Evidencia inicial opcional<input name="evidence_files" type="file" accept="image/jpeg,image/png,image/webp" multiple><small>Hasta 5 MB por fotografía.</small></label>`;
  }

  function maintenanceAssignmentFields(lookups, requestId) {
    return `<label class="span-2">Solicitud<select name="request_id" required><option value="">Selecciona la solicitud</option>${(lookups.maintenanceRequests||[]).map(x=>`<option value="${h(x.id)}" ${String(x.id)===String(requestId)?'selected':''}>${h(x.request_number)} · ${h(x.title)}</option>`).join('')}</select></label><fieldset class="span-2 check-field"><legend>Técnicos y horas estimadas</legend><p>Puedes asignar más de una persona y definir el tiempo de cada intervención.</p><div class="technician-grid">${(lookups.technicians||[]).map(x=>`<label class="technician-option"><input type="checkbox" name="technician_user_ids" value="${h(x.id)}"><span><strong>${h(x.name)}</strong><small>${h(x.specialties||'Sin especialidad registrada')}</small></span><input type="number" name="hours_${h(x.id)}" min="0.25" max="999" step="0.25" value="1" aria-label="Horas estimadas para ${h(x.name)}"></label>`).join('')||'<p>No hay técnicos activos. Registra primero un técnico.</p>'}</div></fieldset>`;
  }

  function maintenanceUpdateFields(lookups, requestId) {
    return `<label class="span-2">Solicitud<select name="request_id" required><option value="">Selecciona la solicitud</option>${(lookups.maintenanceRequests||[]).map(x=>`<option value="${h(x.id)}" ${String(x.id)===String(requestId)?'selected':''}>${h(x.request_number)} · ${h(x.title)}</option>`).join('')}</select></label><label>Resultado<select name="work_status" required><option value="IN_PROGRESS">Trabajo en proceso</option><option value="WAITING_PARTS">Esperando materiales o refacciones</option><option value="COMPLETED">Intervención terminada</option>${state.data?.user?.canManageArea?'<option value="VERIFIED">Trabajo verificado y cerrado</option>':''}</select></label><label>Horas de esta intervención<input name="hours_reported" type="number" min="0" max="999" step="0.25" value="0" required></label><label class="span-2">Observaciones y trabajo realizado<textarea name="observations" rows="4" maxlength="3000" required></textarea></label><label class="span-2">Evidencia fotográfica<input name="evidence_files" type="file" accept="image/jpeg,image/png,image/webp" multiple><small>Hasta 5 MB por fotografía. Puedes seleccionar varias.</small></label>`;
  }

  function forecastImportFields() {
    return `<label class="span-2">Archivo de Excel<input id="forecast-file" name="forecast_file" type="file" accept=".xlsx,.xls,.csv" required><small>El sistema busca automáticamente el código de producto terminado y los meses.</small></label><label>Año del plan<input name="fiscal_year" type="number" min="2020" max="2100" value="${new Date().getFullYear()}" required></label><label>Nombre de la versión<input name="version_name" maxlength="120" required placeholder="Ej. Revisión de septiembre"></label><label class="span-2">Motivo del cambio<textarea name="change_reason" rows="3" maxlength="1000" required placeholder="Explica qué cambió respecto al plan anterior"></textarea></label><div id="forecast-preview" class="span-2 import-preview"><strong>Selecciona el archivo</strong><span>Se analizará en tu navegador antes de guardarlo.</span></div>`;
  }

  function auditScheduleFields(lookups) {
    const days=[['MON','Lunes'],['TUE','Martes'],['WED','Miércoles'],['THU','Jueves'],['FRI','Viernes'],['SAT','Sábado'],['SUN','Domingo']];
    return `<label class="span-2">Nombre del programa<input name="schedule_name" maxlength="160" required placeholder="Ej. Conteo de materiales críticos"></label><label>Almacén<select name="warehouse_id" required><option value="">Selecciona un almacén</option>${(lookups.warehouses||[]).map(x=>`<option value="${h(x.id)}">${h(x.name)}</option>`).join('')}</select></label><label>Hora de inicio<input name="start_time" type="time" value="08:00" required></label><fieldset class="span-2 check-field"><legend>Días de la semana</legend><div class="check-grid">${days.map(day=>`<label class="check-card"><input type="checkbox" name="weekday_codes" value="${day[0]}"><span>✓</span><strong>${day[1]}</strong></label>`).join('')}</div></fieldset><label>Tipo de auditoría<select name="count_type"><option value="CYCLE">Conteo cíclico</option><option value="SPOT">Conteo selectivo</option><option value="FULL">Inventario total</option><option value="QUALITY_HOLD">Producto pendiente de Calidad</option></select></label><label>Alcance<input name="scope_description" maxlength="255" required placeholder="Ej. Materiales de mayor consumo"></label><label class="span-2">Indicaciones y observaciones<textarea name="notes" rows="3" maxlength="1000"></textarea></label>`;
  }

  async function submitOperation(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData=new FormData(form);const payload=formDataToObject(formData);const type=$('#operation-type').value;payload.operation_type=['itemRaw','itemPackaging','itemSpare','itemFinished'].includes(type)?'warehouseItem':type==='warehouseModule'?'warehouse':type==='locationModule'?'location':type;
    if(type==='maintenanceAssignment'){
      const ids=formData.getAll('technician_user_ids');payload.assignments=ids.map(id=>({technician_user_id:Number(id),estimated_hours:Number(formData.get(`hours_${id}`)||0)}));
    }
    if(type==='forecastImport'){
      if(!state.forecastPreview?.rows?.length)return toast('Selecciona y analiza un archivo de Excel válido.',true);
      const planYear=String(payload.fiscal_year);payload.rows=state.forecastPreview.rows.map(row=>({...row,period_start:`${planYear}-${String(row.period_start).slice(5)}`}));payload.source_file_name=state.forecastFile.name;payload.source_file_hash=state.forecastFile.hash;
    }
    if(type==='productionCompletion')payload.waste_lines=$$('[data-waste-item]',form).map(input=>({component_item_id:Number(input.dataset.wasteItem),waste_qty:Number(input.value||0)}));
    const evidenceFiles=['maintenanceRequest','maintenanceUpdate'].includes(type)?formData.getAll('evidence_files').filter(file=>file instanceof File&&file.size>0):[];
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    submit.textContent = 'Guardando…';
    let operationResult=null;
    try {
      if (state.demo) {
        await new Promise(resolve => setTimeout(resolve, 350));
      } else {
        payload.idempotency_key = crypto.randomUUID();
        operationResult=await api('createOperation', payload);
        if(type==='forecastImport'&&!operationResult.imported){
          const missing=(operationResult.missingProductCodes||[]).join(', ');throw new Error(missing?`No coinciden estos códigos de producto terminado: ${missing}`:`Hay filas inválidas: ${(operationResult.invalidRows||[]).join(', ')}`);
        }
        if(evidenceFiles.length){const requestId=type==='maintenanceRequest'?Number(operationResult?.id):Number(payload.request_id);for(const file of evidenceFiles)await uploadEvidence(requestId,file);}
        state.data = await api('bootstrap');
      }
      form.close?.();
      $('#operation-dialog').close();
      const missingLists=operationResult?.mrp?.missingBillsOfMaterial||[];
      const productionShortages=operationResult?.shortages||[];
      toast(state.demo?'Operación simulada; no se modificó la base de datos.':operationResult?.qualityRequest&&type==='warehouseMovementV18'?`Entrada ${operationResult.number} guardada en WID. Calidad: ${operationResult.qualityRequest}.`:operationResult?.prelot?`Operación guardada. Prefolio generado: ${operationResult.prelot}.`:missingLists.length?`Forecast guardado. Faltan listas de materiales para ${missingLists.length} producto(s).`:type==='productionOrder'&&productionShortages.length?`Orden creada con ${productionShortages.length} material(es) faltante(s). Quedó en revisión de materiales.`:'Operación guardada correctamente.');
      renderPage();
    } catch (error) { toast(error.message, true); }
    finally { submit.disabled = false; submit.textContent = submit.dataset.idleLabel; }
  }

  function formDataToObject(formData) {
    const result={};for(const [key,value] of formData.entries()){if(key==='evidence_files'||key.startsWith('hours_')||key.startsWith('waste_')||key==='technician_user_ids')continue;if(['module_codes','weekday_codes'].includes(key)){if(!Array.isArray(result[key]))result[key]=[];result[key].push(value);}else result[key]=value;}return result;
  }

  async function uploadEvidence(requestId,file) {
    const data=new FormData();data.append('request_id',String(requestId));data.append('evidence',file);const response=await fetch(`${API_URL}?action=uploadMaintenanceEvidence`,{method:'POST',headers:{Authorization:`Bearer ${state.token}`},body:data,cache:'no-store'});const result=await response.json().catch(()=>null);if(!response.ok||!result?.ok)throw new Error(result?.error||`No se pudo guardar ${file.name}.`);return result.data;
  }

  async function analyzeForecastFile(event) {
    const file=event.target.files?.[0];if(!file)return;const preview=$('#forecast-preview');preview.innerHTML='<strong>Analizando archivo…</strong><span>Buscando códigos y meses.</span>';
    try{if(!window.XLSX)throw new Error('No se cargó el lector de Excel.');const bytes=await file.arrayBuffer();const hashBytes=await crypto.subtle.digest('SHA-256',bytes);const hash=Array.from(new Uint8Array(hashBytes),x=>x.toString(16).padStart(2,'0')).join('');const workbook=XLSX.read(bytes,{type:'array',cellDates:true});const parsed=parseForecastWorkbook(workbook);if(!parsed.rows.length)throw new Error('No se localizaron renglones con código de producto y cantidades mensuales.');state.forecastPreview=parsed;state.forecastFile={name:file.name,hash};preview.innerHTML=`<strong>${n(parsed.rows.length)} registros detectados</strong><span>Hoja: ${h(parsed.sheet)} · ${n(parsed.products)} productos · ${n(parsed.months)} meses. Al guardar se validarán los códigos contra Producto terminado.</span>`;}catch(error){state.forecastPreview=null;state.forecastFile=null;preview.innerHTML=`<strong>No se pudo leer el archivo</strong><span>${h(error.message)}</span>`;}
  }

  function parseForecastWorkbook(workbook) {
    let best={rows:[],sheet:'',products:0,months:0};for(const sheetName of workbook.SheetNames){const matrix=XLSX.utils.sheet_to_json(workbook.Sheets[sheetName],{header:1,defval:'',raw:false});for(let headerIndex=0;headerIndex<Math.min(matrix.length,40);headerIndex++){const headers=(matrix[headerIndex]||[]).map(normalizeHeader);const codeIndex=headers.findIndex(x=>/^(CODIGO|CLAVE|SKU|MATERIAL)$|CODIGO.*(PRODUCTO|PT|MATERIAL)|CLAVE.*(PRODUCTO|PT)|ITEM.*CODE|PRODUCT.*CODE/.test(x)&&!/(CLIENTE|PROVEEDOR)/.test(x));if(codeIndex<0)continue;const customerIndex=headers.findIndex(x=>/(CLIENTE|CUSTOMER)/.test(x));const periodIndex=headers.findIndex(x=>/^(MES|PERIODO|FECHA)$|MES.*PLAN|PERIODO.*FORECAST/.test(x));const quantityIndex=headers.findIndex(x=>/(CANTIDAD|FORECAST|PLAN|VOLUMEN)/.test(x)&&!/(CODIGO|CLIENTE)/.test(x));const monthColumns=(matrix[headerIndex]||[]).map((header,index)=>({index,period:cellToPeriod(header)})).filter(x=>x.period&&x.index!==codeIndex);const rows=[];for(const source of matrix.slice(headerIndex+1)){const productCode=String(source[codeIndex]??'').trim();if(!productCode)continue;const customer=customerIndex>=0?String(source[customerIndex]??'').trim():'';if(periodIndex>=0&&quantityIndex>=0){const period=cellToPeriod(source[periodIndex]);const quantity=parseQuantity(source[quantityIndex]);if(period&&quantity!==null)rows.push({product_code:productCode,customer,period_start:period,quantity});}else{for(const month of monthColumns){const quantity=parseQuantity(source[month.index]);if(quantity!==null)rows.push({product_code:productCode,customer,period_start:month.period,quantity});}}}if(rows.length>best.rows.length){const products=new Set(rows.map(x=>x.product_code));const months=new Set(rows.map(x=>x.period_start));best={rows,sheet:sheetName,products:products.size,months:months.size};}}}return best;
  }

  function normalizeHeader(value){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase().replace(/\s+/g,' ');}
  function monthHeaderToPeriod(value){const text=normalizeHeader(value);const names={ENE:1,ENERO:1,JAN:1,JANUARY:1,FEB:2,FEBRERO:2,FEBRUARY:2,MAR:3,MARZO:3,MARCH:3,ABR:4,ABRIL:4,APR:4,APRIL:4,MAY:5,MAYO:5,JUN:6,JUNIO:6,JUNE:6,JUL:7,JULIO:7,JULY:7,AGO:8,AGOSTO:8,AUG:8,AUGUST:8,SEP:9,SEPT:9,SEPTIEMBRE:9,SEPTEMBER:9,OCT:10,OCTUBRE:10,OCTOBER:10,NOV:11,NOVIEMBRE:11,NOVEMBER:11,DIC:12,DICIEMBRE:12,DEC:12,DECEMBER:12};let month=null;for(const [name,number] of Object.entries(names)){if(new RegExp(`(^|[^A-Z])${name}([^A-Z]|$)`).test(text)){month=number;break;}}if(!month)return null;const yearMatch=text.match(/(20\d{2})|(?:\b(\d{2})\b)/);const year=yearMatch?(yearMatch[1]?Number(yearMatch[1]):2000+Number(yearMatch[2])):new Date().getFullYear();return `${year}-${String(month).padStart(2,'0')}-01`;}
  function cellToPeriod(value){if(value instanceof Date&&!Number.isNaN(value.valueOf()))return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-01`;const text=String(value??'').trim();const iso=text.match(/^(20\d{2})[-\/]([01]?\d)/);if(iso)return `${iso[1]}-${String(Number(iso[2])).padStart(2,'0')}-01`;const local=text.match(/^([0-3]?\d)[-\/]([01]?\d)[-\/](20\d{2})$/);if(local)return `${local[3]}-${String(Number(local[2])).padStart(2,'0')}-01`;const us=text.match(/^([01]?\d)[-\/]([0-3]?\d)[-\/](20\d{2})$/);if(us)return `${us[3]}-${String(Number(us[1])).padStart(2,'0')}-01`;return monthHeaderToPeriod(text);}
  function parseQuantity(value){if(value===''||value==null)return null;const cleaned=String(value).replace(/\s/g,'').replace(/,/g,'');const number=Number(cleaned);return Number.isFinite(number)&&number>=0?number:null;}

  function closeDialogs() { $$('.dialog[open]').forEach(dialog => dialog.close()); }
  function toggleSidebar() { $('#sidebar').classList.toggle('open'); $('#scrim').classList.toggle('hidden', !$('#sidebar').classList.contains('open')); }
  function openAlerts() { $('#alerts-panel').classList.add('open'); $('#alerts-panel').setAttribute('aria-hidden', 'false'); $('#scrim').classList.remove('hidden'); }
  function closeAlerts() { $('#alerts-panel').classList.remove('open'); $('#alerts-panel').setAttribute('aria-hidden', 'true'); $('#scrim').classList.add('hidden'); }
  function closeOverlays() { closeAlerts(); $('#sidebar').classList.remove('open'); $('#scrim').classList.add('hidden'); }

  function renderAlerts() {
    const alerts = state.data.alerts || [];
    $('#alert-count').textContent = String(alerts.length);
    $('#alerts-list').innerHTML = alerts.length ? alertRows(alerts) : '<div class="empty"><strong>Sin alertas abiertas</strong>No hay desviaciones que requieran atención.</div>';
  }

  function exportCurrentPage() {
    if(state.page==='quality'&&window.XLSX){const workbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(workbook,XLSX.utils.json_to_sheet(state.data.lotMaster||[]),'Maestro de lotes');XLSX.utils.book_append_sheet(workbook,XLSX.utils.json_to_sheet(state.data.rawQualityMaster||[]),'Materia prima');XLSX.utils.book_append_sheet(workbook,XLSX.utils.json_to_sheet(state.data.extractionQualityMaster||[]),'Extracción');XLSX.writeFile(workbook,`oleolab-calidad-y-lotes-${new Date().toISOString().slice(0,10)}.xlsx`);return toast('Maestro de Calidad generado.');}
    const source = {
      warehouseRaw:(state.data.warehouseInventory||[]).filter(x=>['RAW_FRUIT','RAW_OTHER','BULK_OIL'].includes(x.type)),warehousePackaging:(state.data.warehouseInventory||[]).filter(x=>x.type==='PACKAGING'),warehouseSpares:(state.data.warehouseInventory||[]).filter(x=>x.type==='SPARE_PART'),warehouseFinished:(state.data.warehouseInventory||[]).filter(x=>x.type==='FINISHED_GOOD'),
      movements:state.data.movements,forecast:state.data.forecast,mrp:state.data.mrp,filling:state.data.production,extraction:state.data.extractionQualityMaster,quality:state.data.lotMaster,shipping:state.data.shipments,returns:state.data.returns,warehouseAudits:state.data.inventoryAuditDetails,maintenance:state.data.maintenance,admin:state.data.users,audit:state.data.audit
    }[state.page];
    if (!source?.length) return toast('Esta vista no contiene registros exportables.', true);
    if(window.XLSX){const workbook=XLSX.utils.book_new();const rows=state.page.startsWith('warehouse')?source.map(x=>({'Producto o material':x.item,'Código del producto':x.sku,'Tipo':itemTypeLabel(x.type),'Almacén':x.warehouse,'Lote':x.lot,'Existencia':Number(x.onHand),'Disponible':Number(x.available),'Unidad':unitLabel(x.uom),'Estado':x.status})):source;const sheet=XLSX.utils.json_to_sheet(rows);XLSX.utils.book_append_sheet(workbook,sheet,state.page.startsWith('warehouse')?'Inventario analítico':'Reporte');XLSX.writeFile(workbook,`oleolab-${state.page}-${new Date().toISOString().slice(0,10)}.xlsx`);return toast('Reporte de Excel generado.');}
    const keys = Object.keys(source[0]);
    const csv = [keys.join(','), ...source.map(row => keys.map(key => csvValue(row[key])).join(','))].join('\r\n');
    const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `oleolab-${state.page}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    toast('Reporte CSV generado.');
  }

  function exportExecutiveReport() {
    const area=state.data.areaDashboard;if(!area)return toast('No hay información ejecutiva disponible.',true);if(!window.XLSX)return toast('El lector de reportes no está disponible.',true);const workbook=XLSX.utils.book_new();
    const summary=(area.metrics||[]).map(x=>({Indicador:x.label,Resultado:Number(x.value),Descripción:x.note}));XLSX.utils.book_append_sheet(workbook,XLSX.utils.json_to_sheet(summary),'Resumen');
    const warehouses=(area.inventoryByWarehouse||[]).map(x=>({Almacén:x.label,'Productos con existencia':Number(x.items),'Cantidad acumulada':Number(x.quantity)}));XLSX.utils.book_append_sheet(workbook,XLSX.utils.json_to_sheet(warehouses),'Existencias por almacén');
    const critical=(area.criticalMaterials||[]).map(x=>({'Producto o material':x.item,'Código':x.sku,'Disponible':Number(x.available),'Punto de reorden':Number(x.reorder_point),'Unidad':x.uom,'Estado':x.status}));XLSX.utils.book_append_sheet(workbook,XLSX.utils.json_to_sheet(critical),'Materiales críticos');
    const flow=(area.highFlow||[]).map(x=>({'Producto o material':x.item,'Código':x.sku,'Salida últimos 30 días':Number(x.quantity),'Unidad':x.uom}));XLSX.utils.book_append_sheet(workbook,XLSX.utils.json_to_sheet(flow),'Mayor consumo');
    const compliance=(area.forecastCompliance||[]).map(x=>({'Producto terminado':x.item,'Código':x.sku,'Forecast vigente':Number(x.forecastQty),'Disponible':Number(x.availableQty),'Cobertura porcentual':Number(x.compliance)}));XLSX.utils.book_append_sheet(workbook,XLSX.utils.json_to_sheet(compliance),'Cumplimiento Forecast');
    const requirements=(state.data.mrp||[]).map(x=>({'Material o materia prima':x.item,'Código':x.sku,'Necesidad bruta':Number(x.required),'Existencia':Number(x.available),'Faltante':Number(x.shortage),'Fecha requerida':x.needDate,'Acción sugerida':x.action,'Estado':statusLabel(x.status)}));XLSX.utils.book_append_sheet(workbook,XLSX.utils.json_to_sheet(requirements),'Necesidades de materiales');
    XLSX.writeFile(workbook,`oleolab-reporte-ejecutivo-${new Date().toISOString().slice(0,10)}.xlsx`);toast('Reporte ejecutivo de Excel generado.');
  }

  function exportInventoryAuditReport() {
    const details=state.data.inventoryAuditDetails||[];if(!details.length)return toast('Todavía no hay partidas auditadas para generar el reporte.',true);
    const rows=details.map(x=>({'Auditoría':x.countNumber,'Fecha':x.auditDate,'Almacén':x.warehouse,'Ubicación':x.location,'Producto o material':x.item,'Código':x.sku,'Lote':x.lot,'Cantidad del sistema':Number(x.systemQuantity),'Conteo físico':Number(x.countedQuantity),'Diferencia':Number(x.difference),'Unidad':x.uom,'Observaciones':x.observations,'Responsable':x.countedBy}));
    if(window.XLSX){const workbook=XLSX.utils.book_new();const differences=details.filter(x=>Math.abs(Number(x.difference))>0.000001).length;const reliability=Math.round(((details.length-differences)/details.length)*10000)/100;const summary=[{'Indicador':'Confiabilidad de inventario','Resultado':`${reliability}%`,'Descripción':'Porcentaje de partidas cuyo conteo físico coincide con el sistema'},{'Indicador':'Partidas auditadas','Resultado':details.length,'Descripción':'Total de partidas incluidas en el reporte'},{'Indicador':'Partidas con diferencia','Resultado':differences,'Descripción':'Requieren análisis de causa y observaciones'},...(state.data.counts||[]).map(x=>({'Indicador':`Auditoría ${x.id}`,'Resultado':x.variance,'Descripción':`${x.warehouse} · ${countTypeLabel(x.scope)} · ${x.planned} · ${x.owner} · ${statusLabel(x.status)}`}))];XLSX.utils.book_append_sheet(workbook,XLSX.utils.json_to_sheet(summary),'Resumen');XLSX.utils.book_append_sheet(workbook,XLSX.utils.json_to_sheet(rows),'Diferencias y observaciones');XLSX.writeFile(workbook,`oleolab-auditoria-inventario-${new Date().toISOString().slice(0,10)}.xlsx`);return toast('Reporte de auditoría generado.');}
    const keys=Object.keys(rows[0]);const csv=[keys.join(','),...rows.map(row=>keys.map(key=>csvValue(row[key])).join(','))].join('\r\n');const url=URL.createObjectURL(new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8'}));const anchor=document.createElement('a');anchor.href=url;anchor.download=`oleolab-auditoria-inventario-${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);toast('Reporte de auditoría generado.');
  }

  async function api(action, payload = {}, token = state.token) {
    if (!configured()) throw new Error('La URL de la API no está configurada.');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(API_URL, {
        method: 'POST', cache: 'no-store', redirect: 'follow', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action, payload })
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) throw new Error(result?.error || `Error HTTP ${response.status}`);
      return result.data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('La operación tardó demasiado. Inténtalo nuevamente.');
      if (error instanceof TypeError) throw new Error('No fue posible conectar con la API de Oleolab.');
      throw error;
    } finally { clearTimeout(timeout); }
  }

  function configured() { return API_URL && !API_URL.includes('PEGA_AQUI') && !API_URL.startsWith('javascript:'); }
  function setLoading(visible, label = 'Procesando…') { $('#loading-label').textContent = label; $('#loading').classList.toggle('hidden', !visible); }
  function toast(message, error = false) { const element = $('#toast'); element.textContent = message; element.classList.toggle('error', error); element.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => element.classList.remove('show'), 3800); }
  function initials(name) { return String(name).split(/\s+/).slice(0, 2).map(x => x[0] || '').join('').toUpperCase(); }
  function n(value) { return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(Number(value) || 0); }
  function dateFmt(value) { const date = new Date(`${value}T12:00:00`); return Number.isNaN(date.valueOf()) ? String(value ?? '') : new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(date); }
  function itemTypeLabel(value){return ({RAW_FRUIT:'Aguacate en fruta',RAW_OTHER:'Otra materia prima',PACKAGING:'Material de empaque',SPARE_PART:'Refacción',CONSUMABLE:'Consumible',BULK_OIL:'Aceite a granel',FINISHED_GOOD:'Producto terminado',SERVICE:'Servicio'})[value]||String(value??'');}
  function warehouseTypeLabel(value){return ({RAW_MATERIAL:'Materia prima',PACKAGING:'Materiales de empaque',SPARE_PARTS:'Refacciones',PROCESS:'Producto en proceso',FINISHED_GOODS:'Producto terminado',QUARANTINE:'Cuarentena',REJECTED:'Rechazados',RETURNS:'Devoluciones'})[value]||String(value??'');}
  function unitLabel(value){return ({KG:'kilogramos',G:'gramos',L:'litros',ML:'mililitros',EA:'piezas',BOX:'cajas',BEAN:'contenedores de fruta',PALLET:'tarimas',ROLL:'rollos',BAG:'bolsas',DRUM:'tambores'})[value]||String(value??'');}
  function presentationLabel(value,bins=0){return ({BINS:`${n(bins)} contenedores de fruta`,TANKER:'Pipa',IBC:'Contenedor intermedio',OTHER:'Otra presentación'})[value]||'Por asignar';}
  function qualityRequestTypeLabel(value){return ({INBOUND_FRUIT:'Materia prima · aguacate',INBOUND_MATERIAL:'Material recibido',IN_PROCESS:'Extracción y proceso',FINISHED_GOOD:'Producto terminado',CUSTOMER_RETURN:'Devolución de cliente',OTHER:'Otra inspección'})[value]||String(value??'');}
  function sampleTypeLabel(value){return ({PULP:'Pulpa',WET_PASTE:'Pasta húmeda',DRY_PASTE:'Pasta seca'})[value]||String(value??'');}
  function pct(value){return value==null||value===''?'—':`${n(value)}%`;}
  function isoWeek(date){const value=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));value.setUTCDate(value.getUTCDate()+4-(value.getUTCDay()||7));const start=new Date(Date.UTC(value.getUTCFullYear(),0,1));return Math.ceil((((value-start)/86400000)+1)/7);}
  function qualityLabel(value){return ({APPROVED:'Liberado',CONDITIONAL:'Liberado con condición',PENDING:'Pendiente de revisión',REJECTED:'Rechazado y bloqueado'})[value]||String(value??'');}
  function priorityLabel(value){return ({LOW:'Baja',NORMAL:'Normal',HIGH:'Alta',CRITICAL:'Crítica'})[value]||String(value??'');}
  function countTypeLabel(value){return ({CYCLE:'Conteo cíclico',FULL:'Inventario total',SPOT:'Conteo selectivo',QUALITY_HOLD:'Pendiente de Calidad'})[value]||String(value??'');}
  function weekdayLabels(value){const labels={MON:'Lunes',TUE:'Martes',WED:'Miércoles',THU:'Jueves',FRI:'Viernes',SAT:'Sábado',SUN:'Domingo'};return String(value??'').split(',').map(code=>labels[code]||code).join(', ');}
  function movementTypeLabel(value){return ({RECEIPT:'Recepción',TRANSFER:'Transferencia',ISSUE_PRODUCTION:'Salida a producción',PRODUCTION_OUTPUT:'Entrada de producción',SHIPMENT:'Embarque',CUSTOMER_RETURN:'Devolución de cliente',SUPPLIER_RETURN:'Devolución a proveedor',QUALITY_RELEASE:'Liberación de Calidad',QUALITY_REJECT:'Rechazo de Calidad',COUNT_ADJUSTMENT:'Ajuste por auditoría',MAINTENANCE_ISSUE:'Salida a Mantenimiento',SCRAP:'Merma',REVERSAL:'Reversa',OTHER:'Otro movimiento'})[value]||String(value??'');}
  function statusLabel(value){const key=String(value??'');return ({DRAFT:'Borrador',POSTED:'Contabilizado',CANCELLED:'Cancelado',PLANNED:'Planeado',SENT:'Enviado',CONFIRMED:'Confirmado',LOADED:'Unidad cargada',IN_ROUTE:'En ruta',ARRIVED:'Llegó',IN_INSPECTION:'En inspección',COMPLETED:'Terminado',NO_SHOW:'No llegó',EXPECTED:'Esperado en WID',PARTIALLY_RECEIVED:'Recibido parcialmente',RECEIVED:'Recibido',WAITING_QUALITY:'Esperando Calidad',PARTIALLY_ACCEPTED:'Aceptación parcial',ACCEPTED:'Aceptado',REJECTED:'Rechazado',REQUESTED:'Solicitado',SAMPLING:'En análisis',TESTING:'En pruebas',APPROVED:'Aprobado',CONDITIONAL:'Aprobación condicional',OPEN:'Abierto',BLOCKED:'Bloqueado',ACTIVE:'Activo',DISABLED:'Desactivado',LOCKED:'Bloqueado',INVITED:'Invitado',ASSIGNED:'Asignado',RELEASED:'Liberado para producir',IN_PROGRESS:'En proceso',WAITING_PARTS:'Esperando materiales',VERIFIED:'Verificado y cerrado',CRITICAL:'Crítico',HIGH:'Alta',NORMAL:'Normal',LOW:'Baja',SHORTAGE:'Faltante',COVERED:'Cubierto',MATERIAL_CHECK:'Revisión de materiales',ON_HOLD:'En espera',FROZEN:'Congelado para conteo',COUNTING:'En conteo',RECOUNT:'Reconteo'})[key]||key;}
  function csvValue(value) { const text = String(value ?? ''); return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
  function h(value) { return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
})();
