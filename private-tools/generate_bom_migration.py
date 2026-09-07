#!/usr/bin/env python3
"""Genera la migración oficial de listas de materiales desde el Excel de Oleolab.

La fila verde inicia un producto terminado y todas las filas siguientes, hasta la
próxima fila verde, son sus componentes. El script nunca lee ni modifica la base
de datos: solamente genera SQL repetible para importar en phpMyAdmin.
"""

from __future__ import annotations

import argparse
import collections
import hashlib
import math
from pathlib import Path

import openpyxl


PRODUCT_FILL = "FFB6D7A8"
IMPORT_DATE = "2026-09-07"
NAME_CORRECTIONS = {
    "CME06289": "MANGA PVC 8 TIN PVC COCOCARE 1.66 ML OLEOLAB",
    "CME07113": "ETI BOPP UV MATE AVOCARE BLEND 750 FTE PET OLEOLAB",
    "CME07114": "ETI BOPP UV MATE AVOCARE BLEND 750 REV PET OLEOLAB",
}


def text(value: object) -> str:
    return " ".join(str(value or "").strip().split())


def number(value: object, label: str, row: int) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Fila {row}: {label} no es numérico.") from exc
    if not math.isfinite(result) or result <= 0:
        raise ValueError(f"Fila {row}: {label} debe ser mayor que cero.")
    return result


def sql_text(value: str) -> str:
    return "'" + value.replace("\\", "\\\\").replace("'", "''") + "'"


def sql_number(value: float) -> str:
    formatted = f"{value:.8f}".rstrip("0").rstrip(".")
    return formatted or "0"


def chunks(rows: list[tuple[object, ...]], size: int = 200):
    for start in range(0, len(rows), size):
        yield rows[start : start + size]


def values_sql(table: str, columns: str, rows: list[tuple[object, ...]]) -> str:
    statements: list[str] = []
    for group in chunks(rows):
        encoded = []
        for row in group:
            values = []
            for value in row:
                if isinstance(value, str):
                    values.append(sql_text(value))
                elif isinstance(value, float):
                    values.append(sql_number(value))
                else:
                    values.append(str(value))
            encoded.append("(" + ",".join(values) + ")")
        statements.append(f"INSERT INTO {table} ({columns}) VALUES\n  " + ",\n  ".join(encoded) + ";")
    return "\n\n".join(statements)


def load_source(path: Path):
    formulas = openpyxl.load_workbook(path, data_only=False, read_only=False).active
    values = openpyxl.load_workbook(path, data_only=True, read_only=False).active
    expected = [
        "Producto",
        "Nombre Producto",
        "Codigo Interno",
        "Materia Prima, Material de Empaque",
        "Cajas x Pallet",
        "Piezas x Caja",
        "Cantidad x caja",
        "Catidad por pieza",
        "Unidad",
    ]
    actual = [text(formulas.cell(1, column).value) for column in range(1, 10)]
    if actual != expected:
        raise ValueError("Los encabezados del Excel cambiaron; no se generó SQL para evitar una importación incorrecta.")

    raw_rows = []
    for row in range(2, formulas.max_row + 1):
        cells = [formulas.cell(row, column) for column in range(1, 10)]
        if not any(cell.value not in (None, "") for cell in cells):
            continue
        fill = cells[0].fill.fgColor.rgb if cells[0].fill.fill_type == "solid" else None
        raw_rows.append(
            {
                "row": row,
                "product_code": text(cells[0].value).upper(),
                "product_name": text(cells[1].value),
                "internal_code": text(cells[2].value).upper(),
                "material_name": text(cells[3].value),
                "pieces": cells[5].value,
                "per_box": cells[6].value,
                "per_piece": values.cell(row, 8).value,
                "unit": text(cells[8].value),
                "is_product": fill == PRODUCT_FILL,
            }
        )

    products = []
    grouped: dict[str, list[dict[str, object]]] = collections.OrderedDict()
    current: dict[str, object] | None = None
    for row in raw_rows:
        if row["is_product"]:
            code = str(row["product_code"])
            if not code.startswith("PT") or row["internal_code"] != code:
                raise ValueError(f"Fila {row['row']}: la fila verde no contiene una clave PT consistente.")
            current = row
            grouped[code] = []
            products.append(row)
        else:
            if current is None:
                raise ValueError(f"Fila {row['row']}: componente sin una fila verde anterior.")
            if not str(row["internal_code"]).startswith("CME"):
                raise ValueError(f"Fila {row['row']}: el componente no tiene una clave CME.")
            grouped[str(current["product_code"])].append(row)

    if len(products) != 195:
        raise ValueError(f"Se esperaban 195 filas verdes y se encontraron {len(products)}.")
    if any(not rows for rows in grouped.values()):
        raise ValueError("Existe al menos una lista sin componentes.")

    material_names: dict[str, collections.Counter[str]] = collections.defaultdict(collections.Counter)
    for component_rows in grouped.values():
        for row in component_rows:
            material_names[str(row["internal_code"])][str(row["material_name"])] += 1

    canonical_names = {}
    for code, names in material_names.items():
        if code in NAME_CORRECTIONS:
            canonical_names[code] = NAME_CORRECTIONS[code]
        else:
            canonical_names[code] = sorted(names.items(), key=lambda entry: (-entry[1], entry[0]))[0][0]

    product_rows: list[tuple[object, ...]] = []
    component_rows: list[tuple[object, ...]] = []
    for product in products:
        code = str(product["product_code"])
        source_unit = str(product["unit"]).lower()
        pieces = number(product["pieces"], "Piezas x Caja", int(product["row"]))
        per_box = number(product["per_box"], "Cantidad x caja", int(product["row"]))
        cached = number(product["per_piece"], "Cantidad por pieza", int(product["row"]))
        calculated = per_box / pieces
        # Los productos en caja se planean por pieza. Los graneles marcados kg se
        # planean por kilogramo. PT02015 está marcado Pz, pero su propio factor
        # 1/950 confirma que el renglón representa kilogramos de un tote.
        output_uom = "KG" if source_unit == "kg" or (source_unit == "pz" and pieces > 1 and math.isclose(cached, calculated, rel_tol=1e-8, abs_tol=1e-10)) else "EA"
        product_rows.append((code, str(product["product_name"]), output_uom, int(product["row"])))
        seen: set[str] = set()
        for line_no, component in enumerate(grouped[code], start=1):
            component_code = str(component["internal_code"])
            if component_code in seen:
                raise ValueError(f"Lista {code}: el componente {component_code} está repetido.")
            seen.add(component_code)
            if output_uom == "KG":
                quantity = number(component["per_box"], "Cantidad x caja", int(component["row"])) / number(component["pieces"], "Piezas x Caja", int(component["row"]))
            else:
                quantity = number(component["per_piece"], "Cantidad por pieza", int(component["row"]))
            component_rows.append((code, line_no, component_code, quantity, int(component["row"])))

    materials = [(code, name, min(row["row"] for rows in grouped.values() for row in rows if row["internal_code"] == code)) for code, name in sorted(canonical_names.items())]
    return product_rows, materials, component_rows, material_names


