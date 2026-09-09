# Actualización 0.8 · núcleo de inventarios y planeación

Esta actualización es acumulativa. No borra usuarios, movimientos, existencias, lotes, órdenes ni evidencias anteriores.

## Antes de comenzar

1. En cPanel descargue un respaldo de la carpeta `public_html/Apps/Almacen`.
2. En phpMyAdmin exporte la base `ci4kash_Oleolab` completa en formato SQL.
3. Compruebe que la aplicación actual todavía abre y que `api/index.php?action=health` indica `database: connected`.

## Aplicar la actualización

1. En el Administrador de archivos cargue `oleolab-almacen-cpanel-v0.8.0.zip` dentro de `public_html/Apps/Almacen`.
2. Extraiga el ZIP en esa misma carpeta y acepte reemplazar los archivos de la aplicación.
3. No reemplace ni elimine `api/config.local.php`; el paquete no contiene ese archivo.
4. El ZIP de actualización no vuelve a incluir `assets/xlsx.full.min.js`, porque esa biblioteca minificada provocó la alerta falsa del antivirus de cPanel. No borre el archivo que ya existe en el servidor.
5. En phpMyAdmin seleccione primero la base `ci4kash_Oleolab` en la columna izquierda y abra la tabla `schema_migrations`.
6. Si no aparece la versión `007`, importe primero `database/migration_v1_7.sql`. Si ya aparece, no la repita.
7. Abra **Importar** y ejecute `database/migration_v1_8.sql` una sola vez.
8. El resultado final debe mostrar: 135 productos terminados, 432 materiales de empaque, 12 formulaciones, 1,067 registros mensuales y 3,777 registros semanales.
9. Abra `https://ci4kash.com/Apps/Almacen/api/index.php?action=health` y confirme `status: ok` y `database: connected`.
10. Abra la aplicación y presione `Ctrl + F5` para limpiar los archivos anteriores del navegador.

## Primera configuración dentro de la aplicación

1. Entre con la cuenta **Administrador del sistema**.
2. Abra **Listas y formulaciones**. El empaque de los 135 productos ya está cargado.
3. Asigne a cada producto su formulación de aceite. Los archivos recibidos no contenían esta relación y por seguridad no se inventó.
4. Abra cada almacén y use **Capturar existencias actuales** para registrar el saldo físico inicial.
5. Cuando un almacén quede terminado, vaya a **Inventarios y auditorías** y pulse **Cerrar** para ese almacén. Desde entonces sus correcciones se harán mediante auditoría.
6. Registre en **Llegadas planeadas** los materiales ya confirmados para semanas futuras.
7. Revise **Necesidades semanales**: muestra saldo inicial, llegadas, consumo del Forecast y saldo proyectado.
8. En **Administración**, revise **Revisión de los catálogos importados**. Quedaron documentadas 52 observaciones; entre ellas, 28 claves del Forecast que no existen en el catálogo oficial y por eso no se importaron. No se crearon claves ficticias.

## Prueba mínima recomendada

1. Capture un aceite en litros, un material de empaque en su unidad y un producto terminado en piezas.
2. Use **Registrar entrada o salida** en Materia prima o Materiales de empaque. Confirme que la entrada aparezca en WID, que se cree la solicitud de Calidad y que aún no aumente el disponible.
3. Desde Calidad libere la cantidad. Confirme que desaparezca de WID y pase a disponible.
4. Registre una salida menor al disponible y compruebe el descuento. Pruebe una cantidad mayor: el servidor debe impedir existencias negativas.
5. Asigne formulación a un producto y cree una orden. Revise que muestre aceite y empaque necesarios.
6. Registre producto terminado. Debe consumir los materiales y crear automáticamente su WID de Calidad.
7. Ejecute una auditoría física y descargue el reporte de diferencias.

Si algo falla, no vuelva a importar todo el esquema. Conserve la captura del mensaje, la hora y el paso exacto; restaure el respaldo sólo si hubo una modificación parcial comprobada.
