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
    { group: 'Operación', items: [
      ['dashboard', '⌂', 'Panel general'], ['appointments', '◷', 'Citas y andenes'],
      ['receiving', '⇩', 'Recepciones'], ['quality', '✓', 'Calidad']
    ]},
    { group: 'Inventarios', items: [
      ['inventory', '▦', 'Existencias'], ['movements', '↔', 'Movimientos'], ['counts', '◎', 'Auditorías de almacén']
    ]},
    { group: 'Planeación', items: [
      ['forecast', '▥', 'Forecast'], ['mrp', '∑', 'MRP y necesidades'], ['production', '▤', 'Órdenes de producción']
    ]},
    { group: 'Trazabilidad', items: [
      ['trace', '⌁', 'Lotes y extracción'], ['shipping', '⇧', 'Embarques'], ['returns', '↩', 'Rechazos y devoluciones']
    ]},
    { group: 'Soporte', items: [
      ['maintenance', '⚙', 'Mantenimiento'], ['catalogs', '◇', 'Catálogos'],
      ['users', '♙', 'Usuarios y accesos'], ['audit', '≡', 'Bitácora del sistema']
    ]}
  ];

  const PAGE_META = {
    dashboard: ['OPERACIÓN', 'Panel general'], appointments: ['AGENDA', 'Citas y andenes'],
    receiving: ['ENTRADAS', 'Recepciones'], quality: ['LIBERACIÓN', 'Calidad'],
    inventory: ['EXISTENCIAS', 'Inventario vivo'], movements: ['KARDEX', 'Movimientos'],
    counts: ['CONTROL', 'Auditorías de almacén'], forecast: ['PLANEACIÓN', 'Forecast'],
    mrp: ['NECESIDADES', 'MRP'], production: ['CUMPLIMIENTO', 'Órdenes de producción'],
    trace: ['GENEALOGÍA', 'Trazabilidad de lotes'], shipping: ['SALIDAS', 'Embarques'],
    returns: ['NO CONFORMIDAD', 'Rechazos y devoluciones'], maintenance: ['INTEGRACIÓN', 'Mantenimiento'],
    catalogs: ['DATOS MAESTROS', 'Catálogos'], users: ['ADMINISTRACIÓN', 'Usuarios y accesos'],
    audit: ['SEGURIDAD', 'Bitácora del sistema']
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
      <label>SKU recibido<input name="sku" required placeholder="MP-AGU-HASS"></label>
      <label>Peso esperado (kg)<input name="expected_weight" type="number" min="0.001" step="0.001" required></label>
      <label>Peso recibido (kg)<input name="received_weight" type="number" min="0.001" step="0.001" required></label>
      <label>Almacén<input name="warehouse_code" required placeholder="MP"></label>
      <label>Ubicación de cuarentena<input name="location_code" required placeholder="CUARENTENA"></label>
      <label class="span-2">Observaciones<textarea name="notes" rows="3"></textarea></label>`,
    movement: `
      <label>Movimiento<select name="movement_type" required><option>Transferencia</option><option>Salida a producción</option><option>Salida a mantenimiento</option><option>Merma</option></select></label>
      <label>SKU<input name="sku" required></label>
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
      <label>SKU<input name="sku" required></label>
      <label>Lote<input name="lot"></label>
      <label>Cantidad<input name="quantity" type="number" min="0.001" step="0.001" required></label>
      <label class="span-2">Motivo<textarea name="reason" rows="3" required></textarea></label>`,
    user: `
      <label>Nombre completo<input name="display_name" required maxlength="160"></label>
      <label>Correo electrónico<input name="email" type="email" required maxlength="190"></label>
      <label>Código de área<input name="area_code" required placeholder="Ej. ALMACEN"></label>
      <label>Rol<select name="role_code" required><option value="AREA_MANAGER">Responsable de área</option><option value="OPERATOR">Operador</option><option value="APPROVER">Aprobador</option><option value="VIEWER">Consulta</option></select></label>
      <label class="span-2">Módulos autorizados<input name="module_codes" required placeholder="Ej. RECEIVING,INVENTORY,COUNTS"></label>
      <label class="span-2">Contraseña inicial segura<input name="password" type="password" minlength="12" autocomplete="new-password" required></label>`,
    supplier: `
      <label>Código de proveedor<input name="supplier_code" required maxlength="40" placeholder="PROV-001"></label>
      <label>Iniciales para pre-lote<input name="short_code" required maxlength="12" placeholder="AGV"></label>
      <label>Razón social<input name="legal_name" required maxlength="190"></label>
      <label>Nombre comercial<input name="trade_name" maxlength="190"></label>
      <label>Contacto<input name="contact_name" maxlength="160"></label>
      <label>Correo de contacto<input name="contact_email" type="email" maxlength="190"></label>`,
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
      <label>SKU<input name="sku" required maxlength="80"></label>
      <label>Nombre<input name="item_name" required maxlength="190"></label>
      <label>Tipo<select name="item_type" required><option value="RAW_FRUIT">Fruta</option><option value="RAW_OTHER">Otra materia prima</option><option value="PACKAGING">Empaque</option><option value="SPARE_PART">Refacción</option><option value="CONSUMABLE">Consumible</option><option value="BULK_OIL">Aceite a granel</option><option value="FINISHED_GOOD">Producto terminado</option><option value="SERVICE">Servicio</option></select></label>
      <label>Categoría<input name="category_code" required placeholder="FRUIT, PACK, SPARE, FG..."></label>
      <label>Unidad base<input name="uom_code" required placeholder="KG, L, EA, BOX..."></label>
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
    user: { id: 1, name: 'Roberto Hernández', role: 'Superadministrador', modules: ['*'] },
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
    page: location.hash.replace('#/', '') || 'dashboard', query: '', demo: false, traceResult: null
  };

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    $('#login-form').addEventListener('submit', login);
    $('#demo-login').addEventListener('click', startDemo);
    $('#logout').addEventListener('click', logout);
    $('#menu').addEventListener('click', toggleSidebar);
    $('#quick-action').addEventListener('click', openOperation);
    $('#operation-type').addEventListener('change', renderOperationFields);
    $('#operation-form').addEventListener('submit', submitOperation);
    $$('[data-close-dialog]').forEach(button => button.addEventListener('click', closeDialogs));
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
    const form = new FormData(event.currentTarget);
    setLoading(true, 'Verificando acceso…');
    try {
      const result = await api('login', { email: form.get('email'), password: form.get('password') }, '');
      state.token = result.token;
      sessionStorage.setItem(TOKEN_KEY, state.token);
      await loadApplication();
      event.currentTarget.reset();
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
    renderNav();
    renderPage();
    $('#view').focus({ preventScroll: true });
  }

  function renderPage() {
    const renderer = {
      dashboard: renderDashboard, appointments: renderAppointments, receiving: renderReceiving,
      quality: renderQuality, inventory: renderInventory, movements: renderMovements,
      counts: renderCounts, forecast: renderForecast, mrp: renderMrp,
      production: renderProduction, trace: renderTrace, shipping: renderShipping,
      returns: renderReturns, maintenance: renderMaintenance, catalogs: renderCatalogs,
      users: renderUsers, audit: renderAudit
    }[state.page] || renderDashboard;
    renderer();
    bindCommonActions();
  }

  function renderDashboard() {
    const d = state.data;
    $('#view').innerHTML = `
      <div class="welcome"><div><h2>Operación de hoy</h2><p class="muted">Existencias, compromisos y eventos que requieren decisión.</p></div><div class="actions"><button class="btn ghost" data-page-link="forecast">Comparar Forecast</button><button class="btn primary" data-open-operation>＋ Registrar operación</button></div></div>
      <div class="metric-grid">
        ${metric('SKU con existencia', n(d.metrics.inventorySkus), '▦', 'Inventario contabilizado')}
        ${metric('Faltantes críticos', n(d.metrics.criticalShortages), '!', 'Necesidades MRP abiertas', 'danger')}
        ${metric('Pendientes de Calidad', n(d.metrics.pendingQuality), '✓', 'Recepciones en espera', 'warning')}
        ${metric('Órdenes en riesgo', n(d.metrics.ordersAtRisk), '◷', 'Fecha prometida comprometida', 'danger')}
      </div>
      <div class="content-grid">
        <section class="card"><div class="card-head"><div><h3>Agenda de andenes</h3><p>Entradas y salidas programadas para hoy.</p></div><button class="btn ghost small" data-page-link="appointments">Ver agenda</button></div><div class="card-pad">${agenda(d.appointments.slice(0, 4))}</div></section>
        <section class="card card-pad"><h3>Cobertura del plan</h3><p>Disponibilidad frente al Forecast vigente.</p>${coverage(d.coverage)}</section>
      </div>
      <div class="equal-grid page-gap">
        <section class="card"><div class="card-head"><div><h3>Alertas prioritarias</h3><p>Desviaciones que pueden afectar el cumplimiento.</p></div><button class="btn ghost small" data-open-alerts>Ver todas</button></div><div class="card-pad">${alertRows(d.alerts.slice(0, 3))}</div></section>
        <section class="card"><div class="card-head"><div><h3>Movimientos recientes</h3><p>Últimas afectaciones contabilizadas.</p></div><button class="btn ghost small" data-page-link="movements">Ver kardex</button></div>${movementTable(d.movements.slice(0, 4), true)}</section>
      </div>`;
  }

  function renderAppointments() {
    const rows = filterRows(state.data.appointments, ['id', 'supplier', 'material', 'dock', 'status']);
    const confirmed = rows.filter(x => /CONFIRMED|CONFIRMADA/i.test(x.status)).length;
    const delayed = rows.filter(x => /DELAYED|RETRASADA/i.test(x.status)).length;
    $('#view').innerHTML = sectionHeader('Citas programadas', 'Coordina proveedores, recolecciones y embarques sin saturar la operación.', 'Nueva cita', 'appointment') + `
      <div class="metric-grid">${metric('Agenda visible', n(rows.length), '◷', 'Próximos siete días')}${metric('Confirmadas', n(confirmed), '✓', rows.length ? `${n(confirmed / rows.length * 100)}% de la agenda` : 'Sin citas')}${metric('Retrasadas', n(delayed), '!', 'Requieren seguimiento', delayed ? 'danger' : '')}${metric('Entradas previstas', n(rows.filter(x => x.type === 'Entrada').length), '▦', 'Recepciones programadas')}</div>
      <section class="card">${table(['Hora','Folio','Tipo','Proveedor / transportista','Material','Ubicación','Estado'], rows.map(x => [x.time, folio(x.id), x.type, cell(x.supplier, x.material), x.material, x.dock, badge(x.status)]), 'No hay citas con ese criterio.')}</section>`;
  }

  function renderReceiving() {
    const rows = filterRows(state.data.receipts, ['id', 'prelot', 'supplier', 'item', 'quality', 'status']);
    $('#view').innerHTML = sectionHeader('Recepciones y pre-lotes', 'Confirma la cita, genera el lote definitivo y solicita la inspección de Calidad.', 'Nueva recepción', 'receipt') + `
      <section class="card">${table(['Recepción','Pre-lote','Proveedor','Material','Esperado','Recibido','Calidad','Estado'], rows.map(x => [folio(x.id), folio(x.prelot), x.supplier, x.item, x.expected, x.received, badge(x.quality), badge(x.status)]), 'No hay recepciones con ese criterio.')}</section>`;
  }

  function renderQuality() {
    const rows = filterRows(state.data.quality, ['id', 'type', 'reference', 'item', 'lot', 'owner', 'status']);
    $('#view').innerHTML = `<div class="section-head"><div><h2>Bandeja de Calidad</h2><p class="muted">Las existencias permanecen en cuarentena hasta que Calidad emite una disposición.</p></div><div class="actions"><button class="btn ghost" data-open-operation="quality">＋ Solicitar inspección</button><button class="btn primary" data-open-operation="qualityDecision">✓ Registrar dictamen</button></div></div>` + `
      <section class="card">${table(['Solicitud','Fecha','Tipo','Referencia','Material / lote','Responsable','Estado'], rows.map(x => [folio(x.id), x.requested, x.type, folio(x.reference), cell(x.item, x.lot), x.owner, badge(x.status)]), 'No hay solicitudes con ese criterio.')}</section>`;
  }

  function renderInventory() {
    const rows = filterRows(state.data.inventory, ['sku', 'item', 'type', 'warehouse', 'lot', 'status']);
    const totalAvailable = rows.reduce((sum, x) => sum + Number(x.available), 0);
    $('#view').innerHTML = sectionHeader('Inventario disponible', 'El saldo proviene exclusivamente de movimientos contabilizados y reservas vigentes.', 'Nuevo movimiento', 'movement', true) + `
      <div class="metric-grid">${metric('Registros visibles', n(rows.length), '▦', 'Por SKU, lote y ubicación')}${metric('Disponible acumulado', n(totalAvailable), '✓', 'Unidades mixtas; consultar detalle')}${metric('Sin disponible', n(rows.filter(x => x.available <= 0).length), '!', 'Requieren atención', 'danger')}${metric('En nivel bajo', n(rows.filter(x => ['Crítico','Bajo'].includes(x.status)).length), '◷', 'Contra mínimo y punto de reorden', 'warning')}</div>
      <section class="card">${inventoryTable(rows)}</section>`;
  }

  function renderMovements() {
    const rows = filterRows(state.data.movements, ['id', 'date', 'type', 'sku', 'lot', 'location', 'user', 'status']);
    $('#view').innerHTML = sectionHeader('Kardex de movimientos', 'Los movimientos contabilizados son inmutables; cualquier corrección se registra mediante reversa.', 'Registrar movimiento', 'movement', true) + `<section class="card">${movementTable(rows)}</section>`;
  }

  function renderForecast() {
    const rows = filterRows(state.data.forecast, ['customer', 'sku', 'item', 'impact', 'status']);
    const changed = rows.filter(x => Number(x.delta) !== 0).length;
    const increased = rows.filter(x => Number(x.delta) > 0).length;
    $('#view').innerHTML = sectionHeader('Forecast original vs. vigente', 'Cada importación crea una versión y conserva el plan anterior para medir su impacto.', 'Importar nueva versión', null, true) + `
      <div class="equal-grid"><section class="card card-pad"><p class="eyebrow">COMPARACIÓN</p><h3>${n(rows.length)} líneas vigentes</h3><p>Plan original contra la versión marcada como actual.</p></section><section class="card card-pad"><p class="eyebrow">IMPACTO</p><h3>${n(changed)} cambios detectados</h3><p>${n(increased)} incrementos que deben volver a evaluarse en MRP.</p></section></div>
      <section class="card page-gap">${table(['Cliente','SKU / producto','Original','Vigente','Cambio','Impacto','Cobertura'], rows.map(x => [x.customer, cell(x.sku, x.item), numCell(x.original), numCell(x.current), delta(x.delta), x.impact, badge(x.status)]), 'No hay cambios con ese criterio.')}</section>`;
  }

  function renderMrp() {
    const rows = filterRows(state.data.mrp, ['item', 'sku', 'needDate', 'action', 'status']);
    const shortages = rows.filter(x => Number(x.shortage) > 0);
    const coveragePct = rows.length ? Math.round((rows.length - shortages.length) / rows.length * 100) : 0;
    $('#view').innerHTML = sectionHeader('Necesidades calculadas', 'Explosión de materiales contra existencias, reservas, entradas programadas y tiempos de entrega.', 'Ejecutar MRP', null, true) + `
      <div class="metric-grid">${metric('Necesidades', n(rows.length), '∑', 'Última ejecución completada')}${metric('Faltantes', n(shortages.length), '!', 'SKU con necesidad neta', shortages.length ? 'danger' : '')}${metric('Cantidad faltante', n(shortages.reduce((sum, x) => sum + Number(x.shortage || 0), 0)), '▤', 'Consultar unidades por renglón')}${metric('Cobertura de renglones', `${n(coveragePct)}%`, '✓', 'Sin faltante neto', coveragePct < 75 ? 'warning' : '')}</div>
      <section class="card">${table(['Material','Requerido','Disponible','Entradas','Faltante','Fecha necesidad','Acción sugerida','Estado'], rows.map(x => [cell(x.sku, x.item), numCell(x.required), numCell(x.available), numCell(x.incoming), numCell(x.shortage, x.shortage > 0 ? 'negative' : 'positive'), dateFmt(x.needDate), x.action, badge(x.status)]), 'No hay necesidades con ese criterio.')}</section>`;
  }

  function renderProduction() {
    const rows = filterRows(state.data.production, ['id', 'item', 'customer', 'material', 'status']);
    $('#view').innerHTML = sectionHeader('Órdenes de producción', 'Comprueba materiales, reserva existencias y comunica el riesgo de cumplimiento a Ventas.', 'Nueva orden', null, true) + `
      <section class="card">${table(['Orden','Producto','Cliente','Planeado','Terminado','Ventana','Materiales','Estado'], rows.map(x => [folio(x.id), x.item, x.customer, x.planned, x.completed, x.date, badge(x.material), badge(x.status)]), 'No hay órdenes con ese criterio.')}</section>`;
  }

  function renderTrace() {
    if (!state.demo) {
      const result = state.traceResult;
      const details = result ? `<section class="card card-pad"><div class="detail-grid"><div class="detail"><small>Lote</small><strong>${h(result.lot.lot_code)}</strong></div><div class="detail"><small>SKU</small><strong>${h(result.lot.sku)}</strong></div><div class="detail"><small>Artículo</small><strong>${h(result.lot.item)}</strong></div><div class="detail"><small>Calidad</small><strong>${h(result.lot.quality_status)}</strong></div><div class="detail"><small>Proveedor</small><strong>${h(result.lot.supplier || 'Sin proveedor')}</strong></div><div class="detail"><small>Origen</small><strong>${h(result.lot.origin || 'Sin origen')}</strong></div></div></section><section class="card page-gap">${table(['Proceso','Lote origen','Lote resultado','Cantidad utilizada','Contribución'], result.edges.map(x => [folio(x.batch_code), folio(x.parent_lot_code), folio(x.child_lot_code), n(x.parent_qty_used), x.contribution_pct == null ? '—' : `${n(x.contribution_pct)}%`]), 'El lote existe, pero todavía no tiene vínculos de transformación.')}</section>` : '<section class="card card-pad"><div class="empty"><strong>Busca un lote</strong>Se mostrarán sus datos y vínculos de transformación ascendentes y descendentes.</div></section>';
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
    $('#view').innerHTML = sectionHeader('Surtido y embarques', 'Reserva producto terminado, coordina andén y registra la salida al cliente.', 'Programar embarque', 'appointment', true) + `
      <section class="card">${table(['Embarque','Pedido','Cliente','Cita','Bultos','Avance','Andén','Estado'], rows.map(x => [folio(x.id), folio(x.order), x.customer, x.scheduled, n(x.packages), x.progress, x.dock, badge(x.status)]), 'No hay embarques con ese criterio.')}</section>`;
  }

  function renderReturns() {
    const rows = filterRows(state.data.returns, ['id', 'type', 'partner', 'reference', 'item', 'lot', 'reason', 'status']);
    $('#view').innerHTML = sectionHeader('Rechazos y devoluciones', 'Aísla el producto, solicita dictamen y conserva el vínculo con el movimiento original.', 'Registrar devolución', 'return', true) + `
      <section class="card">${table(['Folio','Origen','Cliente / proveedor','Referencia','Producto / lote','Cantidad','Motivo','Estado'], rows.map(x => [folio(x.id), x.type, x.partner, folio(x.reference), cell(x.item, x.lot), x.qty, x.reason, badge(x.status)]), 'No hay devoluciones con ese criterio.')}</section>`;
  }

  function renderCounts() {
    const rows = filterRows(state.data.counts, ['id', 'warehouse', 'scope', 'owner', 'variance', 'status']);
    $('#view').innerHTML = sectionHeader('Conteos y diferencias', 'Programa conteos cíclicos, solicita reconteo y contabiliza ajustes únicamente con aprobación.', 'Programar conteo', 'count', true) + `
      <section class="card">${table(['Conteo','Almacén','Alcance','Programado','Responsable','Diferencia','Estado'], rows.map(x => [folio(x.id), x.warehouse, x.scope, x.planned, x.owner, x.variance, badge(x.status)]), 'No hay conteos con ese criterio.')}</section>`;
  }

  function renderMaintenance() {
    const rows = filterRows(state.data.maintenance, ['id', 'order', 'asset', 'item', 'reservation', 'status']);
    $('#view').innerHTML = sectionHeader('Requisiciones de Mantenimiento', 'Las solicitudes de refacciones generan reservas y salidas de inventario ligadas a la orden de trabajo.', 'Nueva requisición', 'movement', true) + `
      <section class="card">${table(['Requisición','Orden','Equipo','Refacción','Cantidad','Necesaria','Reserva','Estado'], rows.map(x => [folio(x.id), folio(x.order), x.asset, x.item, x.qty, x.needed, badge(x.reservation), badge(x.status)]), 'No hay requisiciones con ese criterio.')}</section>`;
  }

  function renderCatalogs() {
    const catalogs = [
      ['▦','Productos y materiales','SKU, tipo, unidad, control por lote, mínimos y tiempos de entrega.','item'],
      ['⌂','Almacenes','Materia prima, empaque, refacciones, proceso, PT y cuarentena.','warehouse'],
      ['⌖','Ubicaciones','Recibo, cuarentena, racks, surtido, producción y devoluciones.','location'],
      ['◇','Proveedores','Información de Compras e iniciales únicas para el pre-lote.','supplier'],
      ['⌁','Orígenes de proveedor','Huertas, municipios y lugares de recolección.','origin'],
      ['♙','Clientes','Datos comerciales necesarios para pedidos, Forecast y devoluciones.','customer'],
      ['▤','Listas de materiales','Versiones de BOM, cantidades por producto, merma y rendimiento esperado.',null],
      ['▦','Beans y retornables','Disponibilidad, asignación, ubicación, limpieza y mantenimiento.',null],
      ['✓','Especificaciones de Calidad','Parámetros, límites, vigencias y métodos de prueba.',null],
      ['⇧','Transportes','Unidades, capacidades y disponibilidad para Logística.',null],
      ['⚙','Equipos de Mantenimiento','Activos sincronizados con la aplicación de Mantenimiento.',null]
    ];
    $('#view').innerHTML = `<div class="section-head"><div><h2>Catálogos por responsable</h2><p class="muted">Cada área mantiene únicamente los datos maestros que tiene autorizados.</p></div></div><div class="catalog-grid">${catalogs.map(([icon,title,copy,operation]) => `<article class="card catalog-card"><div class="card-icon">${icon}</div><div><h3>${h(title)}</h3><p>${h(copy)}</p></div>${operation ? `<button class="btn ghost small" data-open-operation="${operation}">Crear registro</button>` : '<span class="badge info">Siguiente etapa</span>'}</article>`).join('')}</div>`;
  }

  function renderUsers() {
    const rows = filterRows(state.data.users, ['name', 'email', 'area', 'role', 'modules', 'status']);
    $('#view').innerHTML = sectionHeader('Usuarios, roles y módulos', 'Solo el superadministrador puede crear usuarios y definir sus accesos.', 'Nuevo usuario', 'user', true) + `
      <section class="card">${table(['Usuario','Área','Rol','Módulos','Estado',''], rows.map(x => [cell(x.name, x.email), x.area, x.role, x.modules, badge(x.status), trusted('<button class="btn ghost small" data-user-edit>Configurar</button>')]), 'No hay usuarios con ese criterio.')}</section>
      <section class="card card-pad page-gap"><h3>Ejemplo de permisos por módulo</h3><p>Los permisos efectivos combinan el rol y las excepciones asignadas al usuario.</p><div class="permission-matrix"><div class="matrix-head">Módulo</div><div class="matrix-head">Ver</div><div class="matrix-head">Crear</div><div class="matrix-head">Aprobar</div><div class="matrix-head">Admin.</div>${['Inventarios','Recepciones','Calidad','Forecast','Usuarios'].map((name, i) => `<div>${name}</div><div class="matrix-value">✓</div><div class="matrix-value">${i === 4 ? '—' : '✓'}</div><div class="matrix-value">${[2,3].includes(i) ? '✓' : '—'}</div><div class="matrix-value">${i === 4 ? '✓' : '—'}</div>`).join('')}</div></section>`;
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
    return table(['SKU / material','Tipo','Almacén','Lote','Existencia','Reservado','Disponible','Estado'], rows.map(x => [cell(x.sku, x.item), x.type, x.warehouse, folio(x.lot), numCell(x.onHand, '', x.uom), numCell(x.reserved, '', x.uom), numCell(x.available, x.available <= 0 ? 'negative' : 'positive', x.uom), badge(x.status)]), 'No hay existencias con ese criterio.');
  }

  function movementTable(rows, compact = false) {
    return table(['Movimiento','Fecha','Tipo','SKU / lote','Cantidad','Ubicación','Usuario','Estado'], rows.map(x => [folio(x.id), x.date, x.type, cell(x.sku, x.lot), delta(x.qty, x.uom), x.location, x.user, badge(x.status)]), 'No hay movimientos con ese criterio.', compact ? 'compact' : '');
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
  function badge(value) { const slug = String(value).toLowerCase(); let tone = 'info'; if (/aprob|confirm|complet|termin|cerrad|listo|cubiert|activo|disponible|contabilizado|entregada/.test(slug)) tone = 'good'; if (/pend|solicit|parcial|condicional|reconteo|por confirmar|por surtir|bajo/.test(slug)) tone = 'warning'; if (/rechaz|faltante|riesgo|crítico|sin disponible|retras|vencid|por devolver/.test(slug)) tone = 'danger'; return trusted(`<span class="badge ${tone}">${h(value)}</span>`); }
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
    $$('[data-open-operation]').forEach(button => button.addEventListener('click', () => openOperation(button.dataset.openOperation)));
    $$('[data-open-alerts]').forEach(button => button.addEventListener('click', openAlerts));
    $$('[data-export]').forEach(button => button.addEventListener('click', exportCurrentPage));
    $$('[data-user-edit]').forEach(button => button.addEventListener('click', () => toast('Para cambiar accesos, cree una nueva asignación desde el administrador.')));
  }

  function openOperation(type) {
    if (typeof type === 'string' && operationFields[type]) $('#operation-type').value = type;
    renderOperationFields();
    $('#operation-dialog').showModal();
  }

  function renderOperationFields() { $('#operation-fields').innerHTML = operationFields[$('#operation-type').value] || operationFields.appointment; }

  async function submitOperation(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    submit.textContent = 'Guardando…';
    try {
      if (state.demo) {
        await new Promise(resolve => setTimeout(resolve, 350));
      } else {
        payload.idempotency_key = crypto.randomUUID();
        await api('createOperation', payload);
        state.data = await api('bootstrap');
      }
      form.close?.();
      $('#operation-dialog').close();
      toast(state.demo ? 'Operación simulada; no se modificó la base de datos.' : 'Operación guardada correctamente.');
      renderPage();
    } catch (error) { toast(error.message, true); }
    finally { submit.disabled = false; submit.textContent = submit.dataset.idleLabel; }
  }

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
    const source = {
      inventory: state.data.inventory, movements: state.data.movements, forecast: state.data.forecast,
      mrp: state.data.mrp, production: state.data.production, shipping: state.data.shipments,
      returns: state.data.returns, counts: state.data.counts, maintenance: state.data.maintenance,
      users: state.data.users, audit: state.data.audit
    }[state.page];
    if (!source?.length) return toast('Esta vista no contiene registros exportables.', true);
    const keys = Object.keys(source[0]);
    const csv = [keys.join(','), ...source.map(row => keys.map(key => csvValue(row[key])).join(','))].join('\r\n');
    const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `oleolab-${state.page}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    toast('Reporte CSV generado.');
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
  function csvValue(value) { const text = String(value ?? ''); return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
  function h(value) { return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
})();
