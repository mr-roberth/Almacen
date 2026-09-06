-- Oleolab Almacenes · Migración 003
-- Permisos por área, levantamiento inicial, Forecast desde Excel y mantenimiento colaborativo.
-- Esta migración es aditiva y puede importarse después de schema.sql v1.2.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS initial_inventory_sessions (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    session_number      VARCHAR(60) NOT NULL,
    warehouse_id        BIGINT UNSIGNED NOT NULL,
    inventory_date      DATE NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    notes               VARCHAR(1000) NULL,
    movement_id         BIGINT UNSIGNED NULL,
    created_by          BIGINT UNSIGNED NULL,
    posted_by           BIGINT UNSIGNED NULL,
    created_at          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    posted_at           DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_initial_inventory_number (session_number),
    KEY ix_initial_inventory_warehouse_date (warehouse_id, inventory_date),
    CONSTRAINT fk_initial_inventory_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
    CONSTRAINT fk_initial_inventory_movement FOREIGN KEY (movement_id) REFERENCES inventory_movements(id) ON DELETE SET NULL,
    CONSTRAINT fk_initial_inventory_created_by FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT fk_initial_inventory_posted_by FOREIGN KEY (posted_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_initial_inventory_status CHECK (status IN ('DRAFT','POSTED','CANCELLED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS initial_inventory_lines (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    initial_inventory_id    BIGINT UNSIGNED NOT NULL,
    line_no                 INT UNSIGNED NOT NULL,
    item_id                 BIGINT UNSIGNED NOT NULL,
    inventory_lot_id        BIGINT UNSIGNED NULL,
    location_id             BIGINT UNSIGNED NOT NULL,
    uom_id                  BIGINT UNSIGNED NOT NULL,
    counted_qty             DECIMAL(18,6) NOT NULL,
    quality_status          VARCHAR(20) NULL,
    notes                   VARCHAR(500) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_initial_inventory_line (initial_inventory_id, line_no),
    KEY ix_initial_inventory_dimension (item_id, inventory_lot_id, location_id),
    CONSTRAINT fk_initial_inventory_line_session FOREIGN KEY (initial_inventory_id) REFERENCES initial_inventory_sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_initial_inventory_line_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
    CONSTRAINT fk_initial_inventory_line_lot FOREIGN KEY (inventory_lot_id) REFERENCES inventory_lots(id) ON DELETE RESTRICT,
    CONSTRAINT fk_initial_inventory_line_location FOREIGN KEY (location_id) REFERENCES warehouse_locations(id) ON DELETE RESTRICT,
    CONSTRAINT fk_initial_inventory_line_uom FOREIGN KEY (uom_id) REFERENCES units_of_measure(id) ON DELETE RESTRICT,
    CONSTRAINT chk_initial_inventory_line_qty CHECK (counted_qty > 0),
    CONSTRAINT chk_initial_inventory_line_quality CHECK (quality_status IS NULL OR quality_status IN ('PENDING','APPROVED','CONDITIONAL','REJECTED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS maintenance_technicians (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id             BIGINT UNSIGNED NOT NULL,
    specialties         VARCHAR(500) NULL,
    phone               VARCHAR(40) NULL,
    is_active           TINYINT(1) NOT NULL DEFAULT 1,
    created_by          BIGINT UNSIGNED NULL,
    created_at          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_maintenance_technician_user (user_id),
    CONSTRAINT fk_maintenance_technician_user FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE,
    CONSTRAINT fk_maintenance_technician_creator FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_maintenance_technician_active CHECK (is_active IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS maintenance_work_requests (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    request_number          VARCHAR(60) NOT NULL,
    title                   VARCHAR(190) NOT NULL,
    description             VARCHAR(3000) NOT NULL,
    asset_id                BIGINT UNSIGNED NULL,
    requesting_area_id      BIGINT UNSIGNED NOT NULL,
    location_description    VARCHAR(255) NULL,
    requested_materials     VARCHAR(2000) NULL,
    priority_code           VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    needed_at               DATETIME(6) NOT NULL,
    status                  VARCHAR(25) NOT NULL DEFAULT 'REQUESTED',
    requested_by            BIGINT UNSIGNED NULL,
    verified_by             BIGINT UNSIGNED NULL,
    verified_at             DATETIME(6) NULL,
    created_at              DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at              DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_maintenance_work_request_number (request_number),
    KEY ix_maintenance_work_status (status, priority_code, needed_at),
    KEY ix_maintenance_work_area (requesting_area_id, created_at),
    CONSTRAINT fk_maintenance_work_asset FOREIGN KEY (asset_id) REFERENCES maintenance_assets(id) ON DELETE SET NULL,
    CONSTRAINT fk_maintenance_work_area FOREIGN KEY (requesting_area_id) REFERENCES areas(id) ON DELETE RESTRICT,
    CONSTRAINT fk_maintenance_work_requester FOREIGN KEY (requested_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT fk_maintenance_work_verifier FOREIGN KEY (verified_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_maintenance_work_priority CHECK (priority_code IN ('LOW','NORMAL','HIGH','CRITICAL')),
    CONSTRAINT chk_maintenance_work_status CHECK (status IN ('REQUESTED','ASSIGNED','IN_PROGRESS','WAITING_PARTS','COMPLETED','VERIFIED','CANCELLED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS maintenance_work_assignments (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    work_request_id         BIGINT UNSIGNED NOT NULL,
    technician_user_id      BIGINT UNSIGNED NOT NULL,
    assigned_by             BIGINT UNSIGNED NULL,
    estimated_hours         DECIMAL(8,2) NOT NULL DEFAULT 1,
    actual_hours            DECIMAL(8,2) NOT NULL DEFAULT 0,
    assignment_status       VARCHAR(20) NOT NULL DEFAULT 'ASSIGNED',
    work_notes              VARCHAR(3000) NULL,
    assigned_at             DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    started_at              DATETIME(6) NULL,
    completed_at            DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_maintenance_work_technician (work_request_id, technician_user_id),
    KEY ix_maintenance_assignment_technician (technician_user_id, assignment_status),
    CONSTRAINT fk_maintenance_assignment_request FOREIGN KEY (work_request_id) REFERENCES maintenance_work_requests(id) ON DELETE CASCADE,
    CONSTRAINT fk_maintenance_assignment_technician FOREIGN KEY (technician_user_id) REFERENCES app_users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_maintenance_assignment_assigner FOREIGN KEY (assigned_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_maintenance_assignment_hours CHECK (estimated_hours > 0 AND actual_hours >= 0),
    CONSTRAINT chk_maintenance_assignment_status CHECK (assignment_status IN ('ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS maintenance_work_updates (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    work_request_id         BIGINT UNSIGNED NOT NULL,
    assignment_id           BIGINT UNSIGNED NULL,
    status                  VARCHAR(25) NOT NULL,
    hours_reported          DECIMAL(8,2) NOT NULL DEFAULT 0,
    observations            VARCHAR(3000) NOT NULL,
    updated_by              BIGINT UNSIGNED NULL,
    created_at              DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY ix_maintenance_update_request (work_request_id, created_at),
    CONSTRAINT fk_maintenance_update_request FOREIGN KEY (work_request_id) REFERENCES maintenance_work_requests(id) ON DELETE CASCADE,
    CONSTRAINT fk_maintenance_update_assignment FOREIGN KEY (assignment_id) REFERENCES maintenance_work_assignments(id) ON DELETE SET NULL,
    CONSTRAINT fk_maintenance_update_user FOREIGN KEY (updated_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_maintenance_update_hours CHECK (hours_reported >= 0),
    CONSTRAINT chk_maintenance_update_status CHECK (status IN ('ASSIGNED','IN_PROGRESS','WAITING_PARTS','COMPLETED','VERIFIED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS email_notifications (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    event_type          VARCHAR(80) NOT NULL,
    entity_type         VARCHAR(80) NOT NULL,
    entity_id           VARCHAR(100) NOT NULL,
    recipient_email     VARCHAR(190) NOT NULL,
    recipient_name      VARCHAR(160) NULL,
    subject_line        VARCHAR(255) NOT NULL,
    delivery_status     VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
    error_message       VARCHAR(1000) NULL,
    queued_at           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    sent_at             DATETIME(6) NULL,
    PRIMARY KEY (id),
    KEY ix_email_notifications_entity (entity_type, entity_id),
    KEY ix_email_notifications_status (delivery_status, queued_at),
    CONSTRAINT chk_email_notifications_status CHECK (delivery_status IN ('QUEUED','SENT','FAILED','SKIPPED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS inventory_audit_schedules (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    schedule_name       VARCHAR(160) NOT NULL,
    warehouse_id        BIGINT UNSIGNED NOT NULL,
    weekday_codes       VARCHAR(40) NOT NULL,
    start_time          TIME NOT NULL,
    count_type          VARCHAR(25) NOT NULL DEFAULT 'SPOT',
    scope_description   VARCHAR(255) NOT NULL,
    notes               VARCHAR(1000) NULL,
    is_active           TINYINT(1) NOT NULL DEFAULT 1,
    created_by          BIGINT UNSIGNED NULL,
    created_at          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY ix_inventory_audit_schedule (warehouse_id, is_active),
    CONSTRAINT fk_inventory_audit_schedule_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
    CONSTRAINT fk_inventory_audit_schedule_creator FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_inventory_audit_schedule_type CHECK (count_type IN ('CYCLE','FULL','SPOT','QUALITY_HOLD')),
    CONSTRAINT chk_inventory_audit_schedule_active CHECK (is_active IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO roles (code, name, description, is_system) VALUES
('AREA_ADMIN', 'Administrador de área', 'Administra operaciones y usuarios de su propia área.', 1),
('TECHNICIAN', 'Técnico de mantenimiento', 'Atiende tareas asignadas y registra horas, observaciones y evidencias.', 1);

INSERT IGNORE INTO app_modules (code, name, route_path, sort_order) VALUES
('AREA_TEAM', 'Equipo del área', '/equipo', 25),
('INITIAL_INVENTORY', 'Levantamiento de inventario', '/almacen/levantamiento', 155);

INSERT IGNORE INTO permissions (module_id, action_code, description)
SELECT m.id, a.action_code, CONCAT(a.action_code, ' en ', m.name)
FROM app_modules m
CROSS JOIN (
    SELECT 'VIEW' AS action_code UNION ALL
    SELECT 'CREATE' UNION ALL SELECT 'UPDATE' UNION ALL SELECT 'APPROVE' UNION ALL
    SELECT 'REJECT' UNION ALL SELECT 'POST' UNION ALL SELECT 'EXPORT' UNION ALL SELECT 'ADMIN'
) a
WHERE m.code IN ('AREA_TEAM','INITIAL_INVENTORY');

-- Catálogos de ejemplo. No generan existencia; el inventario real se captura
-- posteriormente desde Levantamiento de inventario.
INSERT IGNORE INTO warehouses (code,name,warehouse_type,area_id)
SELECT 'EJ-MP','[EJEMPLO] Almacén de materia prima','RAW_MATERIAL',id FROM areas WHERE code='ALMACEN' LIMIT 1;
INSERT IGNORE INTO warehouses (code,name,warehouse_type,area_id)
SELECT 'EJ-EMPAQUE','[EJEMPLO] Almacén de materiales de empaque','PACKAGING',id FROM areas WHERE code='ALMACEN' LIMIT 1;
INSERT IGNORE INTO warehouses (code,name,warehouse_type,area_id)
SELECT 'EJ-REF','[EJEMPLO] Almacén de refacciones','SPARE_PARTS',id FROM areas WHERE code='ALMACEN' LIMIT 1;
INSERT IGNORE INTO warehouses (code,name,warehouse_type,area_id)
SELECT 'EJ-PT','[EJEMPLO] Almacén de producto terminado','FINISHED_GOODS',id FROM areas WHERE code='ALMACEN' LIMIT 1;

INSERT IGNORE INTO warehouse_locations (warehouse_id,code,name,location_type)
SELECT id,'RECIBO','[EJEMPLO] Zona de recibo','RECEIVING' FROM warehouses WHERE code IN ('EJ-MP','EJ-EMPAQUE','EJ-REF','EJ-PT');
INSERT IGNORE INTO warehouse_locations (warehouse_id,code,name,location_type)
SELECT id,'ALMACENAMIENTO','[EJEMPLO] Ubicación de almacenamiento','STORAGE' FROM warehouses WHERE code IN ('EJ-MP','EJ-EMPAQUE','EJ-REF','EJ-PT');

INSERT IGNORE INTO suppliers (supplier_code,short_code,legal_name,trade_name,contact_name,contact_email,default_lead_days)
VALUES ('EJ-PROV-001','EJP','[EJEMPLO] Proveedor Oleolab','[EJEMPLO] Proveedor de prueba','Contacto de ejemplo','proveedor.ejemplo@oleolab.mx',7);
INSERT IGNORE INTO supplier_origins (supplier_id,origin_code,origin_name,municipality,state_name)
SELECT id,'EJOR','[EJEMPLO] Huerta u origen','Uruapan','Michoacán' FROM suppliers WHERE supplier_code='EJ-PROV-001';
INSERT IGNORE INTO customers (customer_code,legal_name,trade_name,contact_name,contact_email)
VALUES ('EJ-CLI-001','[EJEMPLO] Cliente Oleolab','[EJEMPLO] Cliente de prueba','Contacto de ejemplo','cliente.ejemplo@oleolab.mx');

INSERT IGNORE INTO items (category_id,base_uom_id,sku,name,item_type,lot_controlled,quality_required,minimum_stock,reorder_point)
SELECT c.id,u.id,'EJ-MP-AGUACATE','[EJEMPLO] Aguacate Hass en fruta','RAW_FRUIT',1,1,1000,2000 FROM item_categories c,units_of_measure u WHERE c.code='FRUIT' AND u.code='KG';
INSERT IGNORE INTO items (category_id,base_uom_id,sku,name,item_type,lot_controlled,quality_required,minimum_stock,reorder_point)
SELECT c.id,u.id,'EJ-ACEITE-CRUDO','[EJEMPLO] Aceite crudo de aguacate','BULK_OIL',1,1,500,1000 FROM item_categories c,units_of_measure u WHERE c.code='BULK' AND u.code='L';
INSERT IGNORE INTO items (category_id,base_uom_id,sku,name,item_type,lot_controlled,quality_required,minimum_stock,reorder_point)
SELECT c.id,u.id,'EJ-ACEITE-LISTO','[EJEMPLO] Aceite de aguacate refinado listo para envasar','BULK_OIL',1,1,500,1000 FROM item_categories c,units_of_measure u WHERE c.code='BULK' AND u.code='L';
INSERT IGNORE INTO items (category_id,base_uom_id,sku,name,item_type,lot_controlled,quality_required,minimum_stock,reorder_point)
SELECT c.id,u.id,'EJ-BOTELLA-500','[EJEMPLO] Botella de vidrio de 500 mililitros','PACKAGING',1,1,1000,2500 FROM item_categories c,units_of_measure u WHERE c.code='PACK' AND u.code='EA';
INSERT IGNORE INTO items (category_id,base_uom_id,sku,name,item_type,lot_controlled,quality_required,minimum_stock,reorder_point)
SELECT c.id,u.id,'EJ-TAPA-500','[EJEMPLO] Tapa para botella de 500 mililitros','PACKAGING',1,1,1000,2500 FROM item_categories c,units_of_measure u WHERE c.code='PACK' AND u.code='EA';
INSERT IGNORE INTO items (category_id,base_uom_id,sku,name,item_type,lot_controlled,quality_required,minimum_stock,reorder_point)
SELECT c.id,u.id,'EJ-ETIQUETA-500','[EJEMPLO] Etiqueta para aceite de 500 mililitros','PACKAGING',1,1,1000,2500 FROM item_categories c,units_of_measure u WHERE c.code='PACK' AND u.code='EA';
INSERT IGNORE INTO items (category_id,base_uom_id,sku,name,item_type,lot_controlled,quality_required,minimum_stock,reorder_point)
SELECT c.id,u.id,'EJ-CAJA-12X500','[EJEMPLO] Caja para doce botellas de 500 mililitros','PACKAGING',1,1,100,250 FROM item_categories c,units_of_measure u WHERE c.code='PACK' AND u.code='EA';
INSERT IGNORE INTO items (category_id,base_uom_id,sku,name,item_type,lot_controlled,quality_required,minimum_stock,reorder_point)
SELECT c.id,u.id,'EJ-REF-RODAMIENTO','[EJEMPLO] Rodamiento para equipo de extracción','SPARE_PART',0,0,2,4 FROM item_categories c,units_of_measure u WHERE c.code='SPARE' AND u.code='EA';
INSERT IGNORE INTO items (category_id,base_uom_id,sku,name,item_type,lot_controlled,quality_required,minimum_stock,reorder_point)
SELECT c.id,u.id,'EJ-PT-ACEITE-500','[EJEMPLO] Aceite de aguacate en botella de 500 mililitros','FINISHED_GOOD',1,1,100,250 FROM item_categories c,units_of_measure u WHERE c.code='FG' AND u.code='EA';

INSERT IGNORE INTO supplier_items (supplier_id,item_id,lead_time_days,minimum_order_qty,is_preferred)
SELECT s.id,i.id,7,1000,1 FROM suppliers s,items i WHERE s.supplier_code='EJ-PROV-001' AND i.sku='EJ-MP-AGUACATE';
INSERT IGNORE INTO maintenance_assets (asset_code,asset_name,area_id)
SELECT 'EJ-EQUIPO-001','[EJEMPLO] Extractor de aceite',id FROM areas WHERE code='MANTENIMIENTO' LIMIT 1;
INSERT IGNORE INTO vehicles (unit_code,plate_number,vehicle_type,capacity_kg)
VALUES ('EJ-UNIDAD-01','EJEMPLO-01','[EJEMPLO] Camión de recolección',12000);
INSERT IGNORE INTO returnable_containers (container_code,container_type,nominal_capacity_kg,current_location)
VALUES ('EJ-CONTENEDOR-001','BEAN',400,'[EJEMPLO] Patio de materia prima');

INSERT IGNORE INTO bills_of_material (bom_code,output_item_id,name)
SELECT 'EJ-BOM-PT-500',id,'[EJEMPLO] Lista de materiales para botella de 500 mililitros' FROM items WHERE sku='EJ-PT-ACEITE-500';
INSERT IGNORE INTO bom_versions (bom_id,version_no,output_qty,output_uom_id,effective_from,status)
SELECT b.id,1,12,i.base_uom_id,'2020-01-01','ACTIVE' FROM bills_of_material b INNER JOIN items i ON i.id=b.output_item_id WHERE b.bom_code='EJ-BOM-PT-500';
INSERT IGNORE INTO bom_components (bom_version_id,line_no,component_item_id,component_uom_id,qty_per_output,scrap_pct)
SELECT bv.id,x.line_no,i.id,i.base_uom_id,x.quantity_value,x.scrap_value FROM bom_versions bv INNER JOIN bills_of_material b ON b.id=bv.bom_id INNER JOIN (
    SELECT 1 AS line_no,'EJ-ACEITE-LISTO' AS sku,6.00000000 AS quantity_value,2.0000 AS scrap_value UNION ALL
    SELECT 2,'EJ-BOTELLA-500',12.00000000,1.0000 UNION ALL
    SELECT 3,'EJ-TAPA-500',12.00000000,1.0000 UNION ALL
    SELECT 4,'EJ-ETIQUETA-500',12.00000000,2.0000 UNION ALL
    SELECT 5,'EJ-CAJA-12X500',1.00000000,0.0000
) x INNER JOIN items i ON i.sku=x.sku WHERE b.bom_code='EJ-BOM-PT-500' AND bv.version_no=1;

INSERT IGNORE INTO inventory_audit_schedules (schedule_name,warehouse_id,weekday_codes,start_time,count_type,scope_description,notes)
SELECT '[EJEMPLO] Conteo cíclico de materiales críticos',id,'MON,THU','08:00:00','CYCLE','Materiales con mayor movimiento y existencia crítica','Ejemplo de auditoría programada para lunes y jueves.' FROM warehouses WHERE code='EJ-EMPAQUE' LIMIT 1;

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM permissions p
INNER JOIN app_modules m ON m.id=p.module_id
INNER JOIN roles r ON r.code='SUPER_ADMIN'
WHERE m.code IN ('AREA_TEAM','INITIAL_INVENTORY');

INSERT IGNORE INTO schema_migrations (version_no, description)
VALUES ('003', 'Permisos por area, inventario inicial, Forecast Excel y mantenimiento colaborativo');
