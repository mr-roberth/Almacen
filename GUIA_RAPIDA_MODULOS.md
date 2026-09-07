# Guía sencilla de módulos · Oleolab Almacenes 0.3.1

## Regla principal de acceso

Existe un solo **Administrador del sistema**. Es la única cuenta que puede abrir Administración y la bitácora global, crear usuarios, áreas y roles, y marcar con casillas los módulos de cada usuario. Un jefe de área administra la operación de su módulo, pero no crea cuentas ni puede entrar a la Administración global.

## Panel de mi área

Resume lo que requiere atención: existencias, materiales críticos, mayor consumo, faltantes del plan y cobertura del Forecast. El reporte ejecutivo descarga esas tablas a Excel. La información visible se limita a los módulos autorizados.

## Almacén de materia prima y aceites

Registra por nombre aguacate en fruta, aceite crudo, aceite para refinar y aceite listo para envasar. Las unidades permitidas son kilogramos o litros. Permite crear el catálogo, capturar inventario inicial, auditar, recibir una cita WID y consultar existencias por lote.

## Almacén de materiales de empaque

Registra por separado botella, tapa, sello, etiqueta frontal, etiqueta trasera, caja y cualquier otro empaque. Permite inventario inicial, auditoría, recepción WID y reporte analítico. No mezcla productos terminados, materias primas ni refacciones.

## Almacén de refacciones

Mantiene su propio catálogo, cantidades y auditorías. Puede recibir materiales esperados desde WID. Sus registros quedan disponibles para el seguimiento de Mantenimiento.

## Almacén de producto terminado

El código de cada producto debe coincidir exactamente con el usado en el Forecast. Una entrada selecciona la orden de producción; la orden ya conserva la lista de materiales aprobada. Al guardar se consumen aceite y empaques según esa lista, se suma la merma real indicada y se crea el lote terminado. Si requiere Calidad, el lote queda bloqueado hasta el dictamen.

## Inventarios y auditorías

**Inventario inicial** carga la existencia física actual sin proveedor ni cita y sólo se utiliza cuando todavía no existe saldo para ese producto, lote y ubicación. **Auditoría física** compara el sistema con el conteo y crea un ajuste trazable por la diferencia. Se pueden programar días y horarios y descargar un reporte con confiabilidad, diferencias, observaciones y responsable.

## Movimientos

Es el kardex de todas las entradas, salidas, consumos y ajustes autorizados. Un movimiento contabilizado no se edita ni se elimina; una corrección debe quedar como otro movimiento para conservar la historia.

## Compras y WID

Compras mantiene proveedores y orígenes y programa cada llegada con material, cantidad, almacén, fecha y hora. La cita genera un pre-lote y una partida WID, es decir, mercancía esperada. WID no suma existencia. Sólo Almacén convierte esa expectativa en recepción física.

## Calidad

Recibe automáticamente solicitudes por recepciones, producto terminado y extracción. La bandeja separa pendientes e historial. En un dictamen parcial, **cantidad liberada + cantidad rechazada** debe ser igual a la recibida o producida. La liberada pasa a una ubicación disponible y la rechazada a una ubicación bloqueada.

Para aguacate registra semana, fecha, cantidad, materias secas, dureza, rendimientos, ácidos grasos libres, estado, aceite extraído y acidez. Para extracción registra muestra de pulpa, pasta húmeda o pasta seca, turno, equipo, molienda, aceite, obtención, materia seca y humedad. El archivo Excel de Calidad contiene maestro de lotes, resultados de materia prima y resultados de extracción.

## Extracción

El usuario selecciona el lote real de aguacate, la cantidad alimentada, el número de contenedores y las horas. El sistema compara el ritmo contra la meta de 13 contenedores por hora, descuenta el lote de origen, genera el lote de proceso y solicita Calidad. El nuevo lote siempre conserva la relación con el lote de aguacate utilizado.

## Envasado

Crea y modifica listas de materiales por producto terminado. Cada componente se elige de catálogo y lleva cantidad y merma esperada. Al crear una orden, la aplicación compara la necesidad con las existencias disponibles y marca faltantes. La lista queda fijada en la orden para evitar consumir materiales de otra presentación.

## Forecast y necesidades de materiales

Forecast importa `.xlsx`, `.xls` o `.csv`, busca códigos de producto terminado y cantidades mensuales, conserva la primera versión como original y las siguientes como revisiones. El cálculo de necesidades explota las listas de materiales y muestra requerido, disponible, faltante y fecha. Un código que no existe en Producto terminado se reporta y no se importa silenciosamente.

## Mantenimiento

Cualquier usuario autorizado puede crear una solicitud con equipo, descripción, prioridad, fecha, materiales y fotografías opcionales. Se notifica por correo a los responsables configurados. El jefe o administrador de Mantenimiento registra como técnicos a usuarios existentes del área, asigna una o varias personas y horas estimadas. Cada técnico recibe correo y puede informar trabajo en proceso, espera de refacciones o término, horas, observaciones y fotografías. La jefatura verifica el cierre.

## Embarques, rechazos y devoluciones

Embarques es consulta y reporte de salidas ya registradas. Rechazos y devoluciones conserva cliente, producto, lote, cantidad, referencia y motivo para seguimiento sin borrar el movimiento original.

## Catálogos de ejemplo

Los nombres que comienzan con `[EJEMPLO]` sirven para practicar: almacenes, ubicaciones, proveedor, origen, cliente, aguacate, aceites, botellas, tapas, sellos, etiquetas, cajas, refacción, producto terminado, equipo y lista de materiales. No crean existencia ficticia. Después de validar el flujo pueden desactivarse con `database/disable_examples.sql`.
