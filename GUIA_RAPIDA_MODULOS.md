# Guía sencilla de módulos · Oleolab Almacenes 0.5.0

## Regla principal de acceso

Existe un solo **Administrador del sistema**. Es la única cuenta que puede abrir Administración y la bitácora global, crear o modificar usuarios, registrar su teléfono, área, rol, estado y módulos mediante casillas, y restablecer su contraseña. Un jefe de área administra la operación de su módulo, pero no crea cuentas ni puede entrar a la Administración global.

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

Compras mantiene proveedores y orígenes. **Recolección de materia prima** permite únicamente aguacate, aceite crudo, aceite refinado u otra materia prima autorizada; al guardar genera semana, fecha de solicitud, recolección, cita, prefolio y WID. **Entrega de empaque o refacción** usa únicamente esos catálogos y crea WID sin solicitar transporte de Logística. WID significa mercancía esperada y todavía no suma existencia.

## Logística y conductor

El coordinador registra unidades y asigna vehículo, conductor, presentación, contenedores y horario a las recolecciones de materia prima creadas por Compras. El conductor tiene una ventana distinta, ve sólo sus recolecciones y marca **Unidad cargada**, **Iniciar recorrido**, **Actualizar ubicación** y **Llegué a planta**. Al iniciar y llegar se avisa a los responsables de Almacén.

El navegador pide permiso de ubicación únicamente al conductor. Si lo autoriza, la aplicación registra la ubicación más reciente, estima distancia y tiempo a planta y ofrece abrir la ruta. La ubicación no se obtiene en segundo plano cuando la página está cerrada.

## Calidad

Recibe automáticamente solicitudes por recepciones, producto terminado y extracción. La bandeja separa pendientes e historial. En un dictamen parcial, **cantidad liberada + cantidad rechazada** debe ser igual a la recibida o producida. La liberada pasa a una ubicación disponible y la rechazada a una ubicación bloqueada.

Para aguacate registra semana, fecha, cantidad, materias secas, dureza, rendimientos, ácidos grasos libres, estado, aceite extraído y acidez. Para extracción registra muestra de pulpa, pasta húmeda o pasta seca, turno, equipo, molienda, aceite, obtención, materia seca y humedad. El archivo Excel de Calidad contiene maestro de lotes, resultados de materia prima y resultados de extracción.

## Extracción

El usuario selecciona el lote real de aguacate, la cantidad alimentada, el número de contenedores y las horas. El sistema compara el ritmo contra la meta de 13 contenedores por hora, descuenta el lote de origen, genera el lote de proceso y solicita Calidad. El nuevo lote siempre conserva la relación con el lote de aguacate utilizado.

## Envasado

Crea y modifica listas de materiales por producto terminado. La aplicación incorpora 195 listas autorizadas desde el archivo maestro; cada componente se elige de catálogo y lleva cantidad y merma esperada. Al crear una orden, la aplicación muestra inmediatamente lo necesario, disponible y faltante, y vuelve a validarlo al guardar. La lista queda fijada en la orden para evitar consumir materiales de otra presentación.

## Forecast y necesidades de materiales

Forecast importa `.xlsx`, `.xls` o `.csv`, busca códigos de producto terminado y cantidades mensuales, conserva la primera versión como original y las siguientes como revisiones. También compara cada mes del Forecast único contra las órdenes reales de Envasado y lo ya terminado. El cálculo de necesidades explota las listas de materiales y muestra requerido, disponible, faltante y fecha; también puede ejecutarse manualmente con **Recalcular necesidades**. Un código que no existe en Producto terminado se reporta y no se importa silenciosamente.

## Mantenimiento

Cualquier usuario autorizado puede crear una solicitud con equipo, descripción, prioridad, fecha, materiales y fotografías opcionales. Se notifica por correo a los responsables configurados. El jefe o administrador de Mantenimiento registra como técnicos a usuarios existentes del área, asigna una o varias personas y horas estimadas. Cada técnico recibe correo y puede informar trabajo en proceso, espera de refacciones o término, horas, observaciones y fotografías. La jefatura verifica el cierre.

## Embarques, rechazos y devoluciones

Embarques es consulta y reporte de salidas ya registradas. Rechazos y devoluciones conserva cliente, producto, lote, cantidad, referencia y motivo para seguimiento sin borrar el movimiento original.

## Almacenes, ubicaciones y catálogos

Los almacenes y sus ubicaciones técnicas ya están configurados y no se crean durante la captura diaria. **Existencia disponible** contiene material liberado; **Recepción temporal** contiene mercancía recién llegada; **Pendiente de liberación por Calidad** mantiene producto bloqueado; y **Producto rechazado** nunca forma parte de la existencia utilizable. La aplicación filtra y propone la ubicación correcta para conservar trazabilidad sin pedir datos técnicos innecesarios.

El catálogo oficial de materiales de empaque se usa directamente para **Capturar existencias actuales**. Los nombres de botellas, tapas, sellos, etiquetas y cajas sólo aparecen como sugerencias al dar de alta un artículo que realmente no existe. Materia prima, empaque, refacciones y producto terminado nunca se mezclan; esta regla se valida tanto en pantalla como en el servidor.
