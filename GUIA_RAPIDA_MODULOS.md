# Guía rápida de actualización y uso · Oleolab Almacenes 0.2

## Aplicar la actualización en el ambiente actual de pruebas

1. En phpMyAdmin, exporte un respaldo completo de `ci4kash_Oleolab` antes de modificarla.
2. Manteniendo seleccionada esa misma base, abra **Importar** y cargue `database/migration_v1_3.sql`. No vuelva a importar `database/schema.sql`.
3. En el Administrador de archivos abra `public_html/Apps/Almacen`.
4. Descargue o copie a un lugar seguro `api/config.local.php`. No debe eliminarse ni reemplazarse.
5. Conserve también la carpeta `storage`, porque ahí se guardan las evidencias privadas de Mantenimiento.
6. Cargue `oleolab-almacen-cpanel-v0.2.0.zip` en `public_html/Apps/Almacen`, extráigalo y acepte reemplazar los archivos de la aplicación.
7. Confirme permisos `755` para carpetas, `644` para archivos y `750` o `755` para `storage/private/maintenance`.
8. Abra `https://ci4kash.com/Apps/Almacen/api/index.php?action=health`. Debe indicar `"status":"ok"` y `"database":"connected"`.
9. Abra `https://ci4kash.com/Apps/Almacen/`, cierre cualquier sesión anterior, presione `Ctrl+F5` y vuelva a iniciar sesión.

## Orden sencillo para empezar a usarla

1. En **Catálogos de mi área**, revise los registros `[EJEMPLO]` y capture sus productos y materiales reales.
2. Cree los almacenes y ubicaciones reales antes de capturar cantidades.
3. En **Levantamiento de inventario**, registre las existencias físicas iniciales. No necesita una cita de proveedor.
4. En **Historial de auditorías**, programe los días de conteo; el día elegido haga la captura desde **Levantamiento de inventario → Auditoría física**.
5. Registre la lista de materiales de cada producto terminado.
6. Importe el archivo de Forecast y revise las necesidades calculadas.
7. Cree usuarios, administradores de área y técnicos de Mantenimiento con únicamente los módulos que necesiten.

## Qué se encuentra en cada módulo

### Panel de mi área

Muestra indicadores correspondientes al área del usuario. Para Almacenes incluye existencias, materiales críticos, artículos con mayor salida, faltantes contra el plan y cobertura del Forecast. Permite descargar un reporte ejecutivo en Excel.

### Planeación de Compras

Muestra próximas llegadas, citas por confirmar, retrasos y materiales que deben comprarse según el último cálculo de necesidades. Desde aquí se puede programar una llegada.

### Citas y andenes

Permite registrar y consultar citas de proveedores, recolecciones de fruta y devoluciones. Muestra fecha, hora, proveedor, material y estado.

### Recepciones

Registra la llegada del proveedor, peso esperado y recibido, almacén y ubicación. Genera el pre-lote, el lote, la recepción, el movimiento de entrada y la solicitud de Calidad.

### Calidad

Muestra las solicitudes pendientes y permite registrar inspecciones y dictámenes: aprobado, condicionado o rechazado. El material que requiere Calidad permanece bloqueado hasta recibir su dictamen.

### Existencias

Consulta inventario por nombre, código, almacén y lote. Separa existencia, cantidad reservada y cantidad disponible. Permite descargar el inventario analítico.

### Movimientos

Es el kardex del inventario. Muestra entradas, salidas, transferencias, consumo, ajustes, usuario y ubicación. Los movimientos contabilizados no se editan directamente; las correcciones deben quedar como movimientos trazables.

### Levantamiento de inventario

Tiene dos formas de captura:

- **Inventario inicial:** incorpora las existencias físicas actuales sin necesitar proveedor o cita.
- **Auditoría física:** compara la cantidad del sistema contra la cantidad contada y genera un ajuste cuando existe diferencia.

Cada partida permite indicar almacén, ubicación, producto o material, lote, estado de Calidad, cantidad y observaciones.

### Historial de auditorías

Permite programar conteos por almacén, días de la semana, hora, tipo y alcance. Muestra la confiabilidad porcentual, partidas correctas, diferencias y observaciones. El reporte Excel incluye sistema, conteo físico, diferencia, responsable y explicación.

### Forecast

Importa un archivo Excel y valida que cada código coincida con un producto terminado activo. La primera carga se conserva como Forecast original y las posteriores como revisiones. Muestra original, vigente, diferencia e impacto.

### MRP y necesidades

Explota las listas de materiales del producto terminado y compara lo necesario contra existencias, reservas y niveles mínimos. Indica material, cantidad requerida, disponible, faltante, fecha y acción sugerida. Se recalcula al cambiar Forecast, listas de materiales o inventario.

### Órdenes de producción

Consulta las órdenes registradas en la base, cantidades planeadas y terminadas, cliente, ventana de producción, disponibilidad de materiales y situación de cumplimiento.

### Lotes y extracción

Busca un lote exacto y presenta su origen, proveedor, Calidad y relaciones de transformación. Permite seguir lotes padres e hijos para conservar la trazabilidad de extracción y envasado.

### Embarques

Consulta surtido, pedido, cliente, cita, bultos y estado del embarque. La programación operativa completa de salidas se continuará conectando con las órdenes y citas de Logística.

### Rechazos y devoluciones

Registra devoluciones de cliente indicando producto, lote, cantidad, referencia y motivo. Conserva el seguimiento y permite relacionar posteriormente el dictamen de Calidad.

### Mantenimiento

Permite levantar solicitudes, indicar equipo, ubicación, prioridad, fecha, materiales requeridos y descripción. El responsable de Mantenimiento puede asignar varios técnicos y horas. Los técnicos registran avance, horas, observaciones y fotografías.

### Catálogos de mi área

Presenta ventanas separadas según el área. Almacenes registra materias primas y aceites, materiales de empaque, refacciones, producto terminado, almacenes, ubicaciones y listas de materiales. Compras registra proveedores y orígenes. Ventas registra clientes. Mantenimiento registra técnicos.

Los registros `[EJEMPLO]` son una guía y no crean cantidades de inventario. Cuando dejen de ser necesarios, se pueden desactivar importando opcionalmente `database/disable_examples.sql`.

### Usuarios de mi área

El administrador general crea áreas, roles, administradores de área y usuarios. Los módulos se asignan con casillas. Un administrador de área solamente administra a los usuarios de su propia área. Mantenimiento puede registrar técnicos con acceso a sus tareas.

### Bitácora del sistema

Disponible para el administrador general. Registra quién realizó cada cambio, fecha, área, acción, entidad y referencia. Sirve para investigar correcciones y proteger la integridad de la información.

## Recomendación para las pruebas

Use prefijos como `PRUEBA-` en productos, lotes y proveedores mientras valida el funcionamiento. Debido a que ésta es la base de pruebas, las capturas sí modificarán sus existencias de prueba, movimientos, auditorías y necesidades, pero no afectarán otra base ni otro servicio.
