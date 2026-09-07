# Actualización del ambiente de pruebas a la versión 0.3

Esta actualización conserva la conexión actual, los usuarios, los movimientos y las existencias. El paquete no incluye `api/config.local.php` ni fotografías guardadas en `storage`.

## Aplicar los cambios

1. Cambie en cPanel la contraseña del usuario MySQL que utiliza esta aplicación. Una contraseña anterior apareció en una captura compartida y ya no debe considerarse secreta. Actualice la nueva contraseña sólo dentro de `api/config.local.php`; no la suba a GitHub ni la envíe por mensaje.
2. En phpMyAdmin seleccione `ci4kash_Oleolab` y use **Exportar → Rápido → SQL**. Guarde ese respaldo antes de continuar.
3. Sin cambiar de base, abra **Importar** y cargue únicamente `database/migration_v1_4.sql`. Debe aparecer el mensaje verde de importación exitosa. No vuelva a importar `schema.sql` ni `migration_v1_3.sql` si ya los aplicó.
4. En cPanel abra `public_html/Apps/Almacen` y descargue una copia de `api/config.local.php`. No lo borre ni lo reemplace durante la extracción.
5. Conserve la carpeta `storage`, porque contiene las evidencias privadas de Mantenimiento.
6. Cargue `oleolab-almacen-cpanel-v0.3.0.zip` en esa misma carpeta. Selecciónelo, pulse **Extraer** y acepte reemplazar archivos existentes. El mensaje `inflating` significa que la extracción terminó correctamente.
7. Compruebe que estén estos archivos nuevos: `api/v14.php`, `database/migration_v1_4.sql` y `ACTUALIZACION_V0.3.md`.
8. Confirme permisos recomendados: carpetas `755`, archivos `644`, `api/config.local.php` `600` y `storage/private/maintenance` `750` o `755` según admita el hosting.
9. Abra `https://ci4kash.com/Apps/Almacen/api/index.php?action=health`. La respuesta debe incluir `"status":"ok"` y `"database":"connected"`.
10. Abra `https://ci4kash.com/Apps/Almacen/`, cierre la sesión anterior si sigue abierta, presione `Ctrl+F5` e inicie sesión otra vez.

## Prueba mínima recomendada

1. Entre como Administrador del sistema y compruebe que ve **Usuarios, roles y áreas** y **Bitácora del sistema**.
2. Cree un rol de prueba y un usuario de Almacenes con un solo módulo de almacén. Inicie sesión con él y confirme que no aparecen Administración ni otros almacenes.
3. En ese almacén cree un material de prueba y capture una existencia desde **Inventario físico → Inventario inicial**.
4. En Compras registre proveedor, origen y cita. Confirme que aparezca en WID con pre-lote y que aún no modifique existencias.
5. Desde el almacén correspondiente use **Recibir cita WID**. Confirme la solicitud automática de Calidad y que el lote quede bloqueado.
6. En Calidad libere una parte y rechace otra; ambas cantidades deben sumar la recibida. Revise las existencias resultantes.
7. En Envasado cree o complete una lista de materiales, genere una orden y registre producto terminado con merma. Verifique el consumo automático de componentes.
8. En Extracción seleccione un lote de aguacate, registre contenedores y horas, y luego capture el resultado desde Calidad.
9. En Mantenimiento levante una solicitud con fotografía, asigne dos técnicos y registre sus intervenciones.

Si una operación devuelve un mensaje rojo, no repita varias veces el botón. Copie el texto completo y revise primero que la cuenta tenga área, rol y módulo correctos.
