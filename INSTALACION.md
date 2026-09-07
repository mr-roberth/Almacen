# Instalación inicial en CI4KASH / cPanel

Si la versión anterior ya funciona en `https://ci4kash.com/Apps/Almacen/`, siga `ACTUALIZACION_V0.4.md`; no repita la instalación inicial.

## 1. Preparar el sitio

En cPanel cree un subdominio con SSL, por ejemplo `almacen.ci4kash.com`, y apúntelo a una carpeta propia. No use la carpeta de la aplicación de Mantenimiento.

PHP requerido: 8.2 o superior con `pdo_mysql`, `mbstring` y `json`. El servidor mostrado (PHP 8.3.31 y MySQL 8.0.46) es compatible.

## 2. Importar la base

Seleccione la base correcta en phpMyAdmin e importe `database/schema.sql`. El archivo usa `CREATE TABLE IF NOT EXISTS`, por lo que puede volver a ejecutarse después de la importación que falló.

En cPanel confirme que el usuario MySQL de la aplicación tenga privilegios sobre esa base. No use la cuenta de cPanel como contraseña de la aplicación.

## 3. Subir la aplicación

Suba y extraiga todo el paquete dentro de la raíz del subdominio. Deben quedar juntos `index.html`, `app.js`, `styles.css`, `config.js`, `.htaccess`, `api/`, `assets/`, `database/` y `private-tools/`.

En el Administrador de archivos active **Mostrar archivos ocultos** para comprobar que los `.htaccess` también se cargaron. Use permisos `755` para carpetas, `644` para archivos y, si el hosting lo permite, `600` para `api/config.local.php`.

## 4. Configurar la conexión privada

Copie `api/config.example.php` como `api/config.local.php` y edite solamente la copia:

```php
'host' => 'localhost',
'name' => 'NOMBRE_REAL_DE_LA_BD',
'user' => 'USUARIO_REAL_DE_LA_BD',
'password' => 'CONTRASEÑA_REAL_DE_LA_BD',
'trusted_origin' => 'https://almacen.ci4kash.com',
```

Si publica en `https://ci4kash.com/almacen`, use `https://ci4kash.com` como `trusted_origin`. Nunca coloque la contraseña en `config.js`, GitHub o el chat.

## 5. Probar la API

Abra en el navegador:

```text
https://SU-DOMINIO/api/index.php?action=health
```

La respuesta correcta contiene `"status":"ok"` y `"database":"connected"`.

## 6. Crear el administrador único

Desde Terminal de cPanel, ubicado en la carpeta de la aplicación, ejecute:

```bash
php private-tools/create_admin.php admin@oleolab.mx "Administrador Oleolab"
```

Escriba una contraseña final y segura de al menos 12 caracteres cuando se solicite. El script se niega a crear un segundo superadministrador.

## 7. Validar antes del uso diario

1. Entre con el administrador y confirme que aparecen todos los módulos.
2. Importe también, en este orden, `database/migration_v1_3.sql`, `database/migration_v1_4.sql`, `database/migration_v1_5.sql` y `database/migration_v1_6.sql`.
3. Cargue unidades, almacenes, ubicaciones, proveedores/orígenes, clientes, productos, materiales y listas de materiales.
4. Registre el inventario inicial y un flujo de prueba completo: cita, recepción, pre-lote, solicitud de Calidad y movimiento.
5. Importe un Forecast de prueba y confirme que se generen las necesidades.
6. Verifique inventario, trazabilidad, Mantenimiento, correos y bitácora.
7. Cree usuarios por área y entregue sólo los módulos necesarios.
8. Active respaldos diarios de archivos y MySQL en cPanel.

Los módulos ya se eligen con casillas desde la aplicación. `ADMIN` y la bitácora global quedan reservados al administrador del sistema.

No se debe operar con datos reales hasta completar esta validación y confirmar que los catálogos visibles corresponden a los autorizados.
