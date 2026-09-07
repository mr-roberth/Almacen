-- Oleolab Almacenes · Migración 005
-- Convierte los almacenes base en configuración oficial y retira catálogos ficticios.
-- Importar después de migration_v1_4.sql.

SET NAMES utf8mb4;
SET time_zone = '+00:00';
START TRANSACTION;

-- Si todavía no existe un almacén real con el código oficial, reutiliza el registro
-- base para conservar sus ubicaciones y cualquier trazabilidad relacionada.
UPDATE warehouses example
LEFT JOIN warehouses official ON official.code='MP'
SET example.code='MP',example.name='Almacén de materia prima'
WHERE example.code='EJ-MP' AND official.id IS NULL;

UPDATE warehouses example
LEFT JOIN warehouses official ON official.code='EMPAQUE'
SET example.code='EMPAQUE',example.name='Almacén de materiales de empaque'
WHERE example.code='EJ-EMPAQUE' AND official.id IS NULL;

UPDATE warehouses example
LEFT JOIN warehouses official ON official.code='REFACCIONES'
SET example.code='REFACCIONES',example.name='Almacén de refacciones'
WHERE example.code='EJ-REF' AND official.id IS NULL;

UPDATE warehouses example
LEFT JOIN warehouses official ON official.code='PT'
SET example.code='PT',example.name='Almacén de producto terminado'
WHERE example.code='EJ-PT' AND official.id IS NULL;

-- Si ya existía un almacén oficial, oculta el duplicado de demostración.
UPDATE warehouses SET is_active=0 WHERE code IN ('EJ-MP','EJ-EMPAQUE','EJ-REF','EJ-PT');

-- Nombres comprensibles para las zonas físicas.
UPDATE warehouse_locations l
INNER JOIN warehouses w ON w.id=l.warehouse_id
SET l.name=CASE l.location_type
    WHEN 'RECEIVING' THEN 'Recepción temporal · mercancía recién llegada'
    WHEN 'QUALITY_HOLD' THEN 'Pendiente de liberación por Calidad'
    WHEN 'STORAGE' THEN 'Existencia disponible'
    WHEN 'PICKING' THEN 'Preparación de surtido'
    WHEN 'SHIPPING' THEN 'Preparación de embarque'
    WHEN 'REJECTED' THEN 'Producto rechazado · no disponible'
    ELSE REPLACE(l.name,'[EJEMPLO] ','')
END
WHERE w.code IN ('MP','EMPAQUE','REFACCIONES','PT')
  AND l.name IN (
      '[EJEMPLO] Zona de recibo',
      '[EJEMPLO] Ubicación de almacenamiento',
      'Producto rechazado por Calidad'
  );

-- Los siguientes eran únicamente datos ficticios. Se conservan físicamente para
-- no borrar relaciones, pero quedan inactivos y ya no aparecen en los combos.
UPDATE inventory_audit_schedules SET is_active=0 WHERE schedule_name LIKE '[EJEMPLO]%';
UPDATE bom_versions bv INNER JOIN bills_of_material b ON b.id=bv.bom_id
SET bv.status='OBSOLETE' WHERE b.bom_code='EJ-BOM-PT-500';
UPDATE bills_of_material SET is_active=0 WHERE bom_code='EJ-BOM-PT-500';
UPDATE supplier_origins o INNER JOIN suppliers s ON s.id=o.supplier_id
SET o.is_active=0 WHERE s.supplier_code='EJ-PROV-001';
UPDATE items SET is_active=0 WHERE sku IN (
    'EJ-MP-AGUACATE','EJ-ACEITE-CRUDO','EJ-ACEITE-LISTO',
    'EJ-BOTELLA-500','EJ-TAPA-500','EJ-SELLO-500',
    'EJ-ETIQUETA-500','EJ-ETIQUETA-FRONTAL-500','EJ-ETIQUETA-REVERSA-500',
    'EJ-CAJA-12X500','EJ-REF-RODAMIENTO','EJ-PT-ACEITE-500'
);
UPDATE suppliers SET is_active=0 WHERE supplier_code='EJ-PROV-001';
UPDATE customers SET is_active=0 WHERE customer_code='EJ-CLI-001';
UPDATE maintenance_assets SET is_active=0 WHERE asset_code='EJ-EQUIPO-001';
UPDATE vehicles SET is_active=0 WHERE unit_code='EJ-UNIDAD-01';
UPDATE returnable_containers SET is_active=0 WHERE container_code='EJ-CONTENEDOR-001';

INSERT IGNORE INTO schema_migrations (version_no,description)
VALUES ('005','Almacenes base oficiales, zonas claras y ejemplos sólo como sugerencias');

COMMIT;
