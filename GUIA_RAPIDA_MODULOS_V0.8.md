# Guía sencilla de módulos · versión 0.8

## Panel de mi área

Resume existencias, materiales críticos, consumo y cumplimiento del Forecast según los permisos del usuario.

## Administración

Exclusivo del Administrador del sistema. Crea áreas, roles y usuarios; las casillas determinan qué ventanas puede abrir cada persona. También muestra las observaciones detectadas al validar los catálogos y permite cerrar o reabrir la captura de inventario inicial.

## Materia prima y aceites

Consulta aguacate en kilogramos y aceites en litros. Muestra por separado existencia disponible, WID pendiente de Calidad, rechazado y total físico.

## Materiales de empaque

Usa el catálogo oficial CME: botellas, tapas, sellos, etiquetas, cajas y demás materiales con su propia unidad. Permite capturar existencias sin crear artículos duplicados.

## Producto terminado

Consulta el catálogo oficial PT y sus existencias. La entrada normal se registra contra una orden de producción y queda primero en WID hasta el dictamen de Calidad.

## Inventarios y auditorías

El modo **Inventario inicial** carga los saldos de apertura sin cita. El Administrador puede cerrarlo por almacén. El modo **Auditoría física** compara sistema contra conteo, registra el ajuste y genera el reporte de diferencias con observaciones.

## Entradas y salidas

Es el kardex y la captura diaria. El usuario sólo selecciona **Entrada** o **Salida**, el producto o lote y la cantidad; la aplicación asigna almacén, ubicación y unidad sin pedir códigos técnicos.

- Una entrada de materia prima o empaque pasa automáticamente a **Pendiente de Calidad (WID)** y genera la solicitud para Calidad.
- Una salida sólo permite elegir lotes liberados y valida que la cantidad no exceda la existencia disponible.
- La entrada normal de producto terminado se hace desde **Órdenes de producción** para descontar la lista correcta. Su saldo de apertura se captura una sola vez desde **Inventarios y auditorías**.
- Los movimientos contabilizados no se editan. Una corrección se registra por auditoría o mediante otro movimiento trazable.

## Compras y recepciones

Programa entregas o recolecciones. La mercancía esperada no aumenta inventario. Almacén confirma la llegada, se genera WID y Calidad recibe la solicitud automática.

## Calidad

Revisa solicitudes pendientes y libera, libera parcialmente o rechaza. Sólo la cantidad liberada pasa a disponible; el resto queda separado y trazable.

## Órdenes de producción

Selecciona producto y cantidad. La aplicación toma automáticamente la versión vigente de empaque y formulación, avisa faltantes y, al terminar, descuenta aceites y materiales reales.

## Forecast semanal

El Forecast es único y versionado. Cada importación conserva la anterior. Las cantidades mensuales se reparten por días laborables de cada semana y se comparan con las órdenes reales.

## Necesidades semanales

Calcula por material: existencia disponible al inicio, llegadas planeadas, consumo de la semana, saldo proyectado y faltante. El saldo final pasa a la siguiente semana.

## Listas y formulaciones

El empaque oficial ya está vinculado por producto. Aquí se confirma la formulación de aceite y se pueden cambiar componentes con fecha de vigencia. Las órdenes anteriores conservan la versión usada al crearse.

## Llegadas planeadas

Registra material confirmado para una semana futura. Ayuda a proyectar cobertura, pero no lo vuelve disponible: el inventario sólo cambia después de la recepción y Calidad.
