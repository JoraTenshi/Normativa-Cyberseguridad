# Estado del Backend

## Lo que hace el backend actualmente

### Autenticación — `/auth`
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/auth/register` | Registro con nombre, email y contraseña |
| POST | `/auth/login` | Login, devuelve cookie httpOnly |
| POST | `/auth/logout` | Revoca el JWT (añade jti a la lista de bloqueados) |
| POST | `/auth/2fa/verify` | Completa el login cuando el 2FA está activado |

- JWT almacenado en cookie httpOnly (`cyberaudit_token`)
- Revocación de tokens mediante colección MongoDB `revokedtokens` con índice TTL
- Bloqueo de cuenta tras 5 intentos fallidos (15 min)
- Rate limiting en todas las rutas de autenticación (10 peticiones / 15 min)

### Perfil de usuario — `/me`
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/me` | Devuelve el perfil completo del usuario incluyendo datos de organización |
| PUT | `/me/organizacion` | Actualiza sector, tamaño y tipo de actividad |
| GET | `/me/historial` | Lista de evaluaciones pasadas (sin respuestas) |
| GET | `/me/historial/:id` | Detalle completo de una evaluación con puntuaciones por bloque y remediaciones |

### Doble factor de autenticación — `/me/2fa`
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/me/2fa/setup` | Genera secreto TOTP y código QR |
| POST | `/me/2fa/enable` | Confirma y activa el 2FA |
| POST | `/me/2fa/disable` | Desactiva el 2FA con el código TOTP actual |

### Normativas — `/normativas`
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/normativas` | Todas las normativas disponibles (público) |
| GET | `/normativas/:id` | Normativa individual con bloques y preguntas completas |
| GET | `/normativas/aplicables` | Normativas filtradas por el sector del usuario (requiere autenticación) |

- Las normativas con `sectores_aplicables: []` son universales y se muestran a todos
- Las normativas con sectores definidos sólo se muestran a los usuarios del sector correspondiente

#### Esquema canónico y validación

Las normativas nuevas (a partir de NIS2) siguen un contrato JSON canónico definido en `backend/seed/schema_normativa.json`. El validador `backend/seed/validate_normativa.py` se ejecuta en `make seed` (en el host) **antes** del seed real y aborta si algún JSON no cumple el contrato (campos obligatorios, enums válidos, suma de `peso_bloque` = 100).

Campos canónicos por pregunta: `id`, `texto`, `peso`, `nivel`, `fase_pds`, `remediacion`, `ayuda` (texto plano para tooltip), `requisito_original` (cita textual del fragmento legal), `tipo` (`obligatorio` / `recomendado` / `condicional`), `aplicabilidad` (perfiles aplicables, p. ej. `["esencial","importante"]`), `referencia_articulo` (cita al artículo o control). Campos canónicos por bloque: `descripcion`, `peso_bloque` (0–100, deben sumar 100), `temas` (vocabulario cerrado para cross-mapping), `seccion_normativa` (opcional, agrupación nativa de la normativa, p. ej. cláusulas de ISO 27002) y `fecha_aplicabilidad` (opcional). Campos canónicos por normativa: `referencia_oficial` (cita legal con fecha) y `fecha_aplicabilidad_general` (opcional).

Todas las normativas del seed están ya en formato canónico (la antigua `ens` placeholder fue regenerada por Cris).

`backend/seed/seed.js` auto-descubre cualquier `*_normativa.json` que se deje caer en `backend/seed/` (excluyendo `schema_normativa.json`), por lo que añadir una nueva normativa canónica es un *drop-in*: copiar el JSON al directorio, ejecutar `make seed`, y el validador + el seed la procesan automáticamente.

Estado actual del seed (11 normativas, 98 bloques, 343 preguntas, todas canónicas):
- `ens` — 18 bloques, 70 preguntas
- `nis2` — 10 bloques, 40 preguntas
- `eni` — 10 bloques, 61 preguntas
- `rgpd` — 8 bloques, 19 preguntas
- `ia_act` — 7 bloques, 26 preguntas
- `iso27001` — 7 bloques, 15 preguntas
- `iso27002` — 16 bloques, 50 preguntas
- `cra` — 6 bloques, 22 preguntas
- `lopdpygdd` — 6 bloques, 9 preguntas
- `lssi_ce` — 5 bloques, 11 preguntas
- `cybersecurity_act` — 5 bloques, 20 preguntas

