# Actualización 0.5.0 · Compras, Logística y catálogos separados

Esta actualización conserva usuarios, existencias, catálogos, listas de materiales y configuración privada de la base.

## Pasos en cPanel

1. En phpMyAdmin seleccione primero la base `ci4kash_Oleolab` en la columna izquierda.
2. Importe `database/migration_v1_7.sql`. El resultado final debe indicar 2 módulos, 2 roles y 2 tablas de Logística.
3. En el Administrador de archivos abra `public_html/Apps/Almacen`.
4. Cargue `oleolab-almacen-cpanel-v0.5.0-actualizacion.zip` y elija **Extraer** en esa misma carpeta. Confirme reemplazar archivos.
5. No elimine ni reemplace `api/config.local.php`. El paquete no contiene ese archivo.
   El paquete de actualización tampoco vuelve a incluir el lector de Excel minificado que cPanel marcó anteriormente; conserva el que ya está instalado.
6. Confirme permisos: carpetas `755`, archivos `644` y `api/config.local.php` `600` si el hosting lo admite.
7. Abra `https://ci4kash.com/Apps/Almacen/api/index.php?action=health`. Debe responder `"status":"ok"` y `"database":"connected"`.
8. Abra la aplicación y presione `Ctrl+F5` para descartar archivos anteriores del navegador.

## Configuración única como Administrador del sistema

1. Cree o edite un usuario del área **Logística y Tráfico**, rol **Coordinador de Logística y Tráfico**, y marque **Coordinación de Logística y Tráfico**.
2. Cree cada conductor en la misma área, rol **Conductor u operador**, y marque únicamente **Mis recolecciones asignadas**.
3. Entre como coordinador, abra **Logística y Tráfico** y configure una vez el destino en planta con dirección, latitud y longitud.
4. Registre por lo menos una unidad y asígnele un conductor habitual si aplica.
5. Verifique en cPanel que el envío de correos de la aplicación esté configurado como en la versión anterior.

## Prueba rápida recomendada

1. En Compras registre proveedor y origen con dirección.
2. Cree una **Recolección de materia prima** con una cantidad decimal válida. Compruebe que aparezcan recolección, cita, prefolio y WID.
3. Entre como coordinador de Logística, asigne unidad, conductor y contenedores.
4. Entre como conductor desde un teléfono con HTTPS, marque carga e inicie recorrido. Autorice la ubicación cuando el navegador la solicite.
5. Entre como Almacén, confirme la recepción WID. Compruebe que la existencia quede bloqueada y que Calidad reciba la solicitud.
6. Entre como Calidad, libere o rechace. Confirme que sólo la cantidad liberada quede disponible.
7. Repita con **Entrega de empaque o refacción**; esta ruta no debe crear una tarea de conductor.
8. En cada almacén use **Capturar existencias actuales** y confirme que el selector sólo muestre materiales de ese módulo y su unidad base.

## Importante

- El archivo maestro importado anteriormente contiene productos terminados y componentes de empaque. Los aceites crudos/refinados deben existir en el catálogo de Materia prima y vincularse explícitamente a la lista de materiales que los consuma; la aplicación no inventa esa equivalencia.
- La ubicación del conductor requiere autorización del navegador y sólo se captura al pulsar un botón de avance. El cálculo de ruta usa un servicio cartográfico externo; si no responde, el avance se guarda de todas formas sin estimación.
- GitHub conserva el código, pero no ejecuta PHP ni se conecta directamente a MySQL. La prueba funcional se realiza en el servidor de cPanel.
