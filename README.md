# Oleolab · Control de Almacenes

Aplicación web para inventarios, trazabilidad, citas, Calidad, Forecast, MRP, producción, embarques, devoluciones, auditorías y requisiciones de Mantenimiento.

La identidad visual toma como referencia la aplicación de Mantenimiento de Oleolab; el repositorio `Pruebas` no fue modificado.

## Componentes

```text
Navegador -> frontend estático -> API PHP 8.3 -> MySQL 8 en localhost
```

- `index.html`, `styles.css`, `app.js`: interfaz adaptable.
- `config.js`: configuración pública de producción; no contiene secretos.
- `api/`: API PHP con sesiones, permisos, auditoría y operaciones iniciales.
- `database/schema.sql`: esquema MySQL 8.0, catálogos base, vistas, controles y procedimientos.
- `private-tools/create_admin.php`: creación por consola del único superadministrador.
- `INSTALACION.md`: publicación paso a paso en cPanel.

## Seguridad incluida

- La contraseña de MySQL permanece únicamente en `api/config.local.php`, excluido de Git.
- Contraseñas de usuarios con `password_hash`; nunca se guardan en texto claro.
- Sesiones aleatorias almacenadas como hash, bloqueo por intentos fallidos y expiración.
- Permisos por módulo/acción, un solo superadministrador activo y bitácora de cambios.
- Consultas preparadas, política CSP, restricción de origen y carpetas sin listado.
- Movimientos contabilizados inmutables; las correcciones se realizan con reversas.

## Estado funcional

Esta entrega es una base instalable para conectar y pilotear los flujos de citas, recepciones/pre-lotes, solicitudes de Calidad, movimientos, conteos y devoluciones. El esquema cubre el alcance integral. Antes de liberar la operación diaria deben cargarse los catálogos reales y ejecutarse las pruebas de aceptación descritas en `INSTALACION.md`.

## Repositorios

- Aplicación: <https://github.com/mr-roberth/Almacen>
- Referencia visual únicamente: <https://github.com/mr-roberth/Pruebas>
