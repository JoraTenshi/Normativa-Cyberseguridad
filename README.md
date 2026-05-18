# CyberAudit — Herramienta de Autoevaluación de Ciberseguridad

Aplicación web para evaluar el nivel de cumplimiento de una organización respecto a normativas de ciberseguridad. Actualmente incluye **NIS2**, **ISO/IEC 27001:2022**, **ISO/IEC 27002:2022**, **RGPD**, **LOPDPyGDD** y el **Esquema Nacional de Seguridad (ENS)**.

Los usuarios responden un cuestionario por bloques temáticos y obtienen un informe de cumplimiento con puntuación y nivel de riesgo. Las cuentas registradas conservan el historial de evaluaciones.

---

## Requisitos

| Herramienta | Versión |
|-------------|---------|
| Docker + Docker Compose | Cualquier versión reciente |
| Node.js | v18 o superior |
| make | — |
| mkcert *(recomendado)* | Para evitar el aviso de certificado autofirmado |

---

## Puesta en marcha

```bash
make up
```

La primera vez construye las imágenes Docker e instala dependencias (~1-2 minutos). Al terminar la aplicación está disponible en **https://localhost**.

Si el navegador muestra un aviso de certificado, instala mkcert para evitarlo:

```bash
sudo apt install mkcert libnss3-tools
mkcert -install
make recert && sudo docker restart cybersec_nginx
```

---

## Comandos

| Comando | Descripción |
|---------|-------------|
| `make up` | Construye e inicia todos los servicios |
| `make down` | Para todos los servicios |
| `make logs` | Muestra los logs de backend y frontend |
| `make status` | Estado de los contenedores |
| `make seed` | Repuebla la base de datos (servicios en marcha) |
| `make cert` | Genera o regenera el certificado SSL |
| `make clean` | Para todo y elimina imágenes, volúmenes y `.env` |

---

## Estructura

```
├── backend/
│   ├── middleware/        # Autenticación JWT, manejo de errores
│   ├── models/            # Normativa, Resultado, Usuario, RevokedToken
│   ├── routes/            # auth, me, normativas, resultados, twoFactor
│   ├── seed/              # Datos iniciales de normativas
│   ├── utils/             # Generación automática de JWT_SECRET
│   └── server.js
│
├── frontend/
│   └── src/
│       ├── context/       # Estado de sesión global
│       ├── pages/         # Home, Auth, Cuestionario, Resultado, Historial, Settings
│       └── services/      # Cliente HTTP (Axios)
│
├── nginx/                 # Reverse proxy HTTPS, TLS 1.2/1.3
├── docker-compose.yml
└── Makefile
```

---

## Flujo de uso

**Sin cuenta:** seleccionar normativa → responder cuestionario → ver informe. El resultado no se guarda.

**Con cuenta:** registrarse o iniciar sesión → completar cuestionario → el resultado queda guardado en el historial. Desde **Ajustes** se puede activar la autenticación en dos pasos (TOTP).

---

## Lógica de puntuación

Cada pregunta tiene un peso. La puntuación se calcula así:

```
Puntuación obtenida = valor_respuesta × peso_pregunta
  Sí      → 1.0
  Parcial → 0.5
  No      → 0.0

Porcentaje = (Σ puntuaciones_obtenidas / puntuación_máxima) × 100
```

| Porcentaje | Nivel |
|------------|-------|
| ≥ 85% | Alto |
| 60–84% | Medio |
| 30–59% | Bajo |
| < 30% | Crítico |

### Cobertura estimada multinormativa

Al contestar una normativa, la respuesta de `POST /resultado` (y de `GET /me/historial/:id`) incluye además el campo `cobertura_estimada`: una estimación aproximada del cumplimiento del usuario en el resto de normativas, calculada por proyección temática. Cada bloque puede declarar un array `temas` (vocabulario cerrado de 15 valores en `backend/constants/temas.js`); el motor construye un perfil temático ponderado a partir de las respuestas y lo proyecta sobre los bloques de las normativas no contestadas. Las entradas se marcan con `tipo: 'estimado'` para que el frontend las diferencie del cumplimiento medido. Los bloques sin temas comunes con el perfil aparecen como `porcentaje_estimado: null`.

---

## Añadir una normativa

Las normativas siguen un contrato JSON canónico definido en `backend/seed/schema_normativa.json`. Para añadir una nueva:

1. Crear un archivo `<NOMBRE>_normativa.json` (p. ej. `CRA_normativa.json`) en `backend/seed/`.
2. Ejecutar `make seed`.

El validador (`backend/seed/validate_normativa.py`) se ejecuta automáticamente en el host antes del seed real y verifica el esquema y la regla de negocio "la suma de `peso_bloque` debe ser 100". Cualquier `*_normativa.json` válido es descubierto e ingerido sin tocar código.

---

## Tecnologías

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18, React Router v6, Axios |
| Backend | Node.js, Express 4, Mongoose 8 |
| Autenticación | JWT (HttpOnly cookie), bcryptjs, speakeasy (TOTP) |
| Base de datos | MongoDB 7 |
| Proxy / HTTPS | nginx, TLS 1.2/1.3 |
| Infraestructura | Docker, Docker Compose, Make |

---

## Licencia

MIT
