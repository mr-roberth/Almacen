# Actualización 0.4.0 · listas de materiales y usuarios

Esta actualización es acumulativa y conserva los usuarios, contraseñas, inventarios, lotes, movimientos, auditorías y configuraciones ya existentes.

## Orden exacto de instalación

1. En cPanel abra **phpMyAdmin** y seleccione la base de datos `ci4kash_Oleolab` en la columna izquierda.
2. Como respaldo, use **Exportar**, método rápido y formato SQL.
3. Sin salir de esa base, abra **Importar** y cargue `database/migration_v1_6.sql`.
4. Al terminar deben aparecer estos resultados: 195 productos terminados, 432 materiales de empaque, 1,325 componentes y 195 listas activas.
5. En el Administrador de archivos abra `public_html/Apps/Almacen`.
6. Cargue `oleolab-almacen-cpanel-v0.4.0.zip` y elija **Extraer** dentro de esa misma carpeta. Confirme reemplazar los archivos existentes.
7. No borre ni sustituya `api/config.local.php`. Ese archivo conserva la conexión privada con MySQL.
8. Abra la aplicación y presione `Ctrl + F5` para evitar que el navegador use archivos anteriores.

## Prueba rápida

1. Ingrese con el Administrador del sistema.
2. Abra **Administración** y use **Configurar** en un usuario. Compruebe teléfono, área, rol, estado y módulos.
3. Abra **Envasado**. En la tabla inferior deben verse las listas `BOM-PT...`.
4. Presione **Nueva orden**, seleccione una lista y escriba una cantidad. La ventana mostrará necesario, disponible y faltante por material antes de guardar.
5. Abra **Necesidades de materiales** y presione **Recalcular necesidades** para aplicar las listas al Forecast vigente.
6. Abra **Inventarios y auditorías**. Para existencia actual liberada elija **Existencia disponible**. La recepción temporal se usa únicamente para mercancía nueva que todavía espera revisión.

## Reversión segura

Si hubiera un problema de interfaz, restaure los archivos de la versión anterior. No elimine tablas ni usuarios. La migración conserva versiones anteriores de las listas como `OBSOLETE`; las órdenes históricas continúan enlazadas a la versión que utilizaron.
