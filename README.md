# Oleolab · Control de Almacenes

Aplicación web para inventarios, trazabilidad, citas, Calidad, Forecast, MRP, producción, embarques, devoluciones, auditorías y requisiciones de Mantenimiento.

La identidad visual toma como referencia la aplicación de Mantenimiento de Oleolab; el repositorio `Pruebas` no fue modificado.

## Componentes

```text
Navegador -> frontend estático -> API PHP 8.3 -> MySQL 8 en localhost
```

- `index.html`, `styles.css`, `app.js`: interfaz adaptable.
- `config.js`: configuración pública de producción; no contiene secretos.
- `api/`: API PHP con sesiones, permisos por área, auditoría, notificaciones y operaciones.
- `database/schema.sql`: esquema MySQL 8.0, catálogos base, vistas, controles y procedimientos.
- `database/migration_v1_3.sql`: actualización aditiva para una base v1.2 ya instalada.
- `database/migration_v1_4.sql`: módulos separados, WID, Calidad analítica, Envasado y Extracción trazable.
- `assets/xlsx.full.min.js`: lector local de Excel utilizado por el importador de Forecast.
- `private-tools/create_admin.php`: creación por consola del único superadministrador.
- `INSTALACION.md`: publicación paso a paso en cPanel.

## Seguridad incluida

- La contraseña de MySQL permanece únicamente en `api/config.local.php`, excluido de Git.
- Contraseñas de usuarios con `password_hash`; nunca se guardan en texto claro.
- Sesiones aleatorias almacenadas como hash, bloqueo por intentos fallidos y expiración.
- Permisos por módulo/acción, un solo superadministrador activo y bitácora de cambios.
- Consultas preparadas, política CSP, restricción de origen y carpetas sin listado.
- Movimientos contabilizados inmutables; las correcciones se realizan con reversas.

## Funciones de la versión 0.3

- Paneles diferenciados de Almacenes, Compras, Calidad y Mantenimiento.
- Administración exclusiva del único superadministrador, roles personalizados y módulos seleccionados con casillas.
- Altas separadas de materias primas y aceites, materiales de empaque, refacciones y producto terminado.
- Levantamiento de inventario inicial sin cita de proveedor y auditoría física con ajuste trazable.
- Calendario semanal de auditorías, indicador de confiabilidad y reporte Excel de diferencias con observaciones.
- Importación de Forecast desde Excel, historial original contra revisiones y validación exacta de códigos.
- Listas de materiales y cálculo automático de necesidades contra existencias y reservas.
- Reporte analítico de inventario y reporte ejecutivo en Excel.
- Solicitudes de Mantenimiento, varios técnicos, horas, bitácora, fotografías y avisos por correo.
- Catálogos de ejemplo identificados con `[EJEMPLO]`, visibles en su área y sin cantidades ficticias de inventario.
- WID sin afectación física, pre-lote desde la cita y recepción con solicitud automática de Calidad.
- Dictámenes parciales, resultados analíticos de aguacate y extracción, y maestro de lotes exportable.
- Órdenes de Envasado, consumo automático por lista de materiales, merma y entrada trazable a producto terminado.
- Extracción con lote de aguacate de origen, meta de contenedores por hora y genealogía del lote resultante.

La instalación, actualización y operación se explican en `INSTALACION.md`, `ACTUALIZACION_V0.3.md` y `GUIA_RAPIDA_MODULOS.md`.

## Repositorios

- Aplicación: <https://github.com/mr-roberth/Almacen>
- Referencia visual únicamente: <https://github.com/mr-roberth/Pruebas>
