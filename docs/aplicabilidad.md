# Aplicabilidad de las normativas

Estado: **borrador para revisar** (contenido normativo) · 04/10/2026.
Referencia: manual de Práctica 3, §4.4 (tarea 10). Implementación:
`backend/services/aplicabilidad.js`; endpoint `GET /normativas/aplicables`; pruebas en
`backend/tests/aplicabilidad.test.js`.

> **Orientativo, no es asesoramiento jurídico.** El perfil de la organización solo recoge
> **sector** y **tamaño**, así que la herramienta orienta y explica el motivo; no decide por la
> organización. Muchas obligaciones dependen de la actividad concreta (vender en línea, fabricar
> productos con software, usar IA), que el perfil no pregunta.

## Estados

| Estado | Significado |
|---|---|
| `aplica` | Con el perfil indicado, la normativa aplica. |
| `puede_aplicar` | Depende de algo que el perfil no recoge (actividad, rol); el motivo dice de qué. |
| `no_aplica` | Con el perfil indicado, la normativa no va dirigida a la organización. |
| `voluntaria` | Marco o certificación de adopción voluntaria. |
| `perfil_incompleto` | Falta un dato del perfil necesario para decidir; `faltan` indica cuál. **Nunca** se muestra "no aplica" por falta de datos. |

Cada resultado incluye un `motivo` legible. Si la normativa tiene `fecha_aplicabilidad_general`
futura y no es `no_aplica`, se añade `aplicable_desde` (p. ej. CRA, 11/12/2027).

## Reglas

Perfil: `sector` ∈ {publica, sanitaria, energia, transporte, financiero, educacion, privada, otro};
`tamano` ∈ {micro, pequena, mediana, grande}.

| Normativa | Regla | Datos que necesita |
|---|---|---|
| RGPD | `aplica` a toda organización que trata datos personales | — |
| LOPDPyGDD | `aplica` (desarrolla el RGPD en España) | — |
| ISO/IEC 27001 | `voluntaria` | — |
| ISO/IEC 27002 | `voluntaria` | — |
| Cybersecurity Act | `voluntaria` (certificación) | — |
| ENS | `publica` → `aplica`; resto → `puede_aplicar` (si presta servicios al sector público) | sector |
| ENI | `publica` → `aplica`; resto → `no_aplica` | sector |
| NIS2 | `publica` → `aplica` (cualquier tamaño); energia/transporte/sanitaria/financiero → `aplica` si mediana o grande, `puede_aplicar` si micro o pequeña; resto → `puede_aplicar` (otros sectores de los anexos) | sector; tamaño solo en los cuatro sectores con umbral |
| LSSI-CE | `puede_aplicar` (si ofrece servicios de la sociedad de la información) | — |
| CRA | `puede_aplicar` (si fabrica, importa o distribuye productos con elementos digitales) | — |
| Reglamento de IA | `puede_aplicar` (si desarrolla, despliega, importa o distribuye sistemas de IA) | — |
| Normativa sin regla | `puede_aplicar`, con motivo "sin regla definida" | — |

El campo `sectores_aplicables` de los JSON **no se usa** para decidir: describe roles o tipos de
entidad (responsable/encargado, fabricante, esencial/importante…) con otro vocabulario que el
sector del perfil.

## Casos de prueba

Cada fila es una prueba automática. Fecha de referencia para `aplicable_desde`: 04/10/2026.

| # | sector | tamano | Normativa | Estado esperado | Detalle |
|---|---|---|---|---|---|
| 1 | — | — | RGPD | aplica | |
| 2 | — | — | ISO/IEC 27001 | voluntaria | |
| 3 | — | — | ENS | perfil_incompleto | faltan: sector |
| 4 | — | — | ENI | perfil_incompleto | faltan: sector |
| 5 | — | — | NIS2 | perfil_incompleto | faltan: sector |
| 6 | — | — | CRA | puede_aplicar | aplicable_desde 2027-12-11 |
| 7 | publica | — | NIS2 | aplica | sin tamaño |
| 8 | publica | — | ENS | aplica | |
| 9 | publica | — | ENI | aplica | |
| 10 | energia | — | NIS2 | perfil_incompleto | faltan: tamano |
| 11 | energia | grande | NIS2 | aplica | |
| 12 | sanitaria | mediana | NIS2 | aplica | |
| 13 | transporte | pequena | NIS2 | puede_aplicar | |
| 14 | financiero | micro | NIS2 | puede_aplicar | |
| 15 | privada | grande | NIS2 | puede_aplicar | |
| 16 | educacion | mediana | NIS2 | puede_aplicar | |
| 17 | privada | mediana | ENS | puede_aplicar | |
| 18 | privada | mediana | ENI | no_aplica | |
| 19 | otro | micro | LSSI-CE | puede_aplicar | |
| 20 | otro | micro | Cybersecurity Act | voluntaria | |

## Pendiente de revisar

- [ ] Que NIS2 cubra a toda la administración pública sin umbral de tamaño (la directiva lo fija
      para la administración central; la transposición española puede ampliarlo o acotarlo).
- [ ] Que ENS sea `puede_aplicar` (y no `no_aplica`) para el sector privado.
- [ ] Motivos: redacción final de cada texto.
