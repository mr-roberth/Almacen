-- Olea Control - Esquema inicial v1.2 para Almacenes, MRP y trazabilidad
-- Compatible con MySQL Community Server 8.0.46 / InnoDB / utf8mb4.
--
-- IMPORTANTE
-- 1. Seleccione primero la base de datos de Oleolab en phpMyAdmin.
--    Si la importacion v1 se detuvo en forecast_versions, puede volver a
--    importar este archivo: las tablas ya creadas se omiten con IF NOT EXISTS,
--    las vistas se actualizan y los objetos programables se recrean.
-- 2. Este archivo no crea ni elimina la base de datos.
-- 3. No contiene usuarios, contrasenas ni credenciales de MySQL.
-- 4. Las existencias se obtienen del libro mayor; no se editan directamente.

SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;
SET time_zone = '+00:00';
SET sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- -----------------------------------------------------------------------------
-- CONTROL DE VERSION Y ORGANIZACION
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS schema_migrations (
    version_no      VARCHAR(30)  NOT NULL,
    description     VARCHAR(255) NOT NULL,
    applied_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (version_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS areas (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code            VARCHAR(30)  NOT NULL,
    name            VARCHAR(120) NOT NULL,
    is_active       TINYINT(1)   NOT NULL DEFAULT 1,
    created_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_areas_code (code),
    CONSTRAINT chk_areas_active CHECK (is_active IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS app_users (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    primary_area_id         BIGINT UNSIGNED NULL,
    email                   VARCHAR(190) NOT NULL,
    display_name            VARCHAR(160) NOT NULL,
    phone_number            VARCHAR(40)  NULL,
    password_hash           VARCHAR(255) NOT NULL,
    status                  VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    must_change_password    TINYINT(1)   NOT NULL DEFAULT 1,
    failed_login_count      INT UNSIGNED NOT NULL DEFAULT 0,
    locked_until            DATETIME(6)  NULL,
    last_login_at           DATETIME(6)  NULL,
    created_at              DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at              DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_app_users_email (email),
    KEY ix_app_users_area (primary_area_id),
    CONSTRAINT fk_app_users_area FOREIGN KEY (primary_area_id) REFERENCES areas(id) ON DELETE SET NULL,
    CONSTRAINT chk_app_users_status CHECK (status IN ('INVITED','ACTIVE','LOCKED','DISABLED')),
    CONSTRAINT chk_app_users_password_change CHECK (must_change_password IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS roles (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code            VARCHAR(40)  NOT NULL,
    name            VARCHAR(100) NOT NULL,
    description     VARCHAR(255) NULL,
    is_system       TINYINT(1)   NOT NULL DEFAULT 0,
    is_active       TINYINT(1)   NOT NULL DEFAULT 1,
    created_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_roles_code (code),
    CONSTRAINT chk_roles_flags CHECK (is_system IN (0,1) AND is_active IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS app_modules (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code            VARCHAR(50)  NOT NULL,
    name            VARCHAR(120) NOT NULL,
    route_path      VARCHAR(190) NULL,
    sort_order      INT NOT NULL DEFAULT 0,
    is_active       TINYINT(1) NOT NULL DEFAULT 1,
    created_at      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_app_modules_code (code),
    CONSTRAINT chk_app_modules_active CHECK (is_active IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS permissions (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    module_id       BIGINT UNSIGNED NOT NULL,
    action_code     VARCHAR(30) NOT NULL,
    description     VARCHAR(255) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_permissions_module_action (module_id, action_code),
    CONSTRAINT fk_permissions_module FOREIGN KEY (module_id) REFERENCES app_modules(id) ON DELETE CASCADE,
    CONSTRAINT chk_permissions_action CHECK (action_code IN ('VIEW','CREATE','UPDATE','APPROVE','REJECT','POST','EXPORT','ADMIN'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS user_roles (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id             BIGINT UNSIGNED NOT NULL,
    role_id             BIGINT UNSIGNED NOT NULL,
    is_active           TINYINT(1) NOT NULL DEFAULT 1,
    assigned_by         BIGINT UNSIGNED NULL,
    assigned_at         DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    -- El rol SUPER_ADMIN se siembra con id=1. Esta columna permite como maximo uno activo.
    super_admin_guard   TINYINT GENERATED ALWAYS AS (
        CASE WHEN role_id = 1 AND is_active = 1 THEN 1 ELSE NULL END
    ) STORED,
    PRIMARY KEY (id),
    UNIQUE KEY uq_user_roles_user_role (user_id, role_id),
    UNIQUE KEY uq_one_active_super_admin (super_admin_guard),
    KEY ix_user_roles_role (role_id),
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT,
    CONSTRAINT fk_user_roles_assigned_by FOREIGN KEY (assigned_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_user_roles_active CHECK (is_active IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id         BIGINT UNSIGNED NOT NULL,
    permission_id   BIGINT UNSIGNED NOT NULL,
    granted_by      BIGINT UNSIGNED NULL,
    granted_at      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (role_id, permission_id),
    CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    CONSTRAINT fk_role_permissions_granted_by FOREIGN KEY (granted_by) REFERENCES app_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS user_permission_overrides (
    user_id         BIGINT UNSIGNED NOT NULL,
    permission_id   BIGINT UNSIGNED NOT NULL,
    decision        VARCHAR(10) NOT NULL,
    changed_by      BIGINT UNSIGNED NULL,
    changed_at      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (user_id, permission_id),
    CONSTRAINT fk_user_permission_user FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_permission_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_permission_changed_by FOREIGN KEY (changed_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_user_permission_decision CHECK (decision IN ('ALLOW','DENY'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS auth_sessions (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id         BIGINT UNSIGNED NOT NULL,
    token_hash      CHAR(64) NOT NULL,
    expires_at      DATETIME(6) NOT NULL,
    last_seen_at    DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    revoked_at      DATETIME(6) NULL,
    ip_address      VARBINARY(16) NULL,
    user_agent      VARCHAR(500) NULL,
    created_at      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_auth_sessions_token (token_hash),
    KEY ix_auth_sessions_user_status (user_id, revoked_at, expires_at),
    CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS auth_events (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id         BIGINT UNSIGNED NULL,
    event_type      VARCHAR(30) NOT NULL,
    ip_address      VARBINARY(16) NULL,
    user_agent      VARCHAR(500) NULL,
    occurred_at     DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY ix_auth_events_user_time (user_id, occurred_at),
    CONSTRAINT fk_auth_events_user FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_auth_events_type CHECK (event_type IN ('LOGIN_OK','LOGIN_FAILED','LOGOUT','LOCKED','PASSWORD_CHANGED','PASSWORD_RESET'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS audit_log (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    actor_user_id   BIGINT UNSIGNED NULL,
    area_id         BIGINT UNSIGNED NULL,
    action_code     VARCHAR(40) NOT NULL,
    entity_type     VARCHAR(80) NOT NULL,
    entity_id       VARCHAR(100) NULL,
    reason          VARCHAR(500) NULL,
    before_data     JSON NULL,
    after_data      JSON NULL,
    request_id      VARCHAR(80) NULL,
    ip_address      VARBINARY(16) NULL,
    occurred_at     DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY ix_audit_entity (entity_type, entity_id, occurred_at),
    KEY ix_audit_actor (actor_user_id, occurred_at),
    KEY ix_audit_area (area_id, occurred_at),
    CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT fk_audit_area FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- CATALOGOS MAESTROS
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS units_of_measure (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code            VARCHAR(20) NOT NULL,
    name            VARCHAR(80) NOT NULL,
    decimal_places  TINYINT UNSIGNED NOT NULL DEFAULT 3,
    PRIMARY KEY (id),
    UNIQUE KEY uq_units_code (code),
    CONSTRAINT chk_units_decimals CHECK (decimal_places <= 6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS item_categories (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    parent_category_id  BIGINT UNSIGNED NULL,
    code                VARCHAR(30) NOT NULL,
    name                VARCHAR(120) NOT NULL,
    is_active           TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uq_item_categories_code (code),
    CONSTRAINT fk_item_categories_parent FOREIGN KEY (parent_category_id) REFERENCES item_categories(id) ON DELETE RESTRICT,
    CONSTRAINT chk_item_categories_active CHECK (is_active IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS items (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    category_id             BIGINT UNSIGNED NOT NULL,
    base_uom_id             BIGINT UNSIGNED NOT NULL,
    sku                     VARCHAR(80) NOT NULL,
    name                    VARCHAR(190) NOT NULL,
    item_type               VARCHAR(30) NOT NULL,
    lot_controlled          TINYINT(1) NOT NULL DEFAULT 1,
    expiry_controlled       TINYINT(1) NOT NULL DEFAULT 0,
    quality_required        TINYINT(1) NOT NULL DEFAULT 0,
    allow_negative_stock    TINYINT(1) NOT NULL DEFAULT 0,
    minimum_stock           DECIMAL(18,6) NOT NULL DEFAULT 0,
    reorder_point           DECIMAL(18,6) NOT NULL DEFAULT 0,
    lead_time_days          INT UNSIGNED NOT NULL DEFAULT 0,
    is_active               TINYINT(1) NOT NULL DEFAULT 1,
    created_by              BIGINT UNSIGNED NULL,
    created_at              DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at              DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_items_sku (sku),
    KEY ix_items_category (category_id),
    KEY ix_items_type_active (item_type, is_active),
    CONSTRAINT fk_items_category FOREIGN KEY (category_id) REFERENCES item_categories(id) ON DELETE RESTRICT,
    CONSTRAINT fk_items_uom FOREIGN KEY (base_uom_id) REFERENCES units_of_measure(id) ON DELETE RESTRICT,
    CONSTRAINT fk_items_created_by FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_items_type CHECK (item_type IN ('RAW_FRUIT','RAW_OTHER','PACKAGING','SPARE_PART','CONSUMABLE','BULK_OIL','FINISHED_GOOD','SERVICE')),
    CONSTRAINT chk_items_flags CHECK (lot_controlled IN (0,1) AND expiry_controlled IN (0,1) AND quality_required IN (0,1) AND allow_negative_stock IN (0,1) AND is_active IN (0,1)),
    CONSTRAINT chk_items_levels CHECK (minimum_stock >= 0 AND reorder_point >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS item_uom_conversions (
    item_id         BIGINT UNSIGNED NOT NULL,
    from_uom_id     BIGINT UNSIGNED NOT NULL,
    to_uom_id       BIGINT UNSIGNED NOT NULL,
    factor          DECIMAL(18,8) NOT NULL,
    PRIMARY KEY (item_id, from_uom_id, to_uom_id),
    CONSTRAINT fk_item_uom_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    CONSTRAINT fk_item_uom_from FOREIGN KEY (from_uom_id) REFERENCES units_of_measure(id) ON DELETE RESTRICT,
    CONSTRAINT fk_item_uom_to FOREIGN KEY (to_uom_id) REFERENCES units_of_measure(id) ON DELETE RESTRICT,
    CONSTRAINT chk_item_uom_factor CHECK (factor > 0 AND from_uom_id <> to_uom_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS warehouses (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code            VARCHAR(30) NOT NULL,
    name            VARCHAR(120) NOT NULL,
    warehouse_type  VARCHAR(30) NOT NULL,
    area_id         BIGINT UNSIGNED NULL,
    is_active       TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uq_warehouses_code (code),
    CONSTRAINT fk_warehouses_area FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL,
    CONSTRAINT chk_warehouses_type CHECK (warehouse_type IN ('RAW_MATERIAL','PACKAGING','SPARE_PARTS','PROCESS','FINISHED_GOODS','QUARANTINE','REJECTED','RETURNS')),
    CONSTRAINT chk_warehouses_active CHECK (is_active IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS warehouse_locations (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    warehouse_id    BIGINT UNSIGNED NOT NULL,
    code            VARCHAR(50) NOT NULL,
    name            VARCHAR(120) NOT NULL,
    location_type   VARCHAR(30) NOT NULL DEFAULT 'STORAGE',
    capacity_qty    DECIMAL(18,6) NULL,
    is_blocked      TINYINT(1) NOT NULL DEFAULT 0,
    is_active       TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uq_locations_warehouse_code (warehouse_id, code),
    UNIQUE KEY uq_locations_warehouse_id (warehouse_id, id),
    CONSTRAINT fk_locations_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
    CONSTRAINT chk_locations_type CHECK (location_type IN ('RECEIVING','QUALITY_HOLD','STORAGE','PICKING','PRODUCTION','SHIPPING','REJECTED','RETURNS')),
    CONSTRAINT chk_locations_flags CHECK (is_blocked IN (0,1) AND is_active IN (0,1)),
    CONSTRAINT chk_locations_capacity CHECK (capacity_qty IS NULL OR capacity_qty > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS suppliers (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    supplier_code       VARCHAR(40) NOT NULL,
    short_code          VARCHAR(12) NOT NULL,
    legal_name          VARCHAR(190) NOT NULL,
    trade_name          VARCHAR(190) NULL,
    tax_id              VARCHAR(30) NULL,
    contact_name        VARCHAR(160) NULL,
    contact_phone       VARCHAR(40) NULL,
    contact_email       VARCHAR(190) NULL,
    address_text        VARCHAR(500) NULL,
    default_lead_days   INT UNSIGNED NOT NULL DEFAULT 0,
    appointment_required TINYINT(1) NOT NULL DEFAULT 1,
    is_active           TINYINT(1) NOT NULL DEFAULT 1,
    created_by          BIGINT UNSIGNED NULL,
    created_at          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_suppliers_code (supplier_code),
    UNIQUE KEY uq_suppliers_short_code (short_code),
    UNIQUE KEY uq_suppliers_tax_id (tax_id),
    CONSTRAINT fk_suppliers_created_by FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_suppliers_flags CHECK (appointment_required IN (0,1) AND is_active IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS supplier_origins (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    supplier_id     BIGINT UNSIGNED NOT NULL,
    origin_code     VARCHAR(12) NOT NULL,
    origin_name     VARCHAR(160) NOT NULL,
    municipality    VARCHAR(120) NULL,
    state_name      VARCHAR(120) NULL,
    country_code    CHAR(2) NOT NULL DEFAULT 'MX',
    latitude        DECIMAL(10,7) NULL,
    longitude       DECIMAL(10,7) NULL,
    is_active       TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uq_supplier_origins_code (supplier_id, origin_code),
    UNIQUE KEY uq_supplier_origins_supplier_id (supplier_id, id),
    CONSTRAINT fk_supplier_origins_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
    CONSTRAINT chk_supplier_origins_active CHECK (is_active IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS supplier_items (
    supplier_id         BIGINT UNSIGNED NOT NULL,
    item_id             BIGINT UNSIGNED NOT NULL,
    supplier_item_code  VARCHAR(80) NULL,
    lead_time_days      INT UNSIGNED NOT NULL DEFAULT 0,
    minimum_order_qty   DECIMAL(18,6) NOT NULL DEFAULT 0,
    is_preferred        TINYINT(1) NOT NULL DEFAULT 0,
    is_active           TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (supplier_id, item_id),
    CONSTRAINT fk_supplier_items_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
    CONSTRAINT fk_supplier_items_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    CONSTRAINT chk_supplier_items_flags CHECK (is_preferred IN (0,1) AND is_active IN (0,1)),
    CONSTRAINT chk_supplier_items_minimum CHECK (minimum_order_qty >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS customers (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    customer_code   VARCHAR(40) NOT NULL,
    legal_name      VARCHAR(190) NOT NULL,
    trade_name      VARCHAR(190) NULL,
    tax_id          VARCHAR(30) NULL,
    contact_name    VARCHAR(160) NULL,
    contact_email   VARCHAR(190) NULL,
    contact_phone   VARCHAR(40) NULL,
    is_active       TINYINT(1) NOT NULL DEFAULT 1,
    created_at      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_customers_code (customer_code),
    UNIQUE KEY uq_customers_tax_id (tax_id),
    CONSTRAINT chk_customers_active CHECK (is_active IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS vehicles (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    unit_code       VARCHAR(40) NOT NULL,
    plate_number    VARCHAR(30) NULL,
    vehicle_type    VARCHAR(40) NOT NULL,
    capacity_kg     DECIMAL(18,3) NULL,
    is_active       TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uq_vehicles_unit_code (unit_code),
    UNIQUE KEY uq_vehicles_plate (plate_number),
    CONSTRAINT chk_vehicles_capacity CHECK (capacity_kg IS NULL OR capacity_kg > 0),
    CONSTRAINT chk_vehicles_active CHECK (is_active IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS returnable_containers (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    container_code      VARCHAR(60) NOT NULL,
    container_type      VARCHAR(30) NOT NULL DEFAULT 'BEAN',
    nominal_capacity_kg DECIMAL(18,3) NOT NULL DEFAULT 400,
    status              VARCHAR(25) NOT NULL DEFAULT 'AVAILABLE',
    current_location    VARCHAR(190) NULL,
    last_event_at       DATETIME(6) NULL,
    is_active           TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uq_containers_code (container_code),
    KEY ix_containers_status (status),
    CONSTRAINT chk_containers_capacity CHECK (nominal_capacity_kg > 0),
    CONSTRAINT chk_containers_status CHECK (status IN ('AVAILABLE','ASSIGNED','IN_TRANSIT','FULL','IN_PROCESS','CLEANING','MAINTENANCE','LOST','RETIRED')),
    CONSTRAINT chk_containers_active CHECK (is_active IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS container_events (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    container_id    BIGINT UNSIGNED NOT NULL,
    event_type      VARCHAR(30) NOT NULL,
    reference_type  VARCHAR(50) NULL,
    reference_id    BIGINT UNSIGNED NULL,
    location_text   VARCHAR(190) NULL,
    notes           VARCHAR(500) NULL,
    recorded_by     BIGINT UNSIGNED NULL,
    occurred_at     DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY ix_container_events_container_time (container_id, occurred_at),
    CONSTRAINT fk_container_events_container FOREIGN KEY (container_id) REFERENCES returnable_containers(id) ON DELETE RESTRICT,
    CONSTRAINT fk_container_events_user FOREIGN KEY (recorded_by) REFERENCES app_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- RECOLECCIONES, CITAS, PRE-LOTES Y RECEPCIONES
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS collection_plans (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    plan_number         VARCHAR(50) NOT NULL,
    supplier_id         BIGINT UNSIGNED NOT NULL,
    origin_id           BIGINT UNSIGNED NOT NULL,
    vehicle_id          BIGINT UNSIGNED NULL,
    planned_departure   DATETIME(6) NULL,
    planned_arrival     DATETIME(6) NOT NULL,
    expected_weight_kg  DECIMAL(18,3) NULL,
    status              VARCHAR(25) NOT NULL DEFAULT 'DRAFT',
    logistics_notes     VARCHAR(1000) NULL,
    purchase_notes      VARCHAR(1000) NULL,
    created_by          BIGINT UNSIGNED NULL,
    created_at          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_collection_plans_number (plan_number),
    KEY ix_collection_plans_arrival (planned_arrival, status),
    CONSTRAINT fk_collection_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    CONSTRAINT fk_collection_supplier_origin FOREIGN KEY (supplier_id, origin_id) REFERENCES supplier_origins(supplier_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_collection_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
    CONSTRAINT fk_collection_created_by FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_collection_weight CHECK (expected_weight_kg IS NULL OR expected_weight_kg > 0),
    CONSTRAINT chk_collection_status CHECK (status IN ('DRAFT','PLANNED','CONFIRMED','IN_ROUTE','ARRIVED','COMPLETED','CANCELLED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS collection_plan_containers (
    collection_plan_id  BIGINT UNSIGNED NOT NULL,
    container_id        BIGINT UNSIGNED NOT NULL,
    assigned_by         BIGINT UNSIGNED NULL,
    assigned_at         DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (collection_plan_id, container_id),
    CONSTRAINT fk_collection_containers_plan FOREIGN KEY (collection_plan_id) REFERENCES collection_plans(id) ON DELETE CASCADE,
    CONSTRAINT fk_collection_containers_container FOREIGN KEY (container_id) REFERENCES returnable_containers(id) ON DELETE RESTRICT,
    CONSTRAINT fk_collection_containers_user FOREIGN KEY (assigned_by) REFERENCES app_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS inbound_appointments (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    appointment_number      VARCHAR(50) NOT NULL,
    supplier_id             BIGINT UNSIGNED NOT NULL,
    origin_id               BIGINT UNSIGNED NULL,
    collection_plan_id      BIGINT UNSIGNED NULL,
    delivery_type           VARCHAR(30) NOT NULL,
    scheduled_start         DATETIME(6) NOT NULL,
    scheduled_end           DATETIME(6) NOT NULL,
    expected_item_type      VARCHAR(30) NOT NULL,
    expected_weight_kg      DECIMAL(18,3) NULL,
    expected_packages       INT UNSIGNED NULL,
    confirmation_token_hash CHAR(64) NULL,
    supplier_confirmed_at   DATETIME(6) NULL,
    actual_arrival_at       DATETIME(6) NULL,
    actual_departure_at     DATETIME(6) NULL,
    status                  VARCHAR(25) NOT NULL DEFAULT 'PLANNED',
    delay_minutes           INT GENERATED ALWAYS AS (
        CASE WHEN actual_arrival_at IS NULL THEN NULL
             ELSE TIMESTAMPDIFF(MINUTE, scheduled_start, actual_arrival_at) END
    ) STORED,
    notes                   VARCHAR(1000) NULL,
    created_by              BIGINT UNSIGNED NULL,
    created_at              DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at              DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_inbound_appointments_number (appointment_number),
    UNIQUE KEY uq_inbound_appointments_token (confirmation_token_hash),
    KEY ix_inbound_calendar (scheduled_start, scheduled_end, status),
    KEY ix_inbound_supplier (supplier_id, scheduled_start),
    CONSTRAINT fk_inbound_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    CONSTRAINT fk_inbound_supplier_origin FOREIGN KEY (supplier_id, origin_id) REFERENCES supplier_origins(supplier_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_inbound_collection FOREIGN KEY (collection_plan_id) REFERENCES collection_plans(id) ON DELETE SET NULL,
    CONSTRAINT fk_inbound_created_by FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_inbound_window CHECK (scheduled_end > scheduled_start),
    CONSTRAINT chk_inbound_delivery_type CHECK (delivery_type IN ('COLLECTION','SUPPLIER_DELIVERY','TRANSFER','RETURN','OTHER')),
    CONSTRAINT chk_inbound_item_type CHECK (expected_item_type IN ('RAW_FRUIT','RAW_OTHER','PACKAGING','SPARE_PART','CONSUMABLE','RETURN','MIXED')),
    CONSTRAINT chk_inbound_status CHECK (status IN ('PLANNED','SENT','CONFIRMED','ARRIVED','IN_INSPECTION','COMPLETED','NO_SHOW','CANCELLED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS prelot_sequences (
    supplier_id     BIGINT UNSIGNED NOT NULL,
    origin_id       BIGINT UNSIGNED NOT NULL,
    lot_date        DATE NOT NULL,
    next_value      INT UNSIGNED NOT NULL,
    PRIMARY KEY (supplier_id, origin_id, lot_date),
    CONSTRAINT fk_prelot_sequence_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    CONSTRAINT fk_prelot_sequence_supplier_origin FOREIGN KEY (supplier_id, origin_id) REFERENCES supplier_origins(supplier_id, id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS pre_lots (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    prelot_code             VARCHAR(80) NOT NULL,
    supplier_id             BIGINT UNSIGNED NOT NULL,
    origin_id               BIGINT UNSIGNED NOT NULL,
    appointment_id          BIGINT UNSIGNED NULL,
    planned_arrival_date    DATE NOT NULL,
    daily_sequence          INT UNSIGNED NOT NULL,
    expected_weight_kg      DECIMAL(18,3) NULL,
    status                  VARCHAR(25) NOT NULL DEFAULT 'PLANNED',
    confirmed_at            DATETIME(6) NULL,
    created_by              BIGINT UNSIGNED NULL,
    created_at              DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_pre_lots_code (prelot_code),
    UNIQUE KEY uq_pre_lots_natural (supplier_id, origin_id, planned_arrival_date, daily_sequence),
    KEY ix_pre_lots_appointment (appointment_id),
    CONSTRAINT fk_pre_lots_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    CONSTRAINT fk_pre_lots_supplier_origin FOREIGN KEY (supplier_id, origin_id) REFERENCES supplier_origins(supplier_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_pre_lots_appointment FOREIGN KEY (appointment_id) REFERENCES inbound_appointments(id) ON DELETE SET NULL,
    CONSTRAINT fk_pre_lots_created_by FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_pre_lots_weight CHECK (expected_weight_kg IS NULL OR expected_weight_kg > 0),
    CONSTRAINT chk_pre_lots_status CHECK (status IN ('PLANNED','CONFIRMED','RECEIVED','CANCELLED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS inventory_lots (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    item_id             BIGINT UNSIGNED NOT NULL,
    lot_code            VARCHAR(100) NOT NULL,
    prelot_id           BIGINT UNSIGNED NULL,
    supplier_id         BIGINT UNSIGNED NULL,
    origin_id           BIGINT UNSIGNED NULL,
    supplier_lot_code   VARCHAR(100) NULL,
    manufacture_date    DATE NULL,
    received_date       DATE NULL,
    expiry_date         DATE NULL,
    quality_status      VARCHAR(25) NOT NULL DEFAULT 'PENDING',
    lot_status          VARCHAR(25) NOT NULL DEFAULT 'OPEN',
    attributes_json     JSON NULL,
    created_by          BIGINT UNSIGNED NULL,
    created_at          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_inventory_lots_item_code (item_id, lot_code),
    KEY ix_inventory_lots_prelot (prelot_id),
    KEY ix_inventory_lots_quality (quality_status, lot_status),
    CONSTRAINT fk_inventory_lots_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
    CONSTRAINT fk_inventory_lots_prelot FOREIGN KEY (prelot_id) REFERENCES pre_lots(id) ON DELETE SET NULL,
    CONSTRAINT fk_inventory_lots_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
    CONSTRAINT fk_inventory_lots_origin FOREIGN KEY (origin_id) REFERENCES supplier_origins(id) ON DELETE SET NULL,
    CONSTRAINT fk_inventory_lots_created_by FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_inventory_lots_dates CHECK (expiry_date IS NULL OR manufacture_date IS NULL OR expiry_date >= manufacture_date),
    CONSTRAINT chk_inventory_lots_quality CHECK (quality_status IN ('PENDING','SAMPLING','APPROVED','CONDITIONAL','REJECTED','EXPIRED')),
    CONSTRAINT chk_inventory_lots_status CHECK (lot_status IN ('OPEN','BLOCKED','CONSUMED','CLOSED','RECALLED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS goods_receipts (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    receipt_number      VARCHAR(50) NOT NULL,
    appointment_id      BIGINT UNSIGNED NULL,
    prelot_id           BIGINT UNSIGNED NULL,
    supplier_id         BIGINT UNSIGNED NOT NULL,
    warehouse_id        BIGINT UNSIGNED NOT NULL,
    purchase_reference  VARCHAR(80) NULL,
    vehicle_reference   VARCHAR(80) NULL,
    arrived_at          DATETIME(6) NOT NULL,
    weighing_started_at DATETIME(6) NULL,
    weighing_ended_at   DATETIME(6) NULL,
    gross_weight_kg     DECIMAL(18,3) NULL,
    tare_weight_kg      DECIMAL(18,3) NULL,
    net_weight_kg       DECIMAL(18,3) GENERATED ALWAYS AS (
        CASE WHEN gross_weight_kg IS NULL OR tare_weight_kg IS NULL THEN NULL
             ELSE gross_weight_kg - tare_weight_kg END
    ) STORED,
    status              VARCHAR(25) NOT NULL DEFAULT 'DRAFT',
    received_by         BIGINT UNSIGNED NULL,
    created_at          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_goods_receipts_number (receipt_number),
    KEY ix_goods_receipts_arrival (arrived_at, status),
    CONSTRAINT fk_goods_receipts_appointment FOREIGN KEY (appointment_id) REFERENCES inbound_appointments(id) ON DELETE SET NULL,
    CONSTRAINT fk_goods_receipts_prelot FOREIGN KEY (prelot_id) REFERENCES pre_lots(id) ON DELETE SET NULL,
    CONSTRAINT fk_goods_receipts_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    CONSTRAINT fk_goods_receipts_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
    CONSTRAINT fk_goods_receipts_received_by FOREIGN KEY (received_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_goods_receipts_weights CHECK (gross_weight_kg IS NULL OR tare_weight_kg IS NULL OR gross_weight_kg >= tare_weight_kg),
    CONSTRAINT chk_goods_receipts_status CHECK (status IN ('DRAFT','WAITING_QUALITY','PARTIALLY_ACCEPTED','ACCEPTED','REJECTED','CLOSED','CANCELLED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS goods_receipt_lines (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    receipt_id          BIGINT UNSIGNED NOT NULL,
    line_no             INT UNSIGNED NOT NULL,
    item_id             BIGINT UNSIGNED NOT NULL,
    inventory_lot_id    BIGINT UNSIGNED NULL,
    uom_id              BIGINT UNSIGNED NOT NULL,
    ordered_qty         DECIMAL(18,6) NULL,
    received_qty        DECIMAL(18,6) NOT NULL,
    accepted_qty        DECIMAL(18,6) NOT NULL DEFAULT 0,
    rejected_qty        DECIMAL(18,6) NOT NULL DEFAULT 0,
    damaged_qty         DECIMAL(18,6) NOT NULL DEFAULT 0,
    container_count     INT UNSIGNED NULL,
    notes               VARCHAR(500) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_goods_receipt_lines_no (receipt_id, line_no),
    KEY ix_goods_receipt_lines_item_lot (item_id, inventory_lot_id),
    CONSTRAINT fk_goods_receipt_lines_receipt FOREIGN KEY (receipt_id) REFERENCES goods_receipts(id) ON DELETE CASCADE,
    CONSTRAINT fk_goods_receipt_lines_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
    CONSTRAINT fk_goods_receipt_lines_lot FOREIGN KEY (inventory_lot_id) REFERENCES inventory_lots(id) ON DELETE RESTRICT,
    CONSTRAINT fk_goods_receipt_lines_uom FOREIGN KEY (uom_id) REFERENCES units_of_measure(id) ON DELETE RESTRICT,
    CONSTRAINT chk_goods_receipt_lines_qty CHECK (received_qty > 0 AND accepted_qty >= 0 AND rejected_qty >= 0 AND damaged_qty >= 0),
    CONSTRAINT chk_goods_receipt_lines_disposition CHECK (accepted_qty + rejected_qty + damaged_qty <= received_qty)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS receipt_line_containers (
    receipt_line_id BIGINT UNSIGNED NOT NULL,
    container_id    BIGINT UNSIGNED NOT NULL,
    gross_weight_kg DECIMAL(18,3) NULL,
    tare_weight_kg  DECIMAL(18,3) NULL,
    net_weight_kg   DECIMAL(18,3) GENERATED ALWAYS AS (
        CASE WHEN gross_weight_kg IS NULL OR tare_weight_kg IS NULL THEN NULL
             ELSE gross_weight_kg - tare_weight_kg END
    ) STORED,
    PRIMARY KEY (receipt_line_id, container_id),
    CONSTRAINT fk_receipt_containers_line FOREIGN KEY (receipt_line_id) REFERENCES goods_receipt_lines(id) ON DELETE CASCADE,
    CONSTRAINT fk_receipt_containers_container FOREIGN KEY (container_id) REFERENCES returnable_containers(id) ON DELETE RESTRICT,
    CONSTRAINT chk_receipt_containers_weight CHECK (gross_weight_kg IS NULL OR tare_weight_kg IS NULL OR gross_weight_kg >= tare_weight_kg)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- CALIDAD
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS quality_parameters (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code            VARCHAR(50) NOT NULL,
    name            VARCHAR(160) NOT NULL,
    uom_text        VARCHAR(30) NULL,
    data_type       VARCHAR(20) NOT NULL DEFAULT 'NUMBER',
    is_active       TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uq_quality_parameters_code (code),
    CONSTRAINT chk_quality_parameters_type CHECK (data_type IN ('NUMBER','TEXT','BOOLEAN','LIST')),
    CONSTRAINT chk_quality_parameters_active CHECK (is_active IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS quality_specs (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    item_id         BIGINT UNSIGNED NOT NULL,
    parameter_id    BIGINT UNSIGNED NOT NULL,
    min_value       DECIMAL(18,6) NULL,
    max_value       DECIMAL(18,6) NULL,
    expected_text   VARCHAR(190) NULL,
    effective_from  DATE NOT NULL,
    effective_to    DATE NULL,
    is_active       TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uq_quality_specs_version (item_id, parameter_id, effective_from),
    CONSTRAINT fk_quality_specs_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    CONSTRAINT fk_quality_specs_parameter FOREIGN KEY (parameter_id) REFERENCES quality_parameters(id) ON DELETE RESTRICT,
    CONSTRAINT chk_quality_specs_range CHECK (max_value IS NULL OR min_value IS NULL OR max_value >= min_value),
    CONSTRAINT chk_quality_specs_dates CHECK (effective_to IS NULL OR effective_to >= effective_from),
    CONSTRAINT chk_quality_specs_active CHECK (is_active IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS quality_requests (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    request_number      VARCHAR(50) NOT NULL,
    request_type        VARCHAR(30) NOT NULL,
    receipt_line_id     BIGINT UNSIGNED NULL,
    inventory_lot_id    BIGINT UNSIGNED NULL,
    target_type         VARCHAR(50) NULL,
    target_id           BIGINT UNSIGNED NULL,
    requested_by        BIGINT UNSIGNED NULL,
    requested_at        DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    assigned_to         BIGINT UNSIGNED NULL,
    sampled_at          DATETIME(6) NULL,
    completed_at        DATETIME(6) NULL,
    status              VARCHAR(25) NOT NULL DEFAULT 'REQUESTED',
    disposition         VARCHAR(25) NULL,
    disposition_reason  VARCHAR(1000) NULL,
    decided_by          BIGINT UNSIGNED NULL,
    decided_at          DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_quality_requests_number (request_number),
    KEY ix_quality_requests_queue (status, requested_at),
    KEY ix_quality_requests_lot (inventory_lot_id),
    CONSTRAINT fk_quality_requests_receipt_line FOREIGN KEY (receipt_line_id) REFERENCES goods_receipt_lines(id) ON DELETE SET NULL,
    CONSTRAINT fk_quality_requests_lot FOREIGN KEY (inventory_lot_id) REFERENCES inventory_lots(id) ON DELETE SET NULL,
    CONSTRAINT fk_quality_requests_requested_by FOREIGN KEY (requested_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT fk_quality_requests_assigned_to FOREIGN KEY (assigned_to) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT fk_quality_requests_decided_by FOREIGN KEY (decided_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_quality_requests_type CHECK (request_type IN ('INBOUND_FRUIT','INBOUND_MATERIAL','IN_PROCESS','FINISHED_GOOD','CUSTOMER_RETURN','OTHER')),
    CONSTRAINT chk_quality_requests_status CHECK (status IN ('REQUESTED','ASSIGNED','SAMPLING','TESTING','COMPLETED','CANCELLED')),
    CONSTRAINT chk_quality_requests_disposition CHECK (disposition IS NULL OR disposition IN ('APPROVED','CONDITIONAL','REJECTED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS quality_results (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    quality_request_id  BIGINT UNSIGNED NOT NULL,
    parameter_id        BIGINT UNSIGNED NOT NULL,
    numeric_value       DECIMAL(18,6) NULL,
    text_value          VARCHAR(500) NULL,
    boolean_value       TINYINT(1) NULL,
    result_status       VARCHAR(20) NOT NULL DEFAULT 'RECORDED',
    method_reference    VARCHAR(190) NULL,
    recorded_by         BIGINT UNSIGNED NULL,
    recorded_at         DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_quality_results_parameter (quality_request_id, parameter_id),
    CONSTRAINT fk_quality_results_request FOREIGN KEY (quality_request_id) REFERENCES quality_requests(id) ON DELETE CASCADE,
    CONSTRAINT fk_quality_results_parameter FOREIGN KEY (parameter_id) REFERENCES quality_parameters(id) ON DELETE RESTRICT,
    CONSTRAINT fk_quality_results_recorded_by FOREIGN KEY (recorded_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_quality_results_bool CHECK (boolean_value IS NULL OR boolean_value IN (0,1)),
    CONSTRAINT chk_quality_results_status CHECK (result_status IN ('RECORDED','WITHIN_SPEC','OUT_OF_SPEC','NOT_APPLICABLE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS quality_status_history (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    quality_request_id  BIGINT UNSIGNED NOT NULL,
    from_status         VARCHAR(25) NULL,
    to_status           VARCHAR(25) NOT NULL,
    notes               VARCHAR(500) NULL,
    changed_by          BIGINT UNSIGNED NULL,
    changed_at          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY ix_quality_history_request_time (quality_request_id, changed_at),
    CONSTRAINT fk_quality_history_request FOREIGN KEY (quality_request_id) REFERENCES quality_requests(id) ON DELETE CASCADE,
    CONSTRAINT fk_quality_history_changed_by FOREIGN KEY (changed_by) REFERENCES app_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- INVENTARIO: LIBRO MAYOR INMUTABLE Y RESERVAS
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS inventory_movements (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    movement_number         VARCHAR(60) NOT NULL,
    movement_type           VARCHAR(35) NOT NULL,
    source_type             VARCHAR(50) NULL,
    source_id               BIGINT UNSIGNED NULL,
    source_reference        VARCHAR(100) NULL,
    reversal_of_movement_id BIGINT UNSIGNED NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    movement_at             DATETIME(6) NOT NULL,
    reason                  VARCHAR(1000) NULL,
    created_by              BIGINT UNSIGNED NULL,
    posted_by               BIGINT UNSIGNED NULL,
    posted_at               DATETIME(6) NULL,
    created_at              DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_inventory_movements_number (movement_number),
    KEY ix_inventory_movements_source (source_type, source_id),
    KEY ix_inventory_movements_time_status (movement_at, status),
    CONSTRAINT fk_inventory_movements_reversal FOREIGN KEY (reversal_of_movement_id) REFERENCES inventory_movements(id) ON DELETE RESTRICT,
    CONSTRAINT fk_inventory_movements_created_by FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT fk_inventory_movements_posted_by FOREIGN KEY (posted_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_inventory_movements_type CHECK (movement_type IN ('RECEIPT','TRANSFER','ISSUE_PRODUCTION','PRODUCTION_OUTPUT','SHIPMENT','CUSTOMER_RETURN','SUPPLIER_RETURN','QUALITY_RELEASE','QUALITY_REJECT','COUNT_ADJUSTMENT','MAINTENANCE_ISSUE','SCRAP','REVERSAL','OTHER')),
    CONSTRAINT chk_inventory_movements_status CHECK (status IN ('DRAFT','POSTED','CANCELLED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS inventory_movement_lines (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    movement_id         BIGINT UNSIGNED NOT NULL,
    line_no             INT UNSIGNED NOT NULL,
    item_id             BIGINT UNSIGNED NOT NULL,
    inventory_lot_id    BIGINT UNSIGNED NULL,
    warehouse_id        BIGINT UNSIGNED NOT NULL,
    location_id         BIGINT UNSIGNED NOT NULL,
    uom_id              BIGINT UNSIGNED NOT NULL,
    quantity_delta      DECIMAL(18,6) NOT NULL,
    unit_cost           DECIMAL(18,6) NULL,
    container_id        BIGINT UNSIGNED NULL,
    notes               VARCHAR(500) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_inventory_movement_lines_no (movement_id, line_no),
    KEY ix_inventory_ledger_balance (item_id, inventory_lot_id, warehouse_id, location_id),
    KEY ix_inventory_ledger_container (container_id),
    CONSTRAINT fk_inventory_lines_movement FOREIGN KEY (movement_id) REFERENCES inventory_movements(id) ON DELETE CASCADE,
    CONSTRAINT fk_inventory_lines_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
    CONSTRAINT fk_inventory_lines_lot FOREIGN KEY (inventory_lot_id) REFERENCES inventory_lots(id) ON DELETE RESTRICT,
    CONSTRAINT fk_inventory_lines_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
    CONSTRAINT fk_inventory_lines_warehouse_location FOREIGN KEY (warehouse_id, location_id) REFERENCES warehouse_locations(warehouse_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_inventory_lines_uom FOREIGN KEY (uom_id) REFERENCES units_of_measure(id) ON DELETE RESTRICT,
    CONSTRAINT fk_inventory_lines_container FOREIGN KEY (container_id) REFERENCES returnable_containers(id) ON DELETE RESTRICT,
    CONSTRAINT chk_inventory_lines_qty CHECK (quantity_delta <> 0),
    CONSTRAINT chk_inventory_lines_cost CHECK (unit_cost IS NULL OR unit_cost >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS inventory_reservations (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    reservation_number  VARCHAR(60) NOT NULL,
    item_id             BIGINT UNSIGNED NOT NULL,
    inventory_lot_id    BIGINT UNSIGNED NULL,
    warehouse_id        BIGINT UNSIGNED NOT NULL,
    location_id         BIGINT UNSIGNED NOT NULL,
    source_type         VARCHAR(50) NOT NULL,
    source_id           BIGINT UNSIGNED NOT NULL,
    reserved_qty        DECIMAL(18,6) NOT NULL,
    consumed_qty        DECIMAL(18,6) NOT NULL DEFAULT 0,
    status              VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    expires_at          DATETIME(6) NULL,
    created_by          BIGINT UNSIGNED NULL,
    created_at          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_inventory_reservations_number (reservation_number),
    KEY ix_inventory_reservations_balance (item_id, inventory_lot_id, warehouse_id, location_id, status),
    KEY ix_inventory_reservations_source (source_type, source_id),
    CONSTRAINT fk_inventory_reservations_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
    CONSTRAINT fk_inventory_reservations_lot FOREIGN KEY (inventory_lot_id) REFERENCES inventory_lots(id) ON DELETE RESTRICT,
    CONSTRAINT fk_inventory_reservations_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
    CONSTRAINT fk_inventory_reservations_warehouse_location FOREIGN KEY (warehouse_id, location_id) REFERENCES warehouse_locations(warehouse_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_inventory_reservations_created_by FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_inventory_reservations_qty CHECK (reserved_qty > 0 AND consumed_qty >= 0 AND consumed_qty <= reserved_qty),
    CONSTRAINT chk_inventory_reservations_status CHECK (status IN ('ACTIVE','PARTIALLY_CONSUMED','CONSUMED','CANCELLED','EXPIRED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- FORECAST, LISTAS DE MATERIALES Y MRP
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS forecast_plans (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    plan_code       VARCHAR(50) NOT NULL,
    name            VARCHAR(160) NOT NULL,
    fiscal_year     SMALLINT UNSIGNED NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_by      BIGINT UNSIGNED NULL,
    created_at      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_forecast_plans_code (plan_code),
    CONSTRAINT fk_forecast_plans_created_by FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_forecast_plans_status CHECK (status IN ('DRAFT','ACTIVE','CLOSED','ARCHIVED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS forecast_versions (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    forecast_plan_id    BIGINT UNSIGNED NOT NULL,
    version_no          INT UNSIGNED NOT NULL,
    version_type        VARCHAR(20) NOT NULL,
    version_name        VARCHAR(120) NOT NULL,
    source_file_name    VARCHAR(255) NULL,
    source_file_hash    CHAR(64) NULL,
    change_reason       VARCHAR(1000) NULL,
    is_current          TINYINT(1) NOT NULL DEFAULT 0,
    approved_by         BIGINT UNSIGNED NULL,
    approved_at         DATETIME(6) NULL,
    imported_by         BIGINT UNSIGNED NULL,
    imported_at         DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    current_plan_guard  BIGINT GENERATED ALWAYS AS (
        CASE WHEN is_current = 1 THEN forecast_plan_id ELSE NULL END
    ) STORED,
    PRIMARY KEY (id),
    UNIQUE KEY uq_forecast_versions_no (forecast_plan_id, version_no),
    UNIQUE KEY uq_forecast_one_current (current_plan_guard),
    -- RESTRICT es obligatorio aqui porque forecast_plan_id alimenta la columna
    -- generada current_plan_guard. MySQL no permite CASCADE sobre esa base.
    CONSTRAINT fk_forecast_versions_plan FOREIGN KEY (forecast_plan_id) REFERENCES forecast_plans(id) ON DELETE RESTRICT,
    CONSTRAINT fk_forecast_versions_approved_by FOREIGN KEY (approved_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT fk_forecast_versions_imported_by FOREIGN KEY (imported_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_forecast_versions_type CHECK (version_type IN ('ORIGINAL','REVISION','SCENARIO')),
    CONSTRAINT chk_forecast_versions_current CHECK (is_current IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS forecast_lines (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    forecast_version_id BIGINT UNSIGNED NOT NULL,
    customer_id         BIGINT UNSIGNED NULL,
    finished_item_id    BIGINT UNSIGNED NOT NULL,
    period_start        DATE NOT NULL,
    forecast_qty        DECIMAL(18,6) NOT NULL,
    confidence_pct      DECIMAL(5,2) NULL,
    source_row_key      VARCHAR(190) NULL,
    notes               VARCHAR(500) NULL,
    customer_key        BIGINT UNSIGNED GENERATED ALWAYS AS (IFNULL(customer_id, 0)) STORED,
    PRIMARY KEY (id),
    UNIQUE KEY uq_forecast_lines_dimension (forecast_version_id, customer_key, finished_item_id, period_start),
    KEY ix_forecast_lines_period_item (period_start, finished_item_id),
    CONSTRAINT fk_forecast_lines_version FOREIGN KEY (forecast_version_id) REFERENCES forecast_versions(id) ON DELETE CASCADE,
    CONSTRAINT fk_forecast_lines_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    CONSTRAINT fk_forecast_lines_item FOREIGN KEY (finished_item_id) REFERENCES items(id) ON DELETE RESTRICT,
    CONSTRAINT chk_forecast_lines_qty CHECK (forecast_qty >= 0),
    CONSTRAINT chk_forecast_lines_confidence CHECK (confidence_pct IS NULL OR confidence_pct BETWEEN 0 AND 100),
    CONSTRAINT chk_forecast_lines_month CHECK (DAY(period_start) = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS bills_of_material (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    bom_code            VARCHAR(60) NOT NULL,
    output_item_id      BIGINT UNSIGNED NOT NULL,
    name                VARCHAR(160) NOT NULL,
    is_active           TINYINT(1) NOT NULL DEFAULT 1,
    created_by          BIGINT UNSIGNED NULL,
    created_at          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_bom_code (bom_code),
    CONSTRAINT fk_bom_output_item FOREIGN KEY (output_item_id) REFERENCES items(id) ON DELETE RESTRICT,
    CONSTRAINT fk_bom_created_by FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_bom_active CHECK (is_active IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS bom_versions (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    bom_id              BIGINT UNSIGNED NOT NULL,
    version_no          INT UNSIGNED NOT NULL,
    output_qty          DECIMAL(18,6) NOT NULL DEFAULT 1,
    output_uom_id       BIGINT UNSIGNED NOT NULL,
    effective_from      DATE NOT NULL,
    effective_to        DATE NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    expected_yield_pct  DECIMAL(7,4) NULL,
    source_reference    VARCHAR(100) NULL,
    approved_by         BIGINT UNSIGNED NULL,
    approved_at         DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_bom_versions_no (bom_id, version_no),
    UNIQUE KEY uq_bom_versions_source (bom_id, source_reference),
    CONSTRAINT fk_bom_versions_bom FOREIGN KEY (bom_id) REFERENCES bills_of_material(id) ON DELETE CASCADE,
    CONSTRAINT fk_bom_versions_uom FOREIGN KEY (output_uom_id) REFERENCES units_of_measure(id) ON DELETE RESTRICT,
    CONSTRAINT fk_bom_versions_approved_by FOREIGN KEY (approved_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_bom_versions_qty CHECK (output_qty > 0),
    CONSTRAINT chk_bom_versions_dates CHECK (effective_to IS NULL OR effective_to >= effective_from),
    CONSTRAINT chk_bom_versions_status CHECK (status IN ('DRAFT','ACTIVE','OBSOLETE')),
    CONSTRAINT chk_bom_versions_yield CHECK (expected_yield_pct IS NULL OR expected_yield_pct > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS bom_components (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    bom_version_id      BIGINT UNSIGNED NOT NULL,
    line_no             INT UNSIGNED NOT NULL,
    component_item_id   BIGINT UNSIGNED NOT NULL,
    component_uom_id    BIGINT UNSIGNED NOT NULL,
    qty_per_output      DECIMAL(18,8) NOT NULL,
    scrap_pct           DECIMAL(7,4) NOT NULL DEFAULT 0,
    is_optional         TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uq_bom_components_line (bom_version_id, line_no),
    UNIQUE KEY uq_bom_components_item (bom_version_id, component_item_id),
    CONSTRAINT fk_bom_components_version FOREIGN KEY (bom_version_id) REFERENCES bom_versions(id) ON DELETE CASCADE,
    CONSTRAINT fk_bom_components_item FOREIGN KEY (component_item_id) REFERENCES items(id) ON DELETE RESTRICT,
    CONSTRAINT fk_bom_components_uom FOREIGN KEY (component_uom_id) REFERENCES units_of_measure(id) ON DELETE RESTRICT,
    CONSTRAINT chk_bom_components_qty CHECK (qty_per_output > 0 AND scrap_pct >= 0),
    CONSTRAINT chk_bom_components_optional CHECK (is_optional IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS mrp_runs (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    run_number              VARCHAR(60) NOT NULL,
    forecast_version_id     BIGINT UNSIGNED NOT NULL,
    horizon_start           DATE NOT NULL,
    horizon_end             DATE NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
    parameters_json         JSON NULL,
    started_at              DATETIME(6) NULL,
    completed_at            DATETIME(6) NULL,
    created_by              BIGINT UNSIGNED NULL,
    created_at              DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_mrp_runs_number (run_number),
    KEY ix_mrp_runs_forecast (forecast_version_id, created_at),
    CONSTRAINT fk_mrp_runs_forecast FOREIGN KEY (forecast_version_id) REFERENCES forecast_versions(id) ON DELETE RESTRICT,
    CONSTRAINT fk_mrp_runs_created_by FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_mrp_runs_horizon CHECK (horizon_end >= horizon_start),
    CONSTRAINT chk_mrp_runs_status CHECK (status IN ('QUEUED','RUNNING','COMPLETED','FAILED','CANCELLED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS mrp_requirements (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    mrp_run_id          BIGINT UNSIGNED NOT NULL,
    item_id             BIGINT UNSIGNED NOT NULL,
    requirement_date    DATE NOT NULL,
    gross_requirement   DECIMAL(18,6) NOT NULL,
    on_hand_qty         DECIMAL(18,6) NOT NULL DEFAULT 0,
    reserved_qty        DECIMAL(18,6) NOT NULL DEFAULT 0,
    scheduled_receipts  DECIMAL(18,6) NOT NULL DEFAULT 0,
    safety_stock_qty    DECIMAL(18,6) NOT NULL DEFAULT 0,
    net_requirement     DECIMAL(18,6) NOT NULL,
    suggested_order_qty DECIMAL(18,6) NOT NULL DEFAULT 0,
    suggested_order_date DATE NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'CALCULATED',
    PRIMARY KEY (id),
    UNIQUE KEY uq_mrp_requirements_dimension (mrp_run_id, item_id, requirement_date),
    KEY ix_mrp_requirements_item_date (item_id, requirement_date),
    CONSTRAINT fk_mrp_requirements_run FOREIGN KEY (mrp_run_id) REFERENCES mrp_runs(id) ON DELETE CASCADE,
    CONSTRAINT fk_mrp_requirements_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
    CONSTRAINT chk_mrp_requirements_values CHECK (gross_requirement >= 0 AND on_hand_qty >= 0 AND reserved_qty >= 0 AND scheduled_receipts >= 0 AND safety_stock_qty >= 0 AND suggested_order_qty >= 0),
    CONSTRAINT chk_mrp_requirements_status CHECK (status IN ('CALCULATED','SHORTAGE','COVERED','PLANNED','RELEASED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- ORDENES, PRODUCCION, EXTRACCION Y GENEALOGIA DE LOTES
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS production_orders (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_number        VARCHAR(60) NOT NULL,
    finished_item_id    BIGINT UNSIGNED NOT NULL,
    bom_version_id      BIGINT UNSIGNED NULL,
    customer_id         BIGINT UNSIGNED NULL,
    forecast_version_id BIGINT UNSIGNED NULL,
    planned_qty         DECIMAL(18,6) NOT NULL,
    completed_qty       DECIMAL(18,6) NOT NULL DEFAULT 0,
    uom_id              BIGINT UNSIGNED NOT NULL,
    planned_start       DATETIME(6) NOT NULL,
    planned_end         DATETIME(6) NOT NULL,
    actual_start        DATETIME(6) NULL,
    actual_end          DATETIME(6) NULL,
    priority_no         INT NOT NULL DEFAULT 100,
    status              VARCHAR(25) NOT NULL DEFAULT 'PLANNED',
    created_by          BIGINT UNSIGNED NULL,
    created_at          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_production_orders_number (order_number),
    KEY ix_production_orders_schedule (planned_start, planned_end, status),
    CONSTRAINT fk_production_orders_item FOREIGN KEY (finished_item_id) REFERENCES items(id) ON DELETE RESTRICT,
    CONSTRAINT fk_production_orders_bom FOREIGN KEY (bom_version_id) REFERENCES bom_versions(id) ON DELETE RESTRICT,
    CONSTRAINT fk_production_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    CONSTRAINT fk_production_orders_forecast FOREIGN KEY (forecast_version_id) REFERENCES forecast_versions(id) ON DELETE SET NULL,
    CONSTRAINT fk_production_orders_uom FOREIGN KEY (uom_id) REFERENCES units_of_measure(id) ON DELETE RESTRICT,
    CONSTRAINT fk_production_orders_created_by FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_production_orders_qty CHECK (planned_qty > 0 AND completed_qty >= 0),
    CONSTRAINT chk_production_orders_dates CHECK (planned_end >= planned_start),
    CONSTRAINT chk_production_orders_status CHECK (status IN ('PLANNED','MATERIAL_CHECK','RELEASED','IN_PROCESS','ON_HOLD','COMPLETED','CLOSED','CANCELLED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS process_batches (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    batch_code          VARCHAR(80) NOT NULL,
    process_type        VARCHAR(30) NOT NULL,
    production_order_id BIGINT UNSIGNED NULL,
    status              VARCHAR(25) NOT NULL DEFAULT 'PLANNED',
    planned_start       DATETIME(6) NULL,
    started_at          DATETIME(6) NULL,
    completed_at        DATETIME(6) NULL,
    line_code           VARCHAR(50) NULL,
    shift_code          VARCHAR(30) NULL,
    target_beans_hour   DECIMAL(10,3) NULL,
    actual_beans        INT UNSIGNED NOT NULL DEFAULT 0,
    parameters_json     JSON NULL,
    created_by          BIGINT UNSIGNED NULL,
    created_at          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_process_batches_code (batch_code),
    KEY ix_process_batches_schedule (planned_start, status),
    CONSTRAINT fk_process_batches_order FOREIGN KEY (production_order_id) REFERENCES production_orders(id) ON DELETE SET NULL,
    CONSTRAINT fk_process_batches_created_by FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_process_batches_type CHECK (process_type IN ('EXTRACTION','REFINING','BLENDING','PACKAGING','REWORK','OTHER')),
    CONSTRAINT chk_process_batches_status CHECK (status IN ('PLANNED','RELEASED','IN_PROCESS','ON_HOLD','COMPLETED','CANCELLED')),
    CONSTRAINT chk_process_batches_target CHECK (target_beans_hour IS NULL OR target_beans_hour > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS process_batch_inputs (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    process_batch_id    BIGINT UNSIGNED NOT NULL,
    line_no             INT UNSIGNED NOT NULL,
    item_id             BIGINT UNSIGNED NOT NULL,
    inventory_lot_id    BIGINT UNSIGNED NOT NULL,
    container_id        BIGINT UNSIGNED NULL,
    uom_id              BIGINT UNSIGNED NOT NULL,
    planned_qty         DECIMAL(18,6) NULL,
    actual_qty          DECIMAL(18,6) NOT NULL,
    fed_at              DATETIME(6) NULL,
    recorded_by         BIGINT UNSIGNED NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_process_batch_inputs_line (process_batch_id, line_no),
    KEY ix_process_batch_inputs_lot (inventory_lot_id),
    KEY ix_process_batch_inputs_container (container_id),
    CONSTRAINT fk_process_inputs_batch FOREIGN KEY (process_batch_id) REFERENCES process_batches(id) ON DELETE CASCADE,
    CONSTRAINT fk_process_inputs_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
    CONSTRAINT fk_process_inputs_lot FOREIGN KEY (inventory_lot_id) REFERENCES inventory_lots(id) ON DELETE RESTRICT,
    CONSTRAINT fk_process_inputs_container FOREIGN KEY (container_id) REFERENCES returnable_containers(id) ON DELETE RESTRICT,
    CONSTRAINT fk_process_inputs_uom FOREIGN KEY (uom_id) REFERENCES units_of_measure(id) ON DELETE RESTRICT,
    CONSTRAINT fk_process_inputs_user FOREIGN KEY (recorded_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_process_inputs_qty CHECK (actual_qty > 0 AND (planned_qty IS NULL OR planned_qty >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS process_batch_outputs (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    process_batch_id    BIGINT UNSIGNED NOT NULL,
    line_no             INT UNSIGNED NOT NULL,
    item_id             BIGINT UNSIGNED NOT NULL,
    inventory_lot_id    BIGINT UNSIGNED NOT NULL,
    uom_id              BIGINT UNSIGNED NOT NULL,
    output_qty          DECIMAL(18,6) NOT NULL,
    output_type         VARCHAR(25) NOT NULL DEFAULT 'PRIMARY',
    recorded_by         BIGINT UNSIGNED NULL,
    recorded_at         DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_process_batch_outputs_line (process_batch_id, line_no),
    KEY ix_process_batch_outputs_lot (inventory_lot_id),
    CONSTRAINT fk_process_outputs_batch FOREIGN KEY (process_batch_id) REFERENCES process_batches(id) ON DELETE CASCADE,
    CONSTRAINT fk_process_outputs_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
    CONSTRAINT fk_process_outputs_lot FOREIGN KEY (inventory_lot_id) REFERENCES inventory_lots(id) ON DELETE RESTRICT,
    CONSTRAINT fk_process_outputs_uom FOREIGN KEY (uom_id) REFERENCES units_of_measure(id) ON DELETE RESTRICT,
    CONSTRAINT fk_process_outputs_user FOREIGN KEY (recorded_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_process_outputs_qty CHECK (output_qty > 0),
    CONSTRAINT chk_process_outputs_type CHECK (output_type IN ('PRIMARY','BYPRODUCT','WASTE','REWORK'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS lot_genealogy (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    process_batch_id    BIGINT UNSIGNED NOT NULL,
    parent_lot_id       BIGINT UNSIGNED NOT NULL,
    child_lot_id        BIGINT UNSIGNED NOT NULL,
    parent_qty_used     DECIMAL(18,6) NOT NULL,
    contribution_pct    DECIMAL(7,4) NULL,
    created_at          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_lot_genealogy_edge (process_batch_id, parent_lot_id, child_lot_id),
    KEY ix_lot_genealogy_parent (parent_lot_id),
    KEY ix_lot_genealogy_child (child_lot_id),
    CONSTRAINT fk_lot_genealogy_batch FOREIGN KEY (process_batch_id) REFERENCES process_batches(id) ON DELETE CASCADE,
    CONSTRAINT fk_lot_genealogy_parent FOREIGN KEY (parent_lot_id) REFERENCES inventory_lots(id) ON DELETE RESTRICT,
    CONSTRAINT fk_lot_genealogy_child FOREIGN KEY (child_lot_id) REFERENCES inventory_lots(id) ON DELETE RESTRICT,
    CONSTRAINT chk_lot_genealogy_qty CHECK (parent_qty_used > 0),
    CONSTRAINT chk_lot_genealogy_pct CHECK (contribution_pct IS NULL OR contribution_pct BETWEEN 0 AND 100),
    CONSTRAINT chk_lot_genealogy_distinct CHECK (parent_lot_id <> child_lot_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- PEDIDOS, EMBARQUES, RECHAZOS Y DEVOLUCIONES
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sales_orders (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_number        VARCHAR(60) NOT NULL,
    customer_id         BIGINT UNSIGNED NOT NULL,
    customer_reference  VARCHAR(100) NULL,
    order_date          DATE NOT NULL,
    requested_ship_date DATE NOT NULL,
    promised_ship_date  DATE NULL,
    status              VARCHAR(25) NOT NULL DEFAULT 'OPEN',
    notes               VARCHAR(1000) NULL,
    created_by          BIGINT UNSIGNED NULL,
    created_at          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_sales_orders_number (order_number),
    KEY ix_sales_orders_due (requested_ship_date, status),
    CONSTRAINT fk_sales_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    CONSTRAINT fk_sales_orders_created_by FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_sales_orders_status CHECK (status IN ('OPEN','MATERIAL_CHECK','CONFIRMED','PARTIALLY_ALLOCATED','ALLOCATED','PARTIALLY_SHIPPED','SHIPPED','CLOSED','CANCELLED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS sales_order_lines (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    sales_order_id  BIGINT UNSIGNED NOT NULL,
    line_no         INT UNSIGNED NOT NULL,
    item_id         BIGINT UNSIGNED NOT NULL,
    uom_id          BIGINT UNSIGNED NOT NULL,
    ordered_qty     DECIMAL(18,6) NOT NULL,
    allocated_qty   DECIMAL(18,6) NOT NULL DEFAULT 0,
    shipped_qty     DECIMAL(18,6) NOT NULL DEFAULT 0,
    cancelled_qty   DECIMAL(18,6) NOT NULL DEFAULT 0,
    status          VARCHAR(25) NOT NULL DEFAULT 'OPEN',
    PRIMARY KEY (id),
    UNIQUE KEY uq_sales_order_lines_no (sales_order_id, line_no),
    KEY ix_sales_order_lines_item (item_id, status),
    CONSTRAINT fk_sales_order_lines_order FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_sales_order_lines_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
    CONSTRAINT fk_sales_order_lines_uom FOREIGN KEY (uom_id) REFERENCES units_of_measure(id) ON DELETE RESTRICT,
    CONSTRAINT chk_sales_order_lines_qty CHECK (ordered_qty > 0 AND allocated_qty >= 0 AND shipped_qty >= 0 AND cancelled_qty >= 0),
    CONSTRAINT chk_sales_order_lines_status CHECK (status IN ('OPEN','ALLOCATED','PARTIALLY_SHIPPED','SHIPPED','CANCELLED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS outbound_appointments (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    appointment_number  VARCHAR(60) NOT NULL,
    customer_id         BIGINT UNSIGNED NOT NULL,
    scheduled_start     DATETIME(6) NOT NULL,
    scheduled_end       DATETIME(6) NOT NULL,
    carrier_name        VARCHAR(190) NULL,
    vehicle_reference   VARCHAR(80) NULL,
    actual_arrival_at   DATETIME(6) NULL,
    actual_departure_at DATETIME(6) NULL,
    status              VARCHAR(25) NOT NULL DEFAULT 'PLANNED',
    created_by          BIGINT UNSIGNED NULL,
    created_at          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_outbound_appointments_number (appointment_number),
    KEY ix_outbound_calendar (scheduled_start, scheduled_end, status),
    CONSTRAINT fk_outbound_appointments_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    CONSTRAINT fk_outbound_appointments_created_by FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_outbound_window CHECK (scheduled_end > scheduled_start),
    CONSTRAINT chk_outbound_status CHECK (status IN ('PLANNED','CONFIRMED','ARRIVED','LOADING','DEPARTED','COMPLETED','NO_SHOW','CANCELLED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS shipments (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    shipment_number         VARCHAR(60) NOT NULL,
    outbound_appointment_id BIGINT UNSIGNED NULL,
    customer_id             BIGINT UNSIGNED NOT NULL,
    warehouse_id            BIGINT UNSIGNED NOT NULL,
    shipped_at              DATETIME(6) NULL,
    status                  VARCHAR(25) NOT NULL DEFAULT 'DRAFT',
    tracking_reference      VARCHAR(100) NULL,
    created_by              BIGINT UNSIGNED NULL,
    created_at              DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_shipments_number (shipment_number),
    KEY ix_shipments_customer_time (customer_id, shipped_at),
    CONSTRAINT fk_shipments_appointment FOREIGN KEY (outbound_appointment_id) REFERENCES outbound_appointments(id) ON DELETE SET NULL,
    CONSTRAINT fk_shipments_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    CONSTRAINT fk_shipments_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
    CONSTRAINT fk_shipments_created_by FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_shipments_status CHECK (status IN ('DRAFT','PICKING','READY','SHIPPED','DELIVERED','CANCELLED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS shipment_lines (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    shipment_id         BIGINT UNSIGNED NOT NULL,
    sales_order_line_id BIGINT UNSIGNED NULL,
    line_no             INT UNSIGNED NOT NULL,
    item_id             BIGINT UNSIGNED NOT NULL,
    inventory_lot_id    BIGINT UNSIGNED NOT NULL,
    uom_id              BIGINT UNSIGNED NOT NULL,
    shipped_qty         DECIMAL(18,6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_shipment_lines_no (shipment_id, line_no),
    KEY ix_shipment_lines_lot (inventory_lot_id),
    CONSTRAINT fk_shipment_lines_shipment FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE,
    CONSTRAINT fk_shipment_lines_order_line FOREIGN KEY (sales_order_line_id) REFERENCES sales_order_lines(id) ON DELETE SET NULL,
    CONSTRAINT fk_shipment_lines_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
    CONSTRAINT fk_shipment_lines_lot FOREIGN KEY (inventory_lot_id) REFERENCES inventory_lots(id) ON DELETE RESTRICT,
    CONSTRAINT fk_shipment_lines_uom FOREIGN KEY (uom_id) REFERENCES units_of_measure(id) ON DELETE RESTRICT,
    CONSTRAINT chk_shipment_lines_qty CHECK (shipped_qty > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS customer_returns (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    return_number       VARCHAR(60) NOT NULL,
    customer_id         BIGINT UNSIGNED NOT NULL,
    shipment_id         BIGINT UNSIGNED NULL,
    received_warehouse_id BIGINT UNSIGNED NOT NULL,
    return_reason       VARCHAR(1000) NOT NULL,
    customer_claim_ref  VARCHAR(100) NULL,
    received_at         DATETIME(6) NULL,
    status              VARCHAR(25) NOT NULL DEFAULT 'REQUESTED',
    created_by          BIGINT UNSIGNED NULL,
    created_at          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_customer_returns_number (return_number),
    CONSTRAINT fk_customer_returns_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    CONSTRAINT fk_customer_returns_shipment FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE SET NULL,
    CONSTRAINT fk_customer_returns_warehouse FOREIGN KEY (received_warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
    CONSTRAINT fk_customer_returns_created_by FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_customer_returns_status CHECK (status IN ('REQUESTED','AUTHORIZED','IN_TRANSIT','RECEIVED','QUALITY_REVIEW','ACCEPTED','REJECTED','CLOSED','CANCELLED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS customer_return_lines (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    customer_return_id  BIGINT UNSIGNED NOT NULL,
    line_no             INT UNSIGNED NOT NULL,
    item_id             BIGINT UNSIGNED NOT NULL,
    original_lot_id     BIGINT UNSIGNED NULL,
    received_lot_id     BIGINT UNSIGNED NULL,
    uom_id              BIGINT UNSIGNED NOT NULL,
    return_qty          DECIMAL(18,6) NOT NULL,
    disposition         VARCHAR(25) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_customer_return_lines_no (customer_return_id, line_no),
    CONSTRAINT fk_customer_return_lines_return FOREIGN KEY (customer_return_id) REFERENCES customer_returns(id) ON DELETE CASCADE,
    CONSTRAINT fk_customer_return_lines_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
    CONSTRAINT fk_customer_return_lines_original_lot FOREIGN KEY (original_lot_id) REFERENCES inventory_lots(id) ON DELETE SET NULL,
    CONSTRAINT fk_customer_return_lines_received_lot FOREIGN KEY (received_lot_id) REFERENCES inventory_lots(id) ON DELETE SET NULL,
    CONSTRAINT fk_customer_return_lines_uom FOREIGN KEY (uom_id) REFERENCES units_of_measure(id) ON DELETE RESTRICT,
    CONSTRAINT chk_customer_return_lines_qty CHECK (return_qty > 0),
    CONSTRAINT chk_customer_return_lines_disposition CHECK (disposition IS NULL OR disposition IN ('RESTOCK','REWORK','SCRAP','RETURN_TO_CUSTOMER','HOLD'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- CONTEOS, AUDITORIA DE ALMACENES Y MANTENIMIENTO
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS inventory_counts (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    count_number        VARCHAR(60) NOT NULL,
    warehouse_id        BIGINT UNSIGNED NOT NULL,
    count_type          VARCHAR(25) NOT NULL,
    status              VARCHAR(25) NOT NULL DEFAULT 'PLANNED',
    freeze_at           DATETIME(6) NULL,
    started_at          DATETIME(6) NULL,
    completed_at        DATETIME(6) NULL,
    approved_by         BIGINT UNSIGNED NULL,
    approved_at         DATETIME(6) NULL,
    adjustment_movement_id BIGINT UNSIGNED NULL,
    created_by          BIGINT UNSIGNED NULL,
    created_at          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_inventory_counts_number (count_number),
    KEY ix_inventory_counts_warehouse_status (warehouse_id, status),
    CONSTRAINT fk_inventory_counts_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
    CONSTRAINT fk_inventory_counts_approved_by FOREIGN KEY (approved_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT fk_inventory_counts_adjustment FOREIGN KEY (adjustment_movement_id) REFERENCES inventory_movements(id) ON DELETE SET NULL,
    CONSTRAINT fk_inventory_counts_created_by FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_inventory_counts_type CHECK (count_type IN ('CYCLE','FULL','SPOT','QUALITY_HOLD')),
    CONSTRAINT chk_inventory_counts_status CHECK (status IN ('PLANNED','FROZEN','COUNTING','RECOUNT','COMPLETED','APPROVED','CANCELLED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS inventory_count_lines (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    inventory_count_id  BIGINT UNSIGNED NOT NULL,
    item_id             BIGINT UNSIGNED NOT NULL,
    inventory_lot_id    BIGINT UNSIGNED NULL,
    location_id         BIGINT UNSIGNED NOT NULL,
    system_qty          DECIMAL(18,6) NOT NULL,
    first_count_qty     DECIMAL(18,6) NULL,
    second_count_qty    DECIMAL(18,6) NULL,
    final_count_qty     DECIMAL(18,6) NULL,
    variance_qty        DECIMAL(18,6) GENERATED ALWAYS AS (
        CASE WHEN final_count_qty IS NULL THEN NULL ELSE final_count_qty - system_qty END
    ) STORED,
    counted_by          BIGINT UNSIGNED NULL,
    recounted_by        BIGINT UNSIGNED NULL,
    notes               VARCHAR(500) NULL,
    lot_key             BIGINT UNSIGNED GENERATED ALWAYS AS (IFNULL(inventory_lot_id, 0)) STORED,
    PRIMARY KEY (id),
    UNIQUE KEY uq_inventory_count_lines_dimension (inventory_count_id, item_id, lot_key, location_id),
    CONSTRAINT fk_inventory_count_lines_count FOREIGN KEY (inventory_count_id) REFERENCES inventory_counts(id) ON DELETE CASCADE,
    CONSTRAINT fk_inventory_count_lines_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
    CONSTRAINT fk_inventory_count_lines_lot FOREIGN KEY (inventory_lot_id) REFERENCES inventory_lots(id) ON DELETE RESTRICT,
    CONSTRAINT fk_inventory_count_lines_location FOREIGN KEY (location_id) REFERENCES warehouse_locations(id) ON DELETE RESTRICT,
    CONSTRAINT fk_inventory_count_lines_counted_by FOREIGN KEY (counted_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT fk_inventory_count_lines_recounted_by FOREIGN KEY (recounted_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_inventory_count_lines_qty CHECK (
        (first_count_qty IS NULL OR first_count_qty >= 0) AND
        (second_count_qty IS NULL OR second_count_qty >= 0) AND
        (final_count_qty IS NULL OR final_count_qty >= 0)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS maintenance_assets (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    external_asset_id   VARCHAR(100) NULL,
    asset_code          VARCHAR(60) NOT NULL,
    asset_name          VARCHAR(190) NOT NULL,
    area_id             BIGINT UNSIGNED NULL,
    is_active           TINYINT(1) NOT NULL DEFAULT 1,
    synchronized_at     DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_maintenance_assets_code (asset_code),
    UNIQUE KEY uq_maintenance_assets_external (external_asset_id),
    CONSTRAINT fk_maintenance_assets_area FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL,
    CONSTRAINT chk_maintenance_assets_active CHECK (is_active IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS maintenance_requisitions (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    requisition_number      VARCHAR(60) NOT NULL,
    external_work_order_id  VARCHAR(100) NULL,
    asset_id                BIGINT UNSIGNED NULL,
    requesting_area_id      BIGINT UNSIGNED NOT NULL,
    needed_at               DATETIME(6) NOT NULL,
    priority_code           VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    status                  VARCHAR(25) NOT NULL DEFAULT 'REQUESTED',
    requested_by            BIGINT UNSIGNED NULL,
    approved_by             BIGINT UNSIGNED NULL,
    issued_movement_id      BIGINT UNSIGNED NULL,
    created_at              DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_maintenance_requisitions_number (requisition_number),
    UNIQUE KEY uq_maintenance_requisitions_external (external_work_order_id),
    CONSTRAINT fk_maintenance_requisitions_asset FOREIGN KEY (asset_id) REFERENCES maintenance_assets(id) ON DELETE SET NULL,
    CONSTRAINT fk_maintenance_requisitions_area FOREIGN KEY (requesting_area_id) REFERENCES areas(id) ON DELETE RESTRICT,
    CONSTRAINT fk_maintenance_requisitions_requested_by FOREIGN KEY (requested_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT fk_maintenance_requisitions_approved_by FOREIGN KEY (approved_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT fk_maintenance_requisitions_movement FOREIGN KEY (issued_movement_id) REFERENCES inventory_movements(id) ON DELETE SET NULL,
    CONSTRAINT chk_maintenance_requisitions_priority CHECK (priority_code IN ('LOW','NORMAL','HIGH','CRITICAL')),
    CONSTRAINT chk_maintenance_requisitions_status CHECK (status IN ('REQUESTED','APPROVED','PARTIALLY_RESERVED','RESERVED','PARTIALLY_ISSUED','ISSUED','CLOSED','REJECTED','CANCELLED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS maintenance_requisition_lines (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    maintenance_requisition_id BIGINT UNSIGNED NOT NULL,
    line_no                 INT UNSIGNED NOT NULL,
    item_id                 BIGINT UNSIGNED NOT NULL,
    uom_id                  BIGINT UNSIGNED NOT NULL,
    requested_qty           DECIMAL(18,6) NOT NULL,
    approved_qty            DECIMAL(18,6) NOT NULL DEFAULT 0,
    issued_qty              DECIMAL(18,6) NOT NULL DEFAULT 0,
    inventory_reservation_id BIGINT UNSIGNED NULL,
    notes                   VARCHAR(500) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_maintenance_req_lines_no (maintenance_requisition_id, line_no),
    CONSTRAINT fk_maintenance_req_lines_req FOREIGN KEY (maintenance_requisition_id) REFERENCES maintenance_requisitions(id) ON DELETE CASCADE,
    CONSTRAINT fk_maintenance_req_lines_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
    CONSTRAINT fk_maintenance_req_lines_uom FOREIGN KEY (uom_id) REFERENCES units_of_measure(id) ON DELETE RESTRICT,
    CONSTRAINT fk_maintenance_req_lines_reservation FOREIGN KEY (inventory_reservation_id) REFERENCES inventory_reservations(id) ON DELETE SET NULL,
    CONSTRAINT chk_maintenance_req_lines_qty CHECK (requested_qty > 0 AND approved_qty >= 0 AND issued_qty >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- ALERTAS, ARCHIVOS E INTEGRACIONES
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS alerts (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    alert_type      VARCHAR(40) NOT NULL,
    severity        VARCHAR(15) NOT NULL,
    title           VARCHAR(190) NOT NULL,
    message         VARCHAR(2000) NOT NULL,
    entity_type     VARCHAR(80) NULL,
    entity_id       VARCHAR(100) NULL,
    area_id         BIGINT UNSIGNED NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    deduplication_key VARCHAR(190) NULL,
    detected_at     DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    acknowledged_by BIGINT UNSIGNED NULL,
    acknowledged_at DATETIME(6) NULL,
    resolved_by     BIGINT UNSIGNED NULL,
    resolved_at     DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_alerts_deduplication (deduplication_key),
    KEY ix_alerts_queue (status, severity, detected_at),
    CONSTRAINT fk_alerts_area FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL,
    CONSTRAINT fk_alerts_ack_user FOREIGN KEY (acknowledged_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT fk_alerts_resolved_user FOREIGN KEY (resolved_by) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_alerts_severity CHECK (severity IN ('INFO','WARNING','CRITICAL')),
    CONSTRAINT chk_alerts_status CHECK (status IN ('OPEN','ACKNOWLEDGED','RESOLVED','DISMISSED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS user_alerts (
    alert_id        BIGINT UNSIGNED NOT NULL,
    user_id         BIGINT UNSIGNED NOT NULL,
    is_read         TINYINT(1) NOT NULL DEFAULT 0,
    read_at         DATETIME(6) NULL,
    PRIMARY KEY (alert_id, user_id),
    CONSTRAINT fk_user_alerts_alert FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_alerts_user FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE,
    CONSTRAINT chk_user_alerts_read CHECK (is_read IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS file_attachments (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    entity_type     VARCHAR(80) NOT NULL,
    entity_id       VARCHAR(100) NOT NULL,
    file_name       VARCHAR(255) NOT NULL,
    storage_key     VARCHAR(500) NOT NULL,
    mime_type       VARCHAR(120) NULL,
    file_size_bytes BIGINT UNSIGNED NULL,
    sha256_hash     CHAR(64) NULL,
    uploaded_by     BIGINT UNSIGNED NULL,
    uploaded_at     DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY ix_file_attachments_entity (entity_type, entity_id),
    CONSTRAINT fk_file_attachments_user FOREIGN KEY (uploaded_by) REFERENCES app_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS integration_outbox (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    event_type      VARCHAR(80) NOT NULL,
    entity_type     VARCHAR(80) NOT NULL,
    entity_id       VARCHAR(100) NOT NULL,
    payload_json    JSON NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    attempt_count   INT UNSIGNED NOT NULL DEFAULT 0,
    next_attempt_at DATETIME(6) NULL,
    processed_at    DATETIME(6) NULL,
    last_error      VARCHAR(2000) NULL,
    created_at      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY ix_integration_outbox_queue (status, next_attempt_at, created_at),
    CONSTRAINT chk_integration_outbox_status CHECK (status IN ('PENDING','PROCESSING','PROCESSED','FAILED','DEAD_LETTER'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- VISTAS OPERATIVAS
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW vw_inventory_on_hand AS
SELECT
    l.item_id,
    l.inventory_lot_id,
    l.warehouse_id,
    l.location_id,
    l.uom_id,
    SUM(l.quantity_delta) AS on_hand_qty,
    MAX(m.posted_at) AS last_movement_at
FROM inventory_movement_lines l
INNER JOIN inventory_movements m ON m.id = l.movement_id
WHERE m.status = 'POSTED'
GROUP BY l.item_id, l.inventory_lot_id, l.warehouse_id, l.location_id, l.uom_id
HAVING SUM(l.quantity_delta) <> 0;

CREATE OR REPLACE VIEW vw_inventory_active_reservations AS
SELECT
    item_id,
    inventory_lot_id,
    warehouse_id,
    location_id,
    SUM(reserved_qty - consumed_qty) AS reserved_qty
FROM inventory_reservations
WHERE status IN ('ACTIVE','PARTIALLY_CONSUMED')
GROUP BY item_id, inventory_lot_id, warehouse_id, location_id
HAVING SUM(reserved_qty - consumed_qty) > 0;

CREATE OR REPLACE VIEW vw_inventory_availability AS
SELECT
    s.item_id,
    s.inventory_lot_id,
    s.warehouse_id,
    s.location_id,
    s.uom_id,
    s.on_hand_qty,
    COALESCE(r.reserved_qty, 0) AS reserved_qty,
    CASE
        WHEN loc.is_blocked = 1 OR loc.location_type IN ('QUALITY_HOLD','REJECTED') THEN 0
        WHEN s.inventory_lot_id IS NOT NULL AND lot.quality_status NOT IN ('APPROVED','CONDITIONAL') THEN 0
        ELSE s.on_hand_qty - COALESCE(r.reserved_qty, 0)
    END AS available_qty,
    s.last_movement_at
FROM vw_inventory_on_hand s
LEFT JOIN vw_inventory_active_reservations r
    ON r.item_id = s.item_id
   AND r.inventory_lot_id <=> s.inventory_lot_id
   AND r.warehouse_id = s.warehouse_id
   AND r.location_id = s.location_id
INNER JOIN warehouse_locations loc ON loc.id = s.location_id
LEFT JOIN inventory_lots lot ON lot.id = s.inventory_lot_id;

CREATE OR REPLACE VIEW vw_current_forecast AS
SELECT
    p.id AS forecast_plan_id,
    p.plan_code,
    p.fiscal_year,
    v.id AS forecast_version_id,
    v.version_no,
    v.version_type,
    v.version_name,
    l.customer_id,
    l.finished_item_id,
    l.period_start,
    l.forecast_qty
FROM forecast_plans p
INNER JOIN forecast_versions v ON v.forecast_plan_id = p.id AND v.is_current = 1
INNER JOIN forecast_lines l ON l.forecast_version_id = v.id;

CREATE OR REPLACE VIEW vw_pending_sales_orders AS
SELECT
    o.id AS sales_order_id,
    o.order_number,
    o.customer_id,
    o.requested_ship_date,
    o.promised_ship_date,
    o.status AS order_status,
    l.id AS sales_order_line_id,
    l.line_no,
    l.item_id,
    l.ordered_qty,
    l.allocated_qty,
    l.shipped_qty,
    l.cancelled_qty,
    GREATEST(l.ordered_qty - l.shipped_qty - l.cancelled_qty, 0) AS pending_qty,
    l.status AS line_status
FROM sales_orders o
INNER JOIN sales_order_lines l ON l.sales_order_id = o.id
WHERE o.status NOT IN ('CLOSED','CANCELLED')
  AND l.status <> 'CANCELLED';

CREATE OR REPLACE VIEW vw_lot_traceability_edges AS
SELECT
    g.process_batch_id,
    b.batch_code,
    g.parent_lot_id,
    parent_lot.lot_code AS parent_lot_code,
    g.child_lot_id,
    child_lot.lot_code AS child_lot_code,
    g.parent_qty_used,
    g.contribution_pct,
    g.created_at
FROM lot_genealogy g
INNER JOIN process_batches b ON b.id = g.process_batch_id
INNER JOIN inventory_lots parent_lot ON parent_lot.id = g.parent_lot_id
INNER JOIN inventory_lots child_lot ON child_lot.id = g.child_lot_id;

-- -----------------------------------------------------------------------------
-- REGLAS DE INTEGRIDAD Y PROCEDIMIENTOS
-- -----------------------------------------------------------------------------

DELIMITER $$

DROP TRIGGER IF EXISTS trg_audit_log_no_update$$
CREATE TRIGGER trg_audit_log_no_update
BEFORE UPDATE ON audit_log
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El historial de auditoria es inmutable';
END$$

DROP TRIGGER IF EXISTS trg_audit_log_no_delete$$
CREATE TRIGGER trg_audit_log_no_delete
BEFORE DELETE ON audit_log
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El historial de auditoria no se puede eliminar';
END$$

DROP TRIGGER IF EXISTS trg_inventory_lines_no_update_posted$$
CREATE TRIGGER trg_inventory_lines_no_update_posted
BEFORE UPDATE ON inventory_movement_lines
FOR EACH ROW
BEGIN
    IF EXISTS (
        SELECT 1 FROM inventory_movements
        WHERE id IN (OLD.movement_id, NEW.movement_id) AND status = 'POSTED'
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se puede modificar un movimiento contabilizado; genere una reversa';
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_inventory_lines_no_insert_posted$$
CREATE TRIGGER trg_inventory_lines_no_insert_posted
BEFORE INSERT ON inventory_movement_lines
FOR EACH ROW
BEGIN
    IF EXISTS (
        SELECT 1 FROM inventory_movements
        WHERE id = NEW.movement_id AND status = 'POSTED'
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se pueden agregar partidas a un movimiento contabilizado';
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_inventory_lines_no_delete_posted$$
CREATE TRIGGER trg_inventory_lines_no_delete_posted
BEFORE DELETE ON inventory_movement_lines
FOR EACH ROW
BEGIN
    IF EXISTS (
        SELECT 1 FROM inventory_movements
        WHERE id = OLD.movement_id AND status = 'POSTED'
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se puede eliminar un movimiento contabilizado; genere una reversa';
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_inventory_movement_no_update_posted$$
CREATE TRIGGER trg_inventory_movement_no_update_posted
BEFORE UPDATE ON inventory_movements
FOR EACH ROW
BEGIN
    IF OLD.status = 'POSTED' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Un movimiento contabilizado es inmutable';
    END IF;
    IF OLD.status <> 'POSTED' AND NEW.status = 'POSTED'
       AND COALESCE(@inventory_post_context, 0) <> 1 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Use sp_post_inventory_movement para contabilizar existencias';
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_inventory_movement_no_delete_posted$$
CREATE TRIGGER trg_inventory_movement_no_delete_posted
BEFORE DELETE ON inventory_movements
FOR EACH ROW
BEGIN
    IF OLD.status = 'POSTED' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Un movimiento contabilizado no se puede eliminar';
    END IF;
END$$

DROP PROCEDURE IF EXISTS sp_create_pre_lot$$
CREATE PROCEDURE sp_create_pre_lot (
    IN  p_supplier_id        BIGINT UNSIGNED,
    IN  p_origin_id          BIGINT UNSIGNED,
    IN  p_appointment_id     BIGINT UNSIGNED,
    IN  p_planned_date       DATE,
    IN  p_expected_weight_kg DECIMAL(18,3),
    IN  p_created_by         BIGINT UNSIGNED,
    OUT p_prelot_id          BIGINT UNSIGNED,
    OUT p_prelot_code        VARCHAR(80)
)
BEGIN
    DECLARE v_supplier_code VARCHAR(12);
    DECLARE v_origin_code   VARCHAR(12);
    DECLARE v_sequence      INT UNSIGNED;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        SET @inventory_post_context = NULL;
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT s.short_code, o.origin_code
      INTO v_supplier_code, v_origin_code
      FROM suppliers s
      INNER JOIN supplier_origins o ON o.supplier_id = s.id
     WHERE s.id = p_supplier_id
       AND o.id = p_origin_id
       AND s.is_active = 1
       AND o.is_active = 1
     FOR UPDATE;

    IF v_supplier_code IS NULL OR v_origin_code IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Proveedor u origen invalido para el pre-lote';
    END IF;

    INSERT INTO prelot_sequences (supplier_id, origin_id, lot_date, next_value)
    VALUES (p_supplier_id, p_origin_id, p_planned_date, LAST_INSERT_ID(1))
    ON DUPLICATE KEY UPDATE next_value = LAST_INSERT_ID(next_value + 1);

    SET v_sequence = LAST_INSERT_ID();
    SET p_prelot_code = CONCAT(
        UPPER(v_supplier_code), '-', UPPER(v_origin_code), '-',
        DATE_FORMAT(p_planned_date, '%Y%m%d'), '-', LPAD(v_sequence, 3, '0')
    );

    INSERT INTO pre_lots (
        prelot_code, supplier_id, origin_id, appointment_id,
        planned_arrival_date, daily_sequence, expected_weight_kg,
        status, created_by
    ) VALUES (
        p_prelot_code, p_supplier_id, p_origin_id, p_appointment_id,
        p_planned_date, v_sequence, p_expected_weight_kg,
        'PLANNED', p_created_by
    );

    SET p_prelot_id = LAST_INSERT_ID();
    COMMIT;
END$$

DROP PROCEDURE IF EXISTS sp_post_inventory_movement$$
CREATE PROCEDURE sp_post_inventory_movement (
    IN p_movement_id BIGINT UNSIGNED,
    IN p_user_id     BIGINT UNSIGNED
)
BEGIN
    DECLARE v_status          VARCHAR(20);
    DECLARE v_line_count      INT DEFAULT 0;
    DECLARE v_shortage_count  INT DEFAULT 0;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT status
      INTO v_status
      FROM inventory_movements
     WHERE id = p_movement_id
     FOR UPDATE;

    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Movimiento inexistente';
    END IF;

    IF v_status <> 'DRAFT' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Solo se puede contabilizar un movimiento en borrador';
    END IF;

    SELECT COUNT(*)
      INTO v_line_count
      FROM inventory_movement_lines
     WHERE movement_id = p_movement_id;

    IF v_line_count = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El movimiento no contiene partidas';
    END IF;

    SELECT COUNT(*)
      INTO v_shortage_count
      FROM (
        SELECT
            nl.item_id,
            nl.inventory_lot_id,
            nl.warehouse_id,
            nl.location_id,
            COALESCE((
                SELECT SUM(el.quantity_delta)
                  FROM inventory_movement_lines el
                  INNER JOIN inventory_movements em ON em.id = el.movement_id
                 WHERE em.status = 'POSTED'
                   AND el.item_id = nl.item_id
                   AND el.inventory_lot_id <=> nl.inventory_lot_id
                   AND el.warehouse_id = nl.warehouse_id
                   AND el.location_id = nl.location_id
            ), 0) + SUM(nl.quantity_delta) AS resulting_qty,
            MAX(i.allow_negative_stock) AS allow_negative_stock
          FROM inventory_movement_lines nl
          INNER JOIN items i ON i.id = nl.item_id
         WHERE nl.movement_id = p_movement_id
         GROUP BY nl.item_id, nl.inventory_lot_id, nl.warehouse_id, nl.location_id
        HAVING allow_negative_stock = 0 AND resulting_qty < 0
      ) shortages;

    IF v_shortage_count > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El movimiento produciria existencias negativas';
    END IF;

    SET @inventory_post_context = 1;

    UPDATE inventory_movements
       SET status = 'POSTED',
           posted_by = p_user_id,
           posted_at = CURRENT_TIMESTAMP(6)
     WHERE id = p_movement_id;

    SET @inventory_post_context = NULL;

    INSERT INTO audit_log (
        actor_user_id, action_code, entity_type, entity_id, after_data
    ) VALUES (
        p_user_id, 'POST', 'inventory_movement', CAST(p_movement_id AS CHAR),
        JSON_OBJECT('status', 'POSTED')
    );

    COMMIT;
END$$

DELIMITER ;

-- -----------------------------------------------------------------------------
-- DATOS INICIALES
-- -----------------------------------------------------------------------------

INSERT IGNORE INTO areas (code, name) VALUES
('ADMIN', 'Administracion del sistema'),
('COMPRAS', 'Compras'),
('LOGISTICA', 'Logistica'),
('ALMACEN', 'Almacenes'),
('CALIDAD', 'Calidad'),
('PLANEACION', 'Planeacion'),
('PRODUCCION', 'Produccion'),
('EXTRACCION', 'Extraccion'),
('VENTAS', 'Ventas'),
('MANTENIMIENTO', 'Mantenimiento');

-- El id=1 se reserva intencionalmente para aplicar la regla de un solo administrador.
INSERT IGNORE INTO roles (id, code, name, description, is_system) VALUES
(1, 'SUPER_ADMIN', 'Administrador del sistema', 'Acceso total. Solo puede existir uno activo.', 1),
(2, 'AREA_MANAGER', 'Responsable de area', 'Gestiona catalogos y operaciones autorizadas de su area.', 1),
(3, 'OPERATOR', 'Operador', 'Captura operaciones dentro de los modulos asignados.', 1),
(4, 'APPROVER', 'Aprobador', 'Aprueba o rechaza operaciones autorizadas.', 1),
(5, 'VIEWER', 'Consulta', 'Acceso de solo lectura a informacion autorizada.', 1);

INSERT IGNORE INTO app_modules (code, name, route_path, sort_order) VALUES
('DASHBOARD', 'Tablero', '/dashboard', 10),
('ADMIN', 'Administracion', '/admin', 20),
('CATALOGS', 'Catalogos', '/catalogos', 30),
('FORECAST', 'Forecast', '/planeacion/forecast', 40),
('MRP', 'MRP', '/planeacion/mrp', 50),
('PURCHASING', 'Compras y recolecciones', '/compras', 60),
('APPOINTMENTS', 'Citas y andenes', '/citas', 70),
('RECEIVING', 'Recepciones', '/almacen/recepciones', 80),
('QUALITY', 'Calidad', '/calidad', 90),
('INVENTORY', 'Inventarios', '/almacen/inventarios', 100),
('PRODUCTION', 'Ordenes de produccion', '/produccion', 110),
('EXTRACTION', 'Extraccion y trazabilidad', '/extraccion', 120),
('SHIPPING', 'Surtido y embarques', '/embarques', 130),
('SALES', 'Pedidos de clientes', '/ventas', 140),
('RETURNS', 'Rechazos y devoluciones', '/devoluciones', 150),
('COUNTS', 'Auditorias de almacen', '/almacen/conteos', 160),
('MAINTENANCE', 'Mantenimiento', '/mantenimiento', 170),
('REPORTS', 'Reportes', '/reportes', 180),
('AUDIT_LOG', 'Bitacora del sistema', '/admin/auditoria', 190);

INSERT IGNORE INTO permissions (module_id, action_code, description)
SELECT m.id, a.action_code, CONCAT(a.action_code, ' en ', m.name)
FROM app_modules m
CROSS JOIN (
    SELECT 'VIEW' AS action_code UNION ALL
    SELECT 'CREATE' UNION ALL
    SELECT 'UPDATE' UNION ALL
    SELECT 'APPROVE' UNION ALL
    SELECT 'REJECT' UNION ALL
    SELECT 'POST' UNION ALL
    SELECT 'EXPORT' UNION ALL
    SELECT 'ADMIN'
) a;

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions;

INSERT IGNORE INTO units_of_measure (code, name, decimal_places) VALUES
('KG', 'Kilogramo', 3),
('G', 'Gramo', 3),
('L', 'Litro', 3),
('ML', 'Mililitro', 3),
('EA', 'Pieza', 0),
('BOX', 'Caja', 0),
('BEAN', 'Bean o contenedor de fruta', 0),
('PALLET', 'Tarima', 0);

INSERT IGNORE INTO item_categories (code, name) VALUES
('FRUIT', 'Fruta y materia prima agricola'),
('RAW', 'Otras materias primas'),
('PACK', 'Materiales de empaque'),
('SPARE', 'Refacciones'),
('CONSUM', 'Consumibles'),
('BULK', 'Aceites a granel y producto en proceso'),
('FG', 'Producto terminado');

INSERT IGNORE INTO schema_migrations (version_no, description)
VALUES ('001', 'Esquema inicial de almacenes, MRP, calidad y trazabilidad'),
       ('002', 'Importacion idempotente de vistas, rutinas, disparadores y catalogos base');

-- CREACION DEL PRIMER ADMINISTRADOR
-- La aplicacion debe crear el usuario con un hash Argon2id o bcrypt, nunca con texto plano,
-- y asignarle role_id=1 dentro de una transaccion. La restriccion uq_one_active_super_admin
-- impide que existan dos SUPER_ADMIN activos al mismo tiempo.