#### Cobertura estimada multinormativa

`POST /resultado` y `GET /historial/:id` devuelven adicionalmente el campo `cobertura_estimada`: una lista con la estimación aproximada del cumplimiento del usuario en cada normativa **distinta** a la que ha contestado, calculada por proyección temática.

El cross-mapping se basa en el campo `temas` (opcional, en cada bloque) que toma valores de un vocabulario cerrado de 37 temas definido en `backend/constants/temas.js` y replicado en el enum del schema canónico. Cada entrada de `cobertura_estimada` incluye `normativa_id`, `normativa_nombre`, `porcentaje_estimado` (entero 0–100 o `null` si ningún bloque pudo estimarse), `cobertura_tematica` (ratio 0–1 de bloques estimables), `bloques_estimados` y `tipo: 'estimado'` como marcador semántico para que el frontend lo diferencie del cumplimiento medido.

Actualmente las 11 normativas tienen todos sus bloques etiquetados con `temas`, por lo que `cobertura_estimada` produce estimaciones cruzadas entre todas ellas.

### Evaluaciones — `/resultado`
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/resultado` | Envía respuestas y devuelve el resultado puntuado |

La respuesta incluye:
- `porcentaje` — puntuación global
- `nivel` — Alto / Medio / Bajo / Crítico
- `puntuaciones_bloques` — desglose de puntuación por bloque temático
- `remediaciones` — acciones de mejora priorizadas ordenadas por brecha (`peso × (1 − valor)`)
- `normativa_nombre` — nombre legible de la normativa
- `cobertura_estimada` — estimación cruzada del cumplimiento del usuario en el resto de normativas (ver subsección anterior)

Funciona de forma anónima (el resultado caduca en 24 h) o autenticada (el resultado se persiste).

### Plan Director de Seguridad — `/me/pds`
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/me/pds/:resultadoId` | Genera el plan de acción para una evaluación pasada |

- Las remediaciones se agrupan por las 5 fases del marco INCIBE cuando el campo `fase_pds` está presente en los datos de la normativa
- Si no hay datos de fase, devuelve una lista plana priorizada
- La respuesta incluye `usa_fases_incibe` para que el frontend sepa qué layout usar

