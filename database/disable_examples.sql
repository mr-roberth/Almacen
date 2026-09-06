-- Oleolab Almacenes · Desactivar datos de ejemplo (opcional)
-- Use este archivo únicamente cuando ya haya creado sus catálogos reales.
-- No elimina movimientos, auditorías ni trazabilidad: solo oculta los ejemplos.

SET NAMES utf8mb4;

UPDATE inventory_audit_schedules
SET is_active = 0
WHERE schedule_name LIKE '[EJEMPLO]%';

UPDATE bom_versions bv
INNER JOIN bills_of_material b ON b.id = bv.bom_id
SET bv.status = 'OBSOLETE'
WHERE b.bom_code = 'EJ-BOM-PT-500';

UPDATE bills_of_material
SET is_active = 0
WHERE bom_code = 'EJ-BOM-PT-500';

UPDATE supplier_origins o
INNER JOIN suppliers s ON s.id = o.supplier_id
SET o.is_active = 0
WHERE s.supplier_code = 'EJ-PROV-001';

UPDATE warehouse_locations l
INNER JOIN warehouses w ON w.id = l.warehouse_id
SET l.is_active = 0
WHERE w.code IN ('EJ-MP','EJ-EMPAQUE','EJ-REF','EJ-PT');

UPDATE items SET is_active = 0 WHERE sku LIKE 'EJ-%';
UPDATE warehouses SET is_active = 0 WHERE code IN ('EJ-MP','EJ-EMPAQUE','EJ-REF','EJ-PT');
UPDATE suppliers SET is_active = 0 WHERE supplier_code = 'EJ-PROV-001';
UPDATE customers SET is_active = 0 WHERE customer_code = 'EJ-CLI-001';
UPDATE maintenance_assets SET is_active = 0 WHERE asset_code = 'EJ-EQUIPO-001';
UPDATE vehicles SET is_active = 0 WHERE unit_code = 'EJ-UNIDAD-01';
UPDATE returnable_containers SET is_active = 0 WHERE container_code = 'EJ-CONTENEDOR-001';
