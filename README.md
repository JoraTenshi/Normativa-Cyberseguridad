# CyberAudit — Herramienta de Autoevaluación de Ciberseguridad

Aplicación web para evaluar el nivel de cumplimiento de una organización respecto a normativas de ciberseguridad. Actualmente incluye **11 normativas**: **NIS2**, **ISO/IEC 27001:2022**, **ISO/IEC 27002:2022**, **RGPD**, **LOPDPyGDD**, **ENS** (Esquema Nacional de Seguridad), **ENI** (Esquema Nacional de Interoperabilidad), **CRA** (Reglamento de Ciberresiliencia), **LSSI-CE**, el **Reglamento de IA (IA Act)** y el **Cybersecurity Act**.

Los usuarios responden un cuestionario por bloques temáticos y obtienen un informe de cumplimiento con puntuación y nivel de riesgo. Las cuentas registradas conservan el historial de evaluaciones.

---

## Requisitos

| Herramienta | Versión |
|-------------|---------|
| Docker + Docker Compose | Cualquier versión reciente |
| Node.js | v20 o superior (también para `npm test`) |
| make | — |
| Python 3 + `jsonschema` | Para validar las normativas antes del seed (`pip install -r backend/seed/requirements.txt`) |
| mkcert *(recomendado)* | Para evitar el aviso de certificado autofirmado |

---

## Puesta en marcha

Primera instalación desde un clon limpio (base de datos vacía):

```bash
# 1. Validador de normativas
pip install -r backend/seed/requirements.txt

# 2. Claves del backend (una sola vez; el backend no arranca sin ellas)
cp backend/.env.example backend/.env && chmod 600 backend/.env
for k in JWT_SECRET TOTP_ENCRYPTION_KEY; do
  v=$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))")
  sed -i "s|^$k=.*|$k=$v|" backend/.env
done

# 3. Arrancar y cargar las normativas
make up
make seed
```

- **Claves.** `JWT_SECRET` firma las sesiones y `TOTP_ENCRYPTION_KEY` cifra los secretos 2FA guardados en MongoDB. Deben ser hexadecimales de 32 bytes (64 caracteres) y distintas entre sí. `make up` las comprueba antes de arrancar Docker (`scripts/check-backend-secrets.js`) y se detiene si faltan o no son válidas; el backend tampoco arranca sin ellas. Nada las genera automáticamente.
- **Guarda una copia de `TOTP_ENCRYPTION_KEY`** fuera del equipo: si se pierde, los secretos 2FA guardados no se pueden descifrar y esos usuarios tendrán que volver a configurar el 2FA.
- `make up` construye e inicia los servicios (~1-2 minutos la primera vez); **no** siembra la base de datos, así que reiniciar o recrear los contenedores conserva cuentas y resultados.
- `make seed` carga las normativas y **solo funciona sobre una colección `normativas` vacía**: si ya hay datos, se niega y no modifica nada.

Al terminar, la aplicación está disponible en **https://localhost** (solo desde el propio equipo: los puertos 80/443 se publican en `127.0.0.1`).

### Correo (verificación de cuenta y recuperación de contraseña)

Para iniciar sesión, una cuenta nueva tiene que **confirmar su correo** con el enlace que se envía al registrarse. La recuperación de contraseña también funciona por correo. Configura `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` y `SMTP_FROM` en `backend/.env` (vale un servidor SMTP de pruebas) y `APP_URL` con la URL HTTPS pública. Sin SMTP el backend **no envía ni registra** los enlaces.

Solo para pruebas locales sin SMTP, una cuenta se puede marcar como verificada a mano:

```bash
source .env   # MONGO_USER y MONGO_PASSWORD
docker exec cybersec_mongo mongosh -u "$MONGO_USER" -p "$MONGO_PASSWORD" --authenticationDatabase admin cybersec_audit \
  --eval 'db.usuarios.updateOne({ email: "tu@correo.test" }, { $set: { emailVerifiedAt: new Date() } })'
```

