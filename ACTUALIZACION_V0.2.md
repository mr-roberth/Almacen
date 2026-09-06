# Actualización productiva a la versión 0.2

Esta actualización conserva la base `ci4kash_Oleolab`, el usuario MySQL, la contraseña, el administrador creado y los registros actuales. La migración sólo agrega tablas, roles y módulos.

## Pasos en cPanel

1. En phpMyAdmin, exporte una copia de seguridad de `ci4kash_Oleolab`.
2. Seleccione esa misma base e importe `database/migration_v1_3.sql`. Debe terminar sin errores.
3. En `public_html/Apps/Almacen`, conserve sin cambios `api/config.local.php` y la carpeta `storage` si ya contiene evidencias.
4. Cargue el archivo ZIP de la versión 0.2, extráigalo en esa misma carpeta y acepte reemplazar los archivos de la aplicación. El paquete no contiene `api/config.local.php`.
5. Compruebe permisos `755` en carpetas, `644` en archivos y `750` o `755` en `storage/private/maintenance`.
6. Abra `https://ci4kash.com/Apps/Almacen/api/index.php?action=health`. La respuesta correcta contiene `"status":"ok"` y `"database":"connected"`.
7. Cierre la sesión de la aplicación, recargue con `Ctrl+F5` y vuelva a entrar.

## Activar avisos por correo

Agregue este bloque al arreglo principal de `api/config.local.php`, después de `security`:

```php
'notifications' => [
    'enabled' => true,
    'from_email' => 'notificaciones@ci4kash.com',
    'from_name' => 'Oleolab',
],
```

Conviene crear en cPanel la cuenta o remitente `notificaciones@ci4kash.com`. Esto sólo utiliza el correo saliente de PHP: no modifica DNS, buzones, recepción de correos ni la base de otra aplicación. Si el servidor no confirma un envío, la operación se guarda y el intento queda registrado como fallido en `email_notifications`.

## Orden recomendado para comenzar

1. Administración: cree jefes con el rol **Administrador de área**. Marque **Equipo del área** y únicamente sus módulos.
2. Revise los registros cuyo nombre comienza con **[EJEMPLO]**. La migración incluye ejemplos de almacenes, ubicaciones, proveedor, origen, cliente, materias primas, aceite, materiales de empaque, refacción, producto terminado, equipo, vehículo, contenedor y lista de materiales. No se cargan cantidades ficticias de inventario.
3. Almacenes: cree o adapte los registros reales en las ventanas separadas de materias primas y aceites, materiales de empaque, refacciones y productos terminados.
4. Almacenes: use **Levantamiento de inventario → Inventario inicial** para cargar las existencias actuales sin cita de proveedor.
5. Planeación: agregue a cada producto terminado todos sus componentes desde **Catálogos → Listas de materiales**. Guarde una vez por componente.
6. Planeación: importe el Excel en **Forecast**. Los códigos deben coincidir exactamente con Producto terminado. La primera carga queda como original y las siguientes como revisiones.
7. Revise **Necesidades** y el panel de Compras. El cálculo se actualiza automáticamente cuando cambia el Forecast, una lista de materiales o una existencia.
8. En **Historial de auditorías**, programe los días y horarios de conteo. En la fecha elegida capture el conteo desde **Levantamiento de inventario → Auditoría física** y descargue el reporte de diferencias y observaciones.
9. Mantenimiento: su administrador registra técnicos, asigna uno o varios, define horas y verifica el cierre. Cada técnico registra su intervención y fotografías.

Cuando ya no necesite los ejemplos, importe de forma opcional `database/disable_examples.sql`. El script no borra historia ni movimientos; solamente desactiva los registros cuyo código o nombre está identificado como ejemplo.

No elimine `api/config.local.php`, no vuelva a importar `database/schema.sql` para esta actualización y no cree un segundo administrador general.
