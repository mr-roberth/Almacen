# Criterios de importación de listas de materiales

Fuente: `Materiales de empaque de productos terminados .xlsx`, hoja `Hoja 1`, filas 1 a 1521. SHA-256: `6E7FABE8A1109111020B6AE046E81643F716CFE5AFEFAADB726A410A3F187121`.

## Resultado

- 195 filas verdes se interpretan como productos terminados.
- 1,325 filas inferiores se relacionan con la última fila verde anterior.
- 432 claves únicas `CME` se clasifican como materiales de empaque en piezas.
- Cada producto recibe una lista `BOM-<código PT>` y una versión activa identificada por la fuente.
- Las claves existentes conservan su ID; por eso no se rompen movimientos ni inventarios relacionados.

## Normalización controlada

- Las filas de caja se convierten a consumo por pieza terminada usando la columna **Cantidad por pieza**.
- Los productos señalados en kilogramos usan consumo por kilogramo. Cuando el Excel omitió la división, el importador usa **Cantidad por caja / Piezas por caja**.
- `PT02015` se interpreta en kilogramos porque su factor de producto es `1 / 950`, aunque la celda de unidad dice pieza.
- Las variantes de nombre de `CME06289`, `CME07113` y `CME07114` se corrigieron; `CME07022` conserva el nombre mayoritario.
- Ocho claves con unidades mezcladas entre pieza y kilogramo se normalizan como pieza porque corresponden a cajas, tapas, sellos, botellas o tarimas.

## Alcance conocido

El archivo fuente sólo contiene componentes con clave `CME`. Por lo tanto, estas listas calculan materiales de empaque. Para calcular también aceite a granel u otra materia prima, el responsable de Envasado debe agregar ese componente a la lista correspondiente cuando se disponga del código y consumo oficial; la aplicación no inventa cantidades ausentes.