### Administración

`POST /licitaciones/sync` (lanzar el scraper) exige el rol `admin`. Ninguna ruta de la API permite cambiar el rol: se asigna en la base de datos, y el backend lo lee en cada petición, así que retirarlo surte efecto al momento.

```bash
source .env   # MONGO_USER y MONGO_PASSWORD
docker exec cybersec_mongo mongosh -u "$MONGO_USER" -p "$MONGO_PASSWORD" --authenticationDatabase admin cybersec_audit \
  --eval 'db.usuarios.updateOne({ email: "admin@correo.test" }, { $set: { rol: "admin" } })'
```

### Llamar a la API fuera del frontend

Las peticiones que cambian datos (`POST`, `PUT`, `PATCH`, `DELETE`) se rechazan con `403 ORIGEN_NO_PERMITIDO` salvo que lleven el `Origin` del frontend (`CORS_ORIGIN`) o la cabecera `X-Requested-With: XMLHttpRequest`. El frontend la envía siempre; con `curl` hay que añadir `-H 'X-Requested-With: XMLHttpRequest'`.

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
| `make seed` | Valida y carga las normativas en una base de datos vacía (servicios en marcha) |
| `make cert` | Genera o regenera el certificado SSL |
| `make clean` | Para los servicios y elimina las imágenes locales y `node_modules`. **Conserva** los volúmenes de MongoDB, los `.env` y los certificados |
| `bash scripts/backup-mongodb.sh` | Copia cifrada (GPG) de MongoDB en `~/Documents/Seguridad` (directorio con permisos `700`); para `backend` y `scraper` mientras copia. Requiere `sudo` |
| `bash scripts/verify-mongodb-backup.sh <copia.gpg>` | Ensayo de restauración de una copia en un contenedor aislado |
| `cd backend && npm ci && npm test` | Ejecuta las pruebas del backend (no necesitan Docker ni MongoDB) |
| `cd scraper && python3 -m unittest discover -s tests -v` | Pruebas del scraper (con las dependencias de `scraper/requirements.txt`) |

---

## Estructura

```
├── backend/
│   ├── middleware/        # Autenticación JWT, manejo de errores
│   ├── models/            # Normativa, Resultado, Usuario, RevokedToken, Licitacion
│   ├── routes/            # auth, me, normativas, resultados, twoFactor, pds, licitaciones
│   ├── scripts/           # Migración y análisis de secretos 2FA
│   ├── seed/              # Datos iniciales de normativas
│   ├── utils/             # Scoring, comprobación de claves, cifrado 2FA, correo
│   ├── validation/        # Validación de respuestas del cuestionario
│   ├── tests/             # npm test (node:test + Supertest)
│   ├── app.js             # Aplicación Express (sin conexión a BD ni listen)
│   └── server.js          # Comprueba claves, conecta a MongoDB y arranca
│
├── docs/                  # Contrato de evaluación, registro de auditoría de seguridad
├── scripts/               # Comprobación de claves, copias cifradas de MongoDB
│
├── frontend/
│   └── src/
│       ├── context/       # Estado de sesión global
│       ├── pages/         # Home, Auth, VerifyEmail, ForgotPassword, ResetPassword, Cuestionario, Resultado,
│       │                  # Historial, HistorialDetalle, PlanDirector, Settings
│       └── services/      # Cliente HTTP (Axios)
│
├── nginx/                 # Reverse proxy HTTPS, TLS 1.2/1.3
├── docker-compose.yml
└── Makefile
```

---

## Flujo de uso

**Sin cuenta:** seleccionar normativa → responder cuestionario → ver informe. El resultado no se guarda.

**Con cuenta:** registrarse → confirmar el correo con el enlace recibido → iniciar sesión → completar cuestionario → el resultado queda guardado en el historial. El informe y el Plan Director se pueden guardar en PDF con el botón **Descargar PDF** (diálogo de impresión del navegador → «Guardar como PDF»). Desde **Ajustes** se puede activar la autenticación en dos pasos (TOTP). Si se olvida la contraseña, se restablece con un enlace por correo; al cambiarla se cierran todas las sesiones abiertas.

