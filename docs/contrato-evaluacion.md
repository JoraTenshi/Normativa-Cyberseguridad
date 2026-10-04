# Contrato de evaluación (algoritmo v2)

Estado: **acordado** (30/09/2026) — decisiones en §6.
Referencia: manual de Práctica 3, §4.1–4.3. Implementación: `backend/utils/scoring.js`,
`backend/validation/validarRespuestas.js`, tests en `backend/tests/scoring.test.js`.

> El resultado es un **índice de autoevaluación** basado en respuestas declaradas.
> No es una certificación ni una verificación de evidencias. `cobertura_estimada`
> es una proyección temática, no otra evaluación.

## 1. Entrada

`POST /resultado` con `{ normativa, respuestas: [{ pregunta_id, valor }] }` (`normativa` es el
`id` de la normativa, p. ej. `"nis2"`).

| Regla | Si no se cumple |
|---|---|
| `respuestas` es un array de objetos | 400 `RESPUESTA_INVALIDA` |
| `pregunta_id` es string y pertenece a la normativa (preguntas elegibles) | 400 `RESPUESTA_INVALIDA` |
| Cada `pregunta_id` aparece una sola vez | 400 `RESPUESTA_DUPLICADA` |
| `valor` ∈ {0, 0.5, 1} (número, no string) | 400 `RESPUESTA_INVALIDA` |
| Se responden **todas** las preguntas elegibles | 400 `CUESTIONARIO_INCOMPLETO` + lista `faltan` |

Con cualquier 400 **no se crea** ningún `Resultado`. La validación ocurre tras cargar la
normativa y antes de calcular.

Significado de los valores: 1 = Sí, 0.5 = Parcial, 0 = No. No existen hoy los estados
`desconocido`, `no_evaluado` ni `no_aplica` (ver §6).

## 2. Fórmula

1. **Por bloque:** `porcentaje_bloque = 100 × Σ(valor × peso_pregunta) / Σ(peso_pregunta)`.
2. **Global:** media de los porcentajes de bloque ponderada por `peso_bloque`:
   `índice = Σ(porcentaje_bloque × peso_bloque) / Σ(peso_bloque de bloques evaluables)`.
3. Un bloque es **evaluable** si tiene preguntas y `peso_bloque > 0`. Los no evaluables se
   excluyen y el denominador se reparte entre los activos. Un bloque sin preguntas no llega a
   publicarse (el esquema exige `minItems: 1`); la exclusión es solo una red de seguridad.
4. Si no queda ningún bloque evaluable: `sin_base_evaluable: true`, `porcentaje: null`,
   `nivel: null`. **Nunca** se devuelve 0 % en ese caso.
5. Catálogo con `peso_bloque` negativo/no numérico o `peso` de pregunta ≤ 0: error interno
   `CATALOGO_INVALIDO` (es un fallo de publicación del catálogo, no del usuario). Las 11
   normativas actuales cumplen estas reglas (lo comprueba un test).

### Ejemplo de referencia (el que hay que validar a mano)

| Bloque | peso_bloque | Preguntas (peso) | Respuestas | % bloque |
|---|---|---|---|---|
| A | 80 | a1 (1) | Sí | 100 |
| B | 20 | b1 (1), b2 (1), b3 (2) | No, No, No | 0 |

Índice = (100 × 80 + 0 × 20) / 100 = **80 %**, aunque B tenga más preguntas.
Con la fórmula anterior (suma de pesos de pregunta) daría 1/5 = 20 %.

Segundo caso: A = Parcial; B = Parcial, Sí, No → A = 50 %, B = (0.5 + 1 + 0) / 4 = 37,5 %,
índice = 0,8 × 50 + 0,2 × 37,5 = **47,5 %** → se muestra **48 %**.

## 3. Redondeo y nivel

- Se calcula y guarda `porcentaje_exacto` (sin redondear).
- `porcentaje = Math.round(porcentaje_exacto)` solo para mostrar.
- El nivel se decide con el **valor exacto**: 29,5 → Crítico aunque se muestre 30.

| Nivel | Rango exacto |
|---|---|
| Crítico | < 30 |
| Bajo | ≥ 30 y < 60 |
| Medio | ≥ 60 y < 85 |
| Alto | ≥ 85 |

Umbrales y nombres iguales a los que ya usaba la aplicación; lo único que cambia es que se
aplican al valor exacto en vez de al redondeado.

## 4. Salida (DTO)

Respuesta `201` de `POST /resultado` (`data`):

```json
{
  "id": "…",
  "normativa": "lssi_ce",
  "normativa_nombre": "…",
  "algoritmo_version": "2",
  "sin_base_evaluable": false,
  "porcentaje_exacto": 47.5,
  "porcentaje": 48,
  "nivel": "Bajo",
  "mensaje": "Índice de autoevaluación bajo: …",
  "puntuaciones_bloques": [
    { "bloque_id": "A", "nombre": "Bloque A", "peso_bloque": 80, "evaluable": true,
      "puntuacion": 0.5, "max_puntuacion": 1, "porcentaje_exacto": 50, "porcentaje": 50 }
  ],
  "remediaciones": [],
  "cobertura_estimada": []
}
```

- `id` es `null` si no hay sesión (el resultado no se guarda).
- El desglose por bloque se llama `puntuaciones_bloques` (no `bloques`): `GET /me/historial/:id`
  ya usa `bloques` para las definiciones de la normativa.
- `puntuacion_total` / `puntuacion_maxima` **se retiran** de la respuesta, del modelo y del
  historial: son puntos brutos que ya no explican el porcentaje global.
- El `Resultado` guarda `algoritmo_version`, `porcentaje_exacto`, `porcentaje`, `nivel` y
  `puntuaciones_bloques`. El historial (`GET /me/historial`, `/me/historial/:id`) y el Plan
  Director devuelven el `nivel` **guardado**, y el frontend lo muestra tal cual en lugar de
  recalcularlo a partir del porcentaje redondeado.

## 5. Versionado

Cada `Resultado` guarda `algoritmo_version`. La aplicación no está desplegada, así que no
existen resultados v1 que conservar: la próxima instalación parte de una base de datos vacía.
El campo sirve para que, si el algoritmo cambia más adelante, los resultados guardados sigan
mostrando las cifras con las que se calcularon.

## 6. Decisiones (30/09/2026)

- [x] **Fórmula:** media de bloques ponderada por `peso_bloque` (§2). Es el peso que declara
      cada JSON y que el validador obliga a sumar 100.
- [x] **Bloque sin preguntas:** no se puede publicar; lo rechaza `validate_normativa.py` por
      esquema (`minItems: 1`). En ejecución se excluye y se renormaliza como red de seguridad.
- [x] **DTO:** se retiran `puntuacion_total` / `puntuacion_maxima`; se muestran el índice y el
      desglose por bloque (§4).
- [x] **Lenguaje:** "índice de autoevaluación" en lugar de "cumplimiento" en API y pantalla.
- [x] **Estado "desconocido":** no se añade en esta entrega (cambiaría fórmula, pantalla y
      remediaciones). Se reconsidera después de la Práctica 3.