def build_sql(source: Path, product_rows, material_rows, component_rows) -> str:
    digest = hashlib.sha256(source.read_bytes()).hexdigest().upper()
    source_reference = f"OLEOLAB_BOM_{IMPORT_DATE.replace('-', '')}_{digest[:12]}"
    sections = [
        """-- Oleolab Almacenes · Migración 006
-- Catálogos y listas de materiales provenientes del Excel oficial de Oleolab.
-- Es acumulativa: NO elimina usuarios, inventarios, movimientos ni historial.
-- Se puede importar nuevamente; la misma fuente actualiza su propia versión.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- Columnas nuevas, agregadas de manera compatible con MySQL 8 y phpMyAdmin.
SET @column_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema=DATABASE() AND table_name='app_users' AND column_name='phone_number'
);
SET @ddl = IF(@column_exists=0,
  'ALTER TABLE app_users ADD COLUMN phone_number VARCHAR(40) NULL AFTER display_name',
  'SELECT 1'
);
PREPARE migration_statement FROM @ddl;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @column_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema=DATABASE() AND table_name='bom_versions' AND column_name='source_reference'
);
SET @ddl = IF(@column_exists=0,
  'ALTER TABLE bom_versions ADD COLUMN source_reference VARCHAR(100) NULL AFTER expected_yield_pct',
  'SELECT 1'
);
PREPARE migration_statement FROM @ddl;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @index_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema=DATABASE() AND table_name='bom_versions' AND index_name='uq_bom_versions_source'
);
SET @ddl = IF(@index_exists=0,
  'ALTER TABLE bom_versions ADD UNIQUE KEY uq_bom_versions_source (bom_id,source_reference)',
  'SELECT 1'
);
PREPARE migration_statement FROM @ddl;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

START TRANSACTION;

-- Limpieza visual de los registros base. Si ya se aplicó la migración 005,
-- estas instrucciones no vuelven a cambiar nada.
UPDATE warehouses example LEFT JOIN warehouses official ON official.code='MP'
SET example.code='MP',example.name='Almacén de materia prima'
WHERE example.code='EJ-MP' AND official.id IS NULL;
UPDATE warehouses example LEFT JOIN warehouses official ON official.code='EMPAQUE'
SET example.code='EMPAQUE',example.name='Almacén de materiales de empaque'
WHERE example.code='EJ-EMPAQUE' AND official.id IS NULL;
UPDATE warehouses example LEFT JOIN warehouses official ON official.code='REFACCIONES'
SET example.code='REFACCIONES',example.name='Almacén de refacciones'
WHERE example.code='EJ-REF' AND official.id IS NULL;
UPDATE warehouses example LEFT JOIN warehouses official ON official.code='PT'
SET example.code='PT',example.name='Almacén de producto terminado'
WHERE example.code='EJ-PT' AND official.id IS NULL;
UPDATE warehouses SET is_active=0 WHERE code IN ('EJ-MP','EJ-EMPAQUE','EJ-REF','EJ-PT');
UPDATE warehouse_locations l INNER JOIN warehouses w ON w.id=l.warehouse_id
SET l.name=CASE l.location_type
  WHEN 'RECEIVING' THEN 'Recepción temporal · mercancía recién llegada'
  WHEN 'QUALITY_HOLD' THEN 'Pendiente de liberación por Calidad'
  WHEN 'STORAGE' THEN 'Existencia disponible'
  WHEN 'PICKING' THEN 'Preparación de surtido'
  WHEN 'SHIPPING' THEN 'Preparación de embarque'
  WHEN 'REJECTED' THEN 'Producto rechazado · no disponible'
  ELSE REPLACE(l.name,'[EJEMPLO] ','') END
WHERE w.code IN ('MP','EMPAQUE','REFACCIONES','PT')
  AND l.name IN ('[EJEMPLO] Zona de recibo','[EJEMPLO] Ubicación de almacenamiento','Producto rechazado por Calidad');

DROP TEMPORARY TABLE IF EXISTS tmp_oleolab_bom_products;
DROP TEMPORARY TABLE IF EXISTS tmp_oleolab_bom_materials;
DROP TEMPORARY TABLE IF EXISTS tmp_oleolab_bom_components;
CREATE TEMPORARY TABLE tmp_oleolab_bom_products (
  product_code VARCHAR(80) NOT NULL PRIMARY KEY,
  product_name VARCHAR(190) NOT NULL,
  output_uom_code VARCHAR(20) NOT NULL,
  source_row INT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TEMPORARY TABLE tmp_oleolab_bom_materials (
  material_code VARCHAR(80) NOT NULL PRIMARY KEY,
  material_name VARCHAR(190) NOT NULL,
  source_row INT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TEMPORARY TABLE tmp_oleolab_bom_components (
  product_code VARCHAR(80) NOT NULL,
  line_no INT UNSIGNED NOT NULL,
  material_code VARCHAR(80) NOT NULL,
  qty_per_output DECIMAL(18,8) NOT NULL,
  source_row INT UNSIGNED NOT NULL,
  PRIMARY KEY (product_code,line_no),
  UNIQUE KEY uq_tmp_bom_component (product_code,material_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;""",
        values_sql("tmp_oleolab_bom_products", "product_code,product_name,output_uom_code,source_row", product_rows),
        values_sql("tmp_oleolab_bom_materials", "material_code,material_name,source_row", material_rows),
        values_sql("tmp_oleolab_bom_components", "product_code,line_no,material_code,qty_per_output,source_row", component_rows),
        f"""
SET @oleolab_bom_source = {sql_text(source_reference)};
SET @oleolab_bom_hash = {sql_text(digest)};
SET @system_admin_id = (
  SELECT ur.user_id FROM user_roles ur
  INNER JOIN roles r ON r.id=ur.role_id
  INNER JOIN app_users u ON u.id=ur.user_id
  WHERE ur.is_active=1 AND r.code='SUPER_ADMIN' AND u.status='ACTIVE'
  ORDER BY ur.id LIMIT 1
);

-- Crea o actualiza los catálogos por su clave única. Los IDs existentes se
-- conservan, por lo que no se rompen inventarios ni movimientos anteriores.
INSERT INTO items
  (category_id,base_uom_id,sku,name,item_type,lot_controlled,quality_required,created_by)
SELECT category.id,uom.id,product.product_code,product.product_name,'FINISHED_GOOD',1,1,@system_admin_id
FROM tmp_oleolab_bom_products product
INNER JOIN item_categories category ON category.code='FG'
INNER JOIN units_of_measure uom ON uom.code=product.output_uom_code
ON DUPLICATE KEY UPDATE
  category_id=VALUES(category_id),base_uom_id=VALUES(base_uom_id),name=VALUES(name),
  item_type='FINISHED_GOOD',lot_controlled=1,quality_required=1,is_active=1;

INSERT INTO items
  (category_id,base_uom_id,sku,name,item_type,lot_controlled,quality_required,created_by)
SELECT category.id,uom.id,material.material_code,material.material_name,'PACKAGING',1,1,@system_admin_id
FROM tmp_oleolab_bom_materials material
INNER JOIN item_categories category ON category.code='PACK'
INNER JOIN units_of_measure uom ON uom.code='EA'
ON DUPLICATE KEY UPDATE
  category_id=VALUES(category_id),base_uom_id=VALUES(base_uom_id),name=VALUES(name),
  item_type='PACKAGING',lot_controlled=1,quality_required=1,is_active=1;

INSERT INTO bills_of_material (bom_code,output_item_id,name,is_active,created_by)
SELECT CONCAT('BOM-',product.product_code),item.id,
       CONCAT('Lista de materiales ',product.product_code),1,@system_admin_id
FROM tmp_oleolab_bom_products product
INNER JOIN items item ON item.sku=product.product_code
ON DUPLICATE KEY UPDATE
  output_item_id=VALUES(output_item_id),name=VALUES(name),is_active=1;

-- Crea una versión identificable por la fuente. Una segunda importación de este
-- mismo archivo actualiza la versión, sin acumular componentes duplicados.
INSERT INTO bom_versions
  (bom_id,version_no,output_qty,output_uom_id,effective_from,status,expected_yield_pct,source_reference,approved_by,approved_at)
SELECT bom.id,
       COALESCE((SELECT MAX(existing.version_no)+1 FROM bom_versions existing WHERE existing.bom_id=bom.id),1),
       1,item.base_uom_id,'2020-01-01','DRAFT',100,@oleolab_bom_source,@system_admin_id,UTC_TIMESTAMP(6)
FROM tmp_oleolab_bom_products product
INNER JOIN items item ON item.sku=product.product_code
INNER JOIN bills_of_material bom ON bom.output_item_id=item.id AND bom.bom_code=CONCAT('BOM-',product.product_code)
ON DUPLICATE KEY UPDATE
  output_qty=VALUES(output_qty),output_uom_id=VALUES(output_uom_id),
  effective_from=VALUES(effective_from),effective_to=NULL,status='DRAFT',
  expected_yield_pct=100,approved_by=VALUES(approved_by),approved_at=VALUES(approved_at);

DELETE component FROM bom_components component
INNER JOIN bom_versions version ON version.id=component.bom_version_id
WHERE version.source_reference=@oleolab_bom_source;

INSERT INTO bom_components
  (bom_version_id,line_no,component_item_id,component_uom_id,qty_per_output,scrap_pct,is_optional)
SELECT version.id,component.line_no,item.id,uom.id,component.qty_per_output,0,0
FROM tmp_oleolab_bom_components component
INNER JOIN bills_of_material bom ON bom.bom_code=CONCAT('BOM-',component.product_code)
INNER JOIN bom_versions version ON version.bom_id=bom.id AND version.source_reference=@oleolab_bom_source
INNER JOIN items item ON item.sku=component.material_code
INNER JOIN units_of_measure uom ON uom.code='EA';

UPDATE bom_versions previous
INNER JOIN bills_of_material bom ON bom.id=previous.bom_id
INNER JOIN tmp_oleolab_bom_products product ON bom.bom_code=CONCAT('BOM-',product.product_code)
SET previous.status='OBSOLETE',previous.effective_to=NULL
WHERE previous.status='ACTIVE'
  AND (previous.source_reference IS NULL OR previous.source_reference<>@oleolab_bom_source);

UPDATE bom_versions
SET status='ACTIVE',effective_to=NULL,approved_by=@system_admin_id,approved_at=UTC_TIMESTAMP(6)
WHERE source_reference=@oleolab_bom_source;

INSERT IGNORE INTO schema_migrations (version_no,description)
VALUES ('006',CONCAT('195 PT, 432 materiales de empaque y 1325 componentes · fuente ',@oleolab_bom_hash));

COMMIT;

-- Resultado esperado para comprobar la carga en phpMyAdmin.
SELECT
  (SELECT COUNT(*) FROM tmp_oleolab_bom_products) AS productos_terminados_fuente,
  (SELECT COUNT(*) FROM tmp_oleolab_bom_materials) AS materiales_empaque_fuente,
  (SELECT COUNT(*) FROM tmp_oleolab_bom_components) AS componentes_fuente,
  (SELECT COUNT(*) FROM bom_versions WHERE source_reference=@oleolab_bom_source AND status='ACTIVE') AS listas_activas_importadas;
""",
    ]
    return "\n\n".join(sections)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    products, materials, components, conflicts = load_source(args.source)
    args.output.write_text(build_sql(args.source, products, materials, components), encoding="utf-8", newline="\n")
    print(f"Generado: {args.output}")
    print(f"Productos terminados: {len(products)}")
    print(f"Materiales de empaque: {len(materials)}")
    print(f"Componentes: {len(components)}")
    print(f"Claves con variantes de nombre normalizadas: {sum(1 for names in conflicts.values() if len(names) > 1)}")


if __name__ == "__main__":
    main()
