-- Oleolab Almacenes · Migración 004
-- Módulos separados, WID, Calidad analítica, Envasado y Extracción trazable.
-- Migración aditiva e idempotente. Importar después de migration_v1_3.sql.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS inbound_appointment_lines (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    appointment_id          BIGINT UNSIGNED NOT NULL,
    line_no                 INT UNSIGNED NOT NULL,
    item_id                 BIGINT UNSIGNED NOT NULL,
    destination_warehouse_id BIGINT UNSIGNED NOT NULL,
    uom_id                  BIGINT UNSIGNED NOT NULL,
    expected_qty            DECIMAL(18,6) NOT NULL,
    received_qty            DECIMAL(18,6) NOT NULL DEFAULT 0,
    line_status             VARCHAR(25) NOT NULL DEFAULT 'EXPECTED',
    notes                   VARCHAR(500) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_inbound_appointment_line (appointment_id, line_no),
    KEY ix_inbound_expected_item (item_id, line_status),
    CONSTRAINT fk_inbound_line_appointment FOREIGN KEY (appointment_id) REFERENCES inbound_appointments(id) ON DELETE CASCADE,
    CONSTRAINT fk_inbound_line_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
    CONSTRAINT fk_inbound_line_warehouse FOREIGN KEY (destination_warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
    CONSTRAINT fk_inbound_line_uom FOREIGN KEY (uom_id) REFERENCES units_of_measure(id) ON DELETE RESTRICT,
    CONSTRAINT chk_inbound_line_qty CHECK (expected_qty > 0 AND received_qty >= 0),
    CONSTRAINT chk_inbound_line_status CHECK (line_status IN ('EXPECTED','PARTIALLY_RECEIVED','RECEIVED','CANCELLED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS quality_dispositions (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    quality_request_id      BIGINT UNSIGNED NOT NULL,
    received_qty            DECIMAL(18,6) NOT NULL,
    accepted_qty            DECIMAL(18,6) NOT NULL DEFAULT 0,
    rejected_qty            DECIMAL(18,6) NOT NULL DEFAULT 0,
    uom_id                  BIGINT UNSIGNED NOT NULL,
    accepted_lot_id         BIGINT UNSIGNED NULL,
    rejected_lot_id         BIGINT UNSIGNED NULL,
    accepted_location_id    BIGINT UNSIGNED NULL,
    rejected_location_id    BIGINT UNSIGNED NULL,
    observations            VARCHAR(2000) NOT NULL,
    decided_by              BIGINT UNSIGNED NULL,
    decided_at              DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_quality_disposition_request (quality_request_id),
    CONSTRAINT fk_quality_disposition_request FOREIGN KEY (quality_request_id) REFERENCES quality_requests(id) ON DELETE CASCADE,
    CONSTRAINT fk_quality_disposition_uom FOREIGN KEY (uom_id) REFERENCES units_of_measure(id) ON DELETE RESTRICT,
    CONSTRAINT fk_quality_disposition_accepted_lot FOREIGN KEY (accepted_lot_id) REFERENCES inventory_lots(id) ON DELETE SET NULL,
    CONSTRAINT fk_quality_disposition_rejected_lot FOREIGN KEY (rejected_lot_id) REFERENCES inventory_lots(id) ON DELETE SET NULL,
    CONSTRAINT fk_quality_disposition_accepted_location FOREIGN KEY (accepted_location_id) REFERENCES warehouse_locations(id) ON DELETE SET NULL,
    CONSTRAINT fk_quality_disposition_rejected_location FOREIGN KEY (rejected_location_id) REFERENCES warehouse_locations(id) ON DELETE SET NULL,
    CONSTRAINT fk_quality_disposition_user FOREIGN KEY (decided_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_quality_disposition_qty CHECK (received_qty > 0 AND accepted_qty >= 0 AND rejected_qty >= 0 AND accepted_qty + rejected_qty = received_qty)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS lot_relations (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    parent_lot_id       BIGINT UNSIGNED NOT NULL,
    child_lot_id        BIGINT UNSIGNED NOT NULL,
    relation_type       VARCHAR(30) NOT NULL,
    quantity            DECIMAL(18,6) NULL,
    reference_type      VARCHAR(50) NULL,
    reference_id        BIGINT UNSIGNED NULL,
    created_at          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_lot_relation (parent_lot_id, child_lot_id, relation_type),
    KEY ix_lot_relation_child (child_lot_id),
    CONSTRAINT fk_lot_relation_parent FOREIGN KEY (parent_lot_id) REFERENCES inventory_lots(id) ON DELETE RESTRICT,
    CONSTRAINT fk_lot_relation_child FOREIGN KEY (child_lot_id) REFERENCES inventory_lots(id) ON DELETE RESTRICT,
    CONSTRAINT chk_lot_relation_type CHECK (relation_type IN ('QUALITY_SPLIT','EXTRACTION','REFINING','BLENDING','PACKAGING','REWORK')),
    CONSTRAINT chk_lot_relation_distinct CHECK (parent_lot_id <> child_lot_id),
    CONSTRAINT chk_lot_relation_qty CHECK (quantity IS NULL OR quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS raw_material_quality_results (
    id                              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    quality_request_id              BIGINT UNSIGNED NOT NULL,
    week_number                     TINYINT UNSIGNED NOT NULL,
    sample_date                     DATE NOT NULL,
    quantity_kg                     DECIMAL(18,3) NULL,
    dry_matter_equipment_pct        DECIMAL(8,4) NULL,
    dry_matter_avocado_pulp_pct     DECIMAL(8,4) NULL,
    dry_matter_pulp_method_pct      DECIMAL(8,4) NULL,
    firmness_pa                     DECIMAL(12,4) NULL,
    avocado_yield_soxhlet_pct       DECIMAL(8,4) NULL,
    pulp_yield_soxhlet_pct          DECIMAL(8,4) NULL,
    free_fatty_acids_pct            DECIMAL(8,4) NULL,
    fruit_status                    VARCHAR(30) NULL,
    process_end_date                DATE NULL,
    extracted_oil_qty               DECIMAL(18,6) NULL,
    acidity_pct                     DECIMAL(8,4) NULL,
    observations                    VARCHAR(2000) NULL,
    recorded_by                     BIGINT UNSIGNED NULL,
    recorded_at                     DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_raw_quality_request (quality_request_id),
    CONSTRAINT fk_raw_quality_request FOREIGN KEY (quality_request_id) REFERENCES quality_requests(id) ON DELETE CASCADE,
    CONSTRAINT fk_raw_quality_user FOREIGN KEY (recorded_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_raw_quality_week CHECK (week_number BETWEEN 1 AND 53)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS extraction_runs (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    process_batch_id        BIGINT UNSIGNED NOT NULL,
    source_location_id      BIGINT UNSIGNED NOT NULL,
    output_location_id      BIGINT UNSIGNED NOT NULL,
    output_lot_id           BIGINT UNSIGNED NOT NULL,
    beans_count             INT UNSIGNED NOT NULL,
    operating_hours         DECIMAL(8,3) NOT NULL,
    target_beans_hour       DECIMAL(10,3) NOT NULL DEFAULT 13,
    created_by              BIGINT UNSIGNED NULL,
    created_at              DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_extraction_run_batch (process_batch_id),
    CONSTRAINT fk_extraction_run_batch FOREIGN KEY (process_batch_id) REFERENCES process_batches(id) ON DELETE CASCADE,
    CONSTRAINT fk_extraction_run_source_location FOREIGN KEY (source_location_id) REFERENCES warehouse_locations(id) ON DELETE RESTRICT,
    CONSTRAINT fk_extraction_run_output_location FOREIGN KEY (output_location_id) REFERENCES warehouse_locations(id) ON DELETE RESTRICT,
    CONSTRAINT fk_extraction_run_output_lot FOREIGN KEY (output_lot_id) REFERENCES inventory_lots(id) ON DELETE RESTRICT,
    CONSTRAINT fk_extraction_run_user FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_extraction_run_values CHECK (beans_count > 0 AND operating_hours > 0 AND target_beans_hour > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS extraction_quality_results (
    id                          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    quality_request_id          BIGINT UNSIGNED NOT NULL,
    process_batch_id            BIGINT UNSIGNED NOT NULL,
    week_number                 TINYINT UNSIGNED NOT NULL,
    sample_date                 DATE NOT NULL,
    shift_code                  VARCHAR(30) NOT NULL,
    equipment_code              VARCHAR(50) NULL,
    sample_type                 VARCHAR(25) NOT NULL,
    sample_lot_code             VARCHAR(100) NOT NULL,
    fruit_per_shift_kg          DECIMAL(18,3) NULL,
    grinding_against_target_pct DECIMAL(8,4) NULL,
    oil_wet_basis_pct           DECIMAL(8,4) NULL,
    oil_dry_basis_pct           DECIMAL(8,4) NULL,
    oil_in_fruit_pulp_pct       DECIMAL(8,4) NULL,
    retained_oil_pct            DECIMAL(8,4) NULL,
    obtaining_against_target_pct DECIMAL(8,4) NULL,
    oil_obtained_qty            DECIMAL(18,6) NULL,
    dry_matter_pct              DECIMAL(8,4) NULL,
    humidity_pct                DECIMAL(8,4) NULL,
    humidity_plus_dry_matter_pct DECIMAL(8,4) NULL,
    observations                VARCHAR(2000) NULL,
    recorded_by                 BIGINT UNSIGNED NULL,
    recorded_at                 DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_extraction_quality_request (quality_request_id),
    UNIQUE KEY uq_extraction_sample_lot (sample_lot_code),
    CONSTRAINT fk_extraction_quality_request FOREIGN KEY (quality_request_id) REFERENCES quality_requests(id) ON DELETE CASCADE,
    CONSTRAINT fk_extraction_quality_batch FOREIGN KEY (process_batch_id) REFERENCES process_batches(id) ON DELETE CASCADE,
    CONSTRAINT fk_extraction_quality_user FOREIGN KEY (recorded_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_extraction_quality_week CHECK (week_number BETWEEN 1 AND 53),
    CONSTRAINT chk_extraction_sample_type CHECK (sample_type IN ('PULP','WET_PASTE','DRY_PASTE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS production_completions (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    production_order_id     BIGINT UNSIGNED NOT NULL,
    completion_number       VARCHAR(60) NOT NULL,
    bom_version_id          BIGINT UNSIGNED NOT NULL,
    finished_lot_id         BIGINT UNSIGNED NOT NULL,
    output_location_id      BIGINT UNSIGNED NOT NULL,
    completed_qty           DECIMAL(18,6) NOT NULL,
    movement_id             BIGINT UNSIGNED NOT NULL,
    observations            VARCHAR(1000) NULL,
    completed_by            BIGINT UNSIGNED NULL,
    completed_at            DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_production_completion_number (completion_number),
    CONSTRAINT fk_production_completion_order FOREIGN KEY (production_order_id) REFERENCES production_orders(id) ON DELETE RESTRICT,
    CONSTRAINT fk_production_completion_bom FOREIGN KEY (bom_version_id) REFERENCES bom_versions(id) ON DELETE RESTRICT,
    CONSTRAINT fk_production_completion_lot FOREIGN KEY (finished_lot_id) REFERENCES inventory_lots(id) ON DELETE RESTRICT,
    CONSTRAINT fk_production_completion_location FOREIGN KEY (output_location_id) REFERENCES warehouse_locations(id) ON DELETE RESTRICT,
    CONSTRAINT fk_production_completion_movement FOREIGN KEY (movement_id) REFERENCES inventory_movements(id) ON DELETE RESTRICT,
    CONSTRAINT fk_production_completion_user FOREIGN KEY (completed_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_production_completion_qty CHECK (completed_qty > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS production_completion_materials (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    production_completion_id BIGINT UNSIGNED NOT NULL,
    component_item_id       BIGINT UNSIGNED NOT NULL,
    planned_qty             DECIMAL(18,6) NOT NULL,
    consumed_qty            DECIMAL(18,6) NOT NULL,
    waste_qty               DECIMAL(18,6) NOT NULL DEFAULT 0,
    uom_id                  BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_production_completion_component (production_completion_id, component_item_id),
    CONSTRAINT fk_completion_material_completion FOREIGN KEY (production_completion_id) REFERENCES production_completions(id) ON DELETE CASCADE,
    CONSTRAINT fk_completion_material_item FOREIGN KEY (component_item_id) REFERENCES items(id) ON DELETE RESTRICT,
    CONSTRAINT fk_completion_material_uom FOREIGN KEY (uom_id) REFERENCES units_of_measure(id) ON DELETE RESTRICT,
    CONSTRAINT chk_completion_material_qty CHECK (planned_qty >= 0 AND consumed_qty >= 0 AND waste_qty >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO areas (code,name) VALUES ('ENVASADO','Envasado');

UPDATE app_modules SET name='Movimientos y kardex' WHERE code='INVENTORY';

INSERT IGNORE INTO app_modules (code,name,route_path,sort_order) VALUES
('WAREHOUSE_RAW','Almacén de materia prima','/almacenes/materia-prima',81),
('WAREHOUSE_PACKAGING','Almacén de materiales de empaque','/almacenes/materiales-empaque',82),
('WAREHOUSE_SPARES','Almacén de refacciones','/almacenes/refacciones',83),
('WAREHOUSE_FINISHED','Almacén de producto terminado','/almacenes/producto-terminado',84),
('FILLING','Envasado y listas de materiales','/envasado',111),
('QUALITY_ANALYTICS','Resultados y maestro de lotes','/calidad/resultados',121);

INSERT IGNORE INTO permissions (module_id,action_code,description)
SELECT m.id,a.action_code,CONCAT(a.action_code,' en ',m.name)
FROM app_modules m
CROSS JOIN (
    SELECT 'VIEW' action_code UNION ALL SELECT 'CREATE' UNION ALL SELECT 'UPDATE' UNION ALL
    SELECT 'APPROVE' UNION ALL SELECT 'REJECT' UNION ALL SELECT 'POST' UNION ALL SELECT 'EXPORT' UNION ALL SELECT 'ADMIN'
) a
WHERE m.code IN ('WAREHOUSE_RAW','WAREHOUSE_PACKAGING','WAREHOUSE_SPARES','WAREHOUSE_FINISHED','FILLING','QUALITY_ANALYTICS');

INSERT IGNORE INTO role_permissions (role_id,permission_id)
SELECT r.id,p.id FROM roles r CROSS JOIN permissions p WHERE r.code='SUPER_ADMIN';

-- Cada almacén operativo recibe una ubicación bloqueada para rechazos de Calidad.
INSERT IGNORE INTO warehouse_locations (warehouse_id,code,name,location_type,is_blocked)
SELECT id,'RECHAZADO','Producto rechazado por Calidad','REJECTED',1
FROM warehouses
WHERE is_active=1 AND warehouse_type IN ('RAW_MATERIAL','PACKAGING','SPARE_PARTS','FINISHED_GOODS');

-- Ejemplos de empaque solicitados. Son catálogo, nunca existencia ficticia.
INSERT IGNORE INTO items (category_id,base_uom_id,sku,name,item_type,lot_controlled,quality_required,minimum_stock,reorder_point)
SELECT c.id,u.id,'EJ-SELLO-500','[EJEMPLO] Sello para botella de 500 mililitros','PACKAGING',1,1,1000,2500 FROM item_categories c,units_of_measure u WHERE c.code='PACK' AND u.code='EA';
INSERT IGNORE INTO items (category_id,base_uom_id,sku,name,item_type,lot_controlled,quality_required,minimum_stock,reorder_point)
SELECT c.id,u.id,'EJ-ETIQUETA-FRONTAL-500','[EJEMPLO] Etiqueta frontal para botella de 500 mililitros','PACKAGING',1,1,1000,2500 FROM item_categories c,units_of_measure u WHERE c.code='PACK' AND u.code='EA';
INSERT IGNORE INTO items (category_id,base_uom_id,sku,name,item_type,lot_controlled,quality_required,minimum_stock,reorder_point)
SELECT c.id,u.id,'EJ-ETIQUETA-REVERSA-500','[EJEMPLO] Etiqueta reversa para botella de 500 mililitros','PACKAGING',1,1,1000,2500 FROM item_categories c,units_of_measure u WHERE c.code='PACK' AND u.code='EA';

INSERT IGNORE INTO schema_migrations (version_no,description)
VALUES ('004','Módulos separados, WID, Calidad analítica, Envasado y Extracción trazable');