---

## Lógica de puntuación

> El resultado es un **índice de autoevaluación** basado en respuestas declaradas, no una certificación.
> Contrato completo (algoritmo v2): [`docs/contrato-evaluacion.md`](docs/contrato-evaluacion.md).

Antes de calcular, `POST /resultado` exige el cuestionario **completo**: una respuesta por pregunta de la normativa, con valor 0, 0,5 o 1. Si falta alguna, sobra, se repite o tiene otro valor, responde 400 y no guarda nada.

```
Valor de cada respuesta:  Sí → 1   Parcial → 0,5   No → 0

Por bloque:  % bloque = 100 × Σ(valor × peso_pregunta) / Σ(peso_pregunta)
Global:      índice   = Σ(% bloque × peso_bloque) / Σ(peso_bloque)
```

Cada bloque cuenta según su `peso_bloque` (los de una normativa suman 100), no según cuántas preguntas tenga. El índice se muestra redondeado, pero el nivel se decide con el **valor exacto** (29,7 se muestra como 30 % y es Crítico):

| Índice exacto | Nivel |
|---------------|-------|
| ≥ 85 | Alto |
| ≥ 60 y < 85 | Medio |
| ≥ 30 y < 60 | Bajo |
| < 30 | Crítico |

Con sesión iniciada, cada evaluación guarda una copia de lo calculado (versión del algoritmo, índice exacto, nivel, desglose por bloque, remediaciones y cobertura estimada); el historial y el Plan Director muestran esa copia aunque el catálogo de normativas cambie después. Sin sesión, el resultado se muestra pero no se guarda.

### Cobertura estimada multinormativa

Al contestar una normativa, la respuesta de `POST /resultado` (y de `GET /me/historial/:id`) incluye además el campo `cobertura_estimada`: una estimación aproximada del cumplimiento del usuario en el resto de normativas, calculada por proyección temática. Cada bloque puede declarar un array `temas` (vocabulario cerrado de 37 valores en `backend/constants/temas.js`); el motor construye un perfil temático a partir de las respuestas y lo proyecta sobre los bloques de las normativas no contestadas. Igual que el índice, tanto el perfil como la proyección ponderan cada bloque por su `peso_bloque`. Las entradas se marcan con `tipo: 'estimado'` para que el frontend las diferencie del cumplimiento medido. Los bloques sin temas comunes con el perfil aparecen como `porcentaje_estimado: null`.

---

## Añadir una normativa

Las normativas siguen un contrato JSON canónico definido en `backend/seed/schema_normativa.json`. Para añadir una nueva:

1. Crear un archivo `<NOMBRE>_normativa.json` (p. ej. `DORA_normativa.json`) en `backend/seed/`.
2. Validarlo: `python3 backend/seed/validate_normativa.py backend/seed/<NOMBRE>_normativa.json`.

El validador (`backend/seed/validate_normativa.py`) verifica el esquema y la regla de negocio "la suma de `peso_bloque` debe ser 100"; `make seed` lo ejecuta sobre todos los ficheros antes del seed real. Cualquier `*_normativa.json` válido es descubierto e ingerido sin tocar código **en una instalación nueva**. `make seed` no añade ni actualiza normativas en una base de datos que ya tiene datos (para no borrar resultados que las referencian); ese caso todavía no está soportado.

---

## Tecnologías

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18, React Router v6, Axios |
| Backend | Node.js, Express 4, Mongoose 8 |
| Autenticación | JWT (HttpOnly cookie), bcryptjs, speakeasy (TOTP, secretos cifrados con AES-256-GCM), verificación de correo |
| Base de datos | MongoDB 7 |
| Proxy / HTTPS | nginx, TLS 1.2/1.3 |
| Infraestructura | Docker, Docker Compose, Make |

---

## Licencia

MIT
