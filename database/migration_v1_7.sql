-- Oleolab Almacenes · Migración 007
-- Flujo simplificado de recolecciones de materia prima, Logística y conductores.
-- Importar después de migration_v1_6.sql con la base ci4kash_Oleolab seleccionada.

SET NAMES utf8mb4;
SET time_zone = '+00:00';
START TRANSACTION;

INSERT IGNORE INTO areas (code,name) VALUES
('LOGISTICA','Logística y Tráfico');

UPDATE areas SET name='Logística y Tráfico' WHERE code='LOGISTICA';

INSERT IGNORE INTO roles (code,name,description,is_system,is_active) VALUES
('LOGISTICS_COORDINATOR','Coordinador de Logística y Tráfico','Asigna unidades, conductores, contenedores y horarios de recolección.',1,1),
('DRIVER','Conductor u operador','Consulta sus recolecciones asignadas y reporta el avance del recorrido.',1,1);

INSERT IGNORE INTO app_modules (code,name,route_path,sort_order) VALUES
('LOGISTICS','Coordinación de Logística y Tráfico','/logistica/coordinacion',112),
('DRIVER_COLLECTIONS','Mis recolecciones asignadas','/logistica/mis-recolecciones',113);

INSERT IGNORE INTO units_of_measure (code,name,decimal_places) VALUES
('ROLL','Rollo',0),
('BAG','Saco o bolsa',0),
('DRUM','Tambor',0);

INSERT IGNORE INTO permissions (module_id,action_code,description)
SELECT m.id,a.action_code,CONCAT(a.action_code,' en ',m.name)
FROM app_modules m
CROSS JOIN (
  SELECT 'VIEW' action_code UNION ALL SELECT 'CREATE' UNION ALL SELECT 'UPDATE' UNION ALL
  SELECT 'APPROVE' UNION ALL SELECT 'REJECT' UNION ALL SELECT 'POST' UNION ALL
  SELECT 'EXPORT' UNION ALL SELECT 'ADMIN'
) a
WHERE m.code IN ('LOGISTICS','DRIVER_COLLECTIONS');

INSERT IGNORE INTO role_permissions (role_id,permission_id)
SELECT r.id,p.id
FROM roles r
INNER JOIN app_modules m ON m.code='LOGISTICS'
INNER JOIN permissions p ON p.module_id=m.id
WHERE r.code='LOGISTICS_COORDINATOR'
  AND p.action_code IN ('VIEW','CREATE','UPDATE','POST','EXPORT');

INSERT IGNORE INTO role_permissions (role_id,permission_id)
SELECT r.id,p.id
FROM roles r
INNER JOIN app_modules m ON m.code='DRIVER_COLLECTIONS'
INNER JOIN permissions p ON p.module_id=m.id
WHERE r.code='DRIVER'
  AND p.action_code IN ('VIEW','UPDATE','POST');

INSERT IGNORE INTO role_permissions (role_id,permission_id)
SELECT r.id,p.id FROM roles r CROSS JOIN permissions p WHERE r.code='SUPER_ADMIN';

