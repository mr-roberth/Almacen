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
- `database/migration_v1_5.sql`: almacenes base oficiales, zonas claras y ejemplos únicamente como sugerencias.
- `database/migration_v1_6.sql`: catálogo PT/CME, listas de materiales y edición de usuarios con teléfono.
- `database/migration_v1_7.sql`: recolecciones simplificadas, Logística, conductores, ubicación y ruta.
- `database/migration_v1_8.sql`: catálogos depurados, formulaciones, Forecast semanal y control del inventario inicial.
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

## Funciones de la versión 0.8.0

- Interfaz central simplificada en tres almacenes: Materias primas y aceites, Materiales de empaque y Producto terminado.
- Administración exclusiva del único superadministrador, con usuarios, roles, áreas y módulos seleccionados mediante casillas.
- Catálogo oficial depurado de 135 productos terminados, 432 materiales de empaque y 992 relaciones de empaque.
- Doce formulaciones de aceite versionadas; su consumo en litros se calcula según la presentación en mililitros de cada producto.
- Inventario inicial sin cita, cierre por almacén, auditoría física y reporte de diferencias con trazabilidad.
- Entrada y salida guiadas por catálogo: almacén, unidad y WID se resuelven automáticamente; las salidas no permiten consumir más de lo disponible.
- WID separado de la existencia disponible y rechazado, con solicitud automática y dictamen parcial de Calidad.
- Órdenes de producción ligadas a la versión vigente de empaque y formulación, sin modificar órdenes anteriores.
- Forecast único versionado, comparación contra órdenes reales y distribución semanal que conserva el total mensual.
- Proyección acumulada: existencia disponible + llegadas planeadas − consumo del Forecast.
- Registro de 52 observaciones del origen sin inventar datos; 28 claves no oficiales del Forecast quedaron excluidas.
- Datos y API aislados por permisos: cada usuario recibe solamente los almacenes y módulos que tiene autorizados.

Las tablas y flujos históricos de versiones anteriores se conservan para no perder información, pero la navegación 0.8 muestra únicamente el núcleo operativo descrito arriba.

La actualización y la operación se explican en `ACTUALIZACION_V0.8.md` y `GUIA_RAPIDA_MODULOS_V0.8.md`.

## Repositorios

- Aplicación: <https://github.com/mr-roberth/Almacen>
- Referencia visual únicamente: <https://github.com/mr-roberth/Pruebas>