### Licitaciones públicas — `/licitaciones`
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/licitaciones` | Lista paginada de licitaciones de ciberseguridad (público) |
| GET | `/licitaciones/status` | Estado del scraper: última sincronización, número de registros y errores |
| POST | `/licitaciones/sync` | Lanza una nueva descarga para el año y mes indicados (requiere autenticación) |

Filtros disponibles en `GET /licitaciones`:
- `?q=` — búsqueda por texto en título y resumen
- `?estado=` — p. ej. EV (en evaluación), RES (resuelta), PRE (previa)
- `?anio=` / `?mes=` — filtra por periodo de descarga
- `?page=` / `?limit=` (máx. 100) — paginación

Los datos proceden del feed Atom/XML de PLACSP (feed 643) a través de un contenedor Python independiente que escribe directamente en MongoDB.

---

## Lo que le falta al frontend

### 1. Perfil de organización
**Endpoints:** `GET /me`, `PUT /me/organizacion`

La página de ajustes sólo gestiona el 2FA. Necesita una sección nueva donde el usuario pueda configurar:
- Sector (`publica`, `sanitaria`, `energia`, `transporte`, `financiero`, `educacion`, `privada`, `otro`)
- Tamaño (`micro`, `pequena`, `mediana`, `grande`)
- Tipo de actividad (texto libre, máx. 200 caracteres)

### 2. Normativas filtradas por sector
**Endpoint:** `GET /normativas/aplicables`

`Home.jsx` llama a `GET /normativas` para todos los usuarios. Para usuarios autenticados debería llamar a `GET /normativas/aplicables`, que devuelve sólo las normativas relevantes para su sector. La respuesta incluye `perfil_completo: false` cuando el usuario no tiene sector definido — en ese caso el frontend debería redirigirle a completar su perfil.

### 3. Puntuaciones por bloque en el detalle de evaluación
**Ya devuelto por:** `GET /me/historial/:id` como `puntuaciones_bloques`

`HistorialDetalle.jsx` intenta acceder a `detalle.bloques`, que no existe en la respuesta de la API — **esta página está rota**. Recalcula las puntuaciones por bloque en el cliente a partir de las preguntas en bruto, pero la API ya no devuelve los bloques completos de la normativa en este endpoint. La solución es sustituir esa lógica por `detalle.puntuaciones_bloques`, que ya viene calculado en la respuesta.

### 4. Remediaciones en el resultado y en el detalle
**Ya devuelto por:** `POST /resultado` y `GET /me/historial/:id` como `remediaciones`

`Resultado.jsx` muestra recomendaciones genéricas codificadas a mano en lugar del array `remediaciones` que la API ya envía. Cada remediación incluye `pregunta`, `nivel`, `prioridad`, `remediacion` (acción concreta) y `bloque`.

`HistorialDetalle.jsx` también recibe `remediaciones` pero no las renderiza.

### 5. Plan Director de Ciberseguridad (PDS) — ✅ Implementado (mayo 2026)
**Endpoint:** `GET /me/pds/:resultadoId`

`frontend/src/pages/PlanDirector.jsx` consume el endpoint en la ruta `/pds/:resultadoId`, accesible desde el botón "Ver Plan Director" de `Resultado.jsx` y "Generar Plan Director" de `HistorialDetalle.jsx`. Agrupa las acciones por fase INCIBE (1–5) cuando `usa_fases_incibe` es `true` y muestra una lista plana priorizada en caso contrario.

### 6. Licitaciones públicas
**Endpoints:** `GET /licitaciones`, `GET /licitaciones/status`, `POST /licitaciones/sync`

No existe ninguna página en el frontend. Se necesita una página nueva con:
- Lista paginada y buscable de licitaciones de ciberseguridad
- Filtros por estado y periodo
- Enlace a la ficha original en PLACSP (campo `enlace`)
- Botón de sincronización con indicador de estado (en curso / última sincronización / total de registros)

### 7. Campos canónicos enriquecidos en las preguntas
**Devueltos por:** `GET /normativas/:id` (y por cualquier endpoint que serialice una normativa)

A partir de NIS2, cada pregunta incluye campos que el frontend actualmente ignora:
- `ayuda` — texto en lenguaje plano para mostrar como tooltip o panel desplegable junto a la pregunta
- `requisito_original` — cita textual del fragmento legal que origina la pregunta (útil en informes / PDS)
- `tipo` — `obligatorio` o `recomendado` (badge de prioridad en el cuestionario)
- `aplicabilidad` — perfiles a los que aplica la pregunta (badge informativo)
- `referencia_articulo` — cita exacta al artículo (p. ej. `"Art. 21.2.h Directiva (UE) 2022/2555"`)

A nivel de bloque, `descripcion` y `peso_bloque` también se ignoran hoy. `Cuestionario.jsx` y `Resultado.jsx` son los principales candidatos para consumir estos campos.

### 8. Cobertura estimada multinormativa
**Devuelto por:** `POST /resultado` y `GET /me/historial/:id` como `cobertura_estimada`

`Resultado.jsx` y `HistorialDetalle.jsx` reciben el array `cobertura_estimada` pero no lo renderizan. Cada entrada lleva `normativa_id`, `normativa_nombre`, `porcentaje_estimado`, `cobertura_tematica` (0–1), `bloques_estimados` y `tipo: 'estimado'`.

Diseño recomendado en el frontend: bajo el porcentaje principal medido, una sección "Cobertura estimada en otras normativas" con cada entrada mostrando nombre, porcentaje con prefijo `≈` o badge "Estimación", indicador de cobertura temática (p. ej. "estimación basada en el 83% de la normativa"), y opcionalmente un botón "Contestar esta normativa" que lleve al cuestionario. La sección debe ser visualmente más discreta que el porcentaje principal — las estimaciones son contexto, el porcentaje medido manda.