-- Columnas aditivas. Los datos y relaciones existentes se conservan.
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='supplier_origins' AND column_name='address_text')=0,
  'ALTER TABLE supplier_origins ADD COLUMN address_text VARCHAR(500) NULL AFTER country_code',
  'SELECT 1'
); PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='vehicles' AND column_name='carrier_name')=0,
  'ALTER TABLE vehicles ADD COLUMN carrier_name VARCHAR(160) NULL AFTER vehicle_type',
  'SELECT 1'
); PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='vehicles' AND column_name='make_model')=0,
  'ALTER TABLE vehicles ADD COLUMN make_model VARCHAR(160) NULL AFTER carrier_name',
  'SELECT 1'
); PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='vehicles' AND column_name='default_driver_user_id')=0,
  'ALTER TABLE vehicles ADD COLUMN default_driver_user_id BIGINT UNSIGNED NULL AFTER capacity_kg',
  'SELECT 1'
); PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='vehicles' AND column_name='notes')=0,
  'ALTER TABLE vehicles ADD COLUMN notes VARCHAR(1000) NULL AFTER default_driver_user_id',
  'SELECT 1'
); PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='collection_plans' AND column_name='driver_user_id')=0,
  'ALTER TABLE collection_plans ADD COLUMN driver_user_id BIGINT UNSIGNED NULL AFTER vehicle_id',
  'SELECT 1'
); PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='collection_plans' AND column_name='bin_count')=0,
  'ALTER TABLE collection_plans ADD COLUMN bin_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER expected_weight_kg',
  'SELECT 1'
); PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='collection_plans' AND column_name='transport_presentation')=0,
  'ALTER TABLE collection_plans ADD COLUMN transport_presentation VARCHAR(20) NULL AFTER bin_count',
  'SELECT 1'
); PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='collection_plans' AND column_name='purchase_order_reference')=0,
  'ALTER TABLE collection_plans ADD COLUMN purchase_order_reference VARCHAR(80) NULL AFTER transport_presentation',
  'SELECT 1'
); PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='collection_plans' AND column_name='appointment_time_mode')=0,
  'ALTER TABLE collection_plans ADD COLUMN appointment_time_mode VARCHAR(20) NOT NULL DEFAULT ''ON_APPOINTMENT'' AFTER purchase_order_reference',
  'SELECT 1'
); PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='collection_plans' AND column_name='pickup_scheduled_at')=0,
  'ALTER TABLE collection_plans ADD COLUMN pickup_scheduled_at DATETIME(6) NULL AFTER appointment_time_mode',
  'SELECT 1'
); PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='collection_plans' AND column_name='loaded_at')=0,
  'ALTER TABLE collection_plans ADD COLUMN loaded_at DATETIME(6) NULL AFTER pickup_scheduled_at',
  'SELECT 1'
); PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='collection_plans' AND column_name='route_started_at')=0,
  'ALTER TABLE collection_plans ADD COLUMN route_started_at DATETIME(6) NULL AFTER loaded_at',
  'SELECT 1'
); PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='collection_plans' AND column_name='actual_arrival_at')=0,
  'ALTER TABLE collection_plans ADD COLUMN actual_arrival_at DATETIME(6) NULL AFTER route_started_at',
  'SELECT 1'
); PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='collection_plans' AND column_name='last_latitude')=0,
  'ALTER TABLE collection_plans ADD COLUMN last_latitude DECIMAL(10,7) NULL AFTER actual_arrival_at',
  'SELECT 1'
); PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='collection_plans' AND column_name='last_longitude')=0,
  'ALTER TABLE collection_plans ADD COLUMN last_longitude DECIMAL(10,7) NULL AFTER last_latitude',
  'SELECT 1'
); PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='collection_plans' AND column_name='last_location_accuracy_m')=0,
  'ALTER TABLE collection_plans ADD COLUMN last_location_accuracy_m DECIMAL(10,2) NULL AFTER last_longitude',
  'SELECT 1'
); PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='collection_plans' AND column_name='last_location_at')=0,
  'ALTER TABLE collection_plans ADD COLUMN last_location_at DATETIME(6) NULL AFTER last_location_accuracy_m',
  'SELECT 1'
); PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='collection_plans' AND column_name='route_distance_km')=0,
  'ALTER TABLE collection_plans ADD COLUMN route_distance_km DECIMAL(10,2) NULL AFTER last_location_at',
  'SELECT 1'
); PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='collection_plans' AND column_name='route_duration_minutes')=0,
  'ALTER TABLE collection_plans ADD COLUMN route_duration_minutes INT UNSIGNED NULL AFTER route_distance_km',
  'SELECT 1'
); PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

CREATE TABLE IF NOT EXISTS logistics_sites (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  site_code VARCHAR(40) NOT NULL,
  site_name VARCHAR(160) NOT NULL,
  address_text VARCHAR(500) NOT NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_logistics_sites_code (site_code),
  CONSTRAINT fk_logistics_sites_user FOREIGN KEY (updated_by) REFERENCES app_users(id) ON DELETE SET NULL,
  CONSTRAINT chk_logistics_sites_flags CHECK (is_default IN (0,1) AND is_active IN (0,1)),
  CONSTRAINT chk_logistics_sites_lat CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT chk_logistics_sites_lon CHECK (longitude BETWEEN -180 AND 180)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS collection_route_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  collection_plan_id BIGINT UNSIGNED NOT NULL,
  event_type VARCHAR(30) NOT NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  accuracy_m DECIMAL(10,2) NULL,
  route_distance_km DECIMAL(10,2) NULL,
  route_duration_minutes INT UNSIGNED NULL,
  notes VARCHAR(500) NULL,
  recorded_by BIGINT UNSIGNED NULL,
  occurred_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY ix_collection_route_plan_time (collection_plan_id,occurred_at),
  CONSTRAINT fk_collection_route_plan FOREIGN KEY (collection_plan_id) REFERENCES collection_plans(id) ON DELETE CASCADE,
  CONSTRAINT fk_collection_route_user FOREIGN KEY (recorded_by) REFERENCES app_users(id) ON DELETE SET NULL,
  CONSTRAINT chk_collection_route_type CHECK (event_type IN ('LOADED','ROUTE_STARTED','LOCATION_UPDATE','ARRIVED')),
  CONSTRAINT chk_collection_route_lat CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CONSTRAINT chk_collection_route_lon CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema=DATABASE() AND constraint_name='fk_vehicles_default_driver')=0,
  'ALTER TABLE vehicles ADD CONSTRAINT fk_vehicles_default_driver FOREIGN KEY (default_driver_user_id) REFERENCES app_users(id) ON DELETE SET NULL',
  'SELECT 1'
); PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema=DATABASE() AND constraint_name='fk_collection_driver')=0,
  'ALTER TABLE collection_plans ADD CONSTRAINT fk_collection_driver FOREIGN KEY (driver_user_id) REFERENCES app_users(id) ON DELETE SET NULL',
  'SELECT 1'
); PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

INSERT IGNORE INTO schema_migrations (version_no,description)
VALUES ('007','Recolecciones simplificadas, Logística, conductores, ubicación y ruta');

COMMIT;

SELECT
  (SELECT COUNT(*) FROM app_modules WHERE code IN ('LOGISTICS','DRIVER_COLLECTIONS')) AS modulos_logistica,
  (SELECT COUNT(*) FROM roles WHERE code IN ('LOGISTICS_COORDINATOR','DRIVER')) AS roles_logistica,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('logistics_sites','collection_route_events')) AS tablas_logistica;
