# CyberAudit — Herramienta de Autoevaluación de Ciberseguridad

Aplicación web **full-stack** para evaluar el nivel de cumplimiento de una organización respecto a normativas de ciberseguridad como **ISO 27001** y el **Esquema Nacional de Seguridad (ENS)**.

---

## Estructura del proyecto

```
cybersec-audit/
├── backend/
│   ├── middleware/
│   │   └── auth.js               # JWT: requireAuth / optionalAuth
│   ├── models/
│   │   ├── Normativa.js          # Normativas y preguntas
│   │   ├── Resultado.js          # Resultados (vinculados a usuario o anónimos)
│   │   └── Usuario.js            # Cuentas de usuario (bcrypt)
│   ├── routes/
│   │   ├── auth.js               # POST /auth/register, POST /auth/login
│   │   ├── me.js                 # GET /me, GET /me/historial, GET /me/historial/:id
│   │   ├── normativas.js         # GET /normativas, GET /normativas/:id
│   │   └── resultados.js         # POST /resultado
│   ├── seed/
│   │   └── seed.js               # Poblar la base de datos con normativas
│   ├── server.js                 # Punto de entrada del servidor
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── context/
│       │   └── AuthContext.jsx   # JWT en localStorage, login/logout global
│       ├── components/
│       │   ├── BloquePreguntas.jsx
│       │   └── ProgressBar.jsx
│       ├── pages/
│       │   ├── Auth.jsx          # Login / Registro (tabs)
│       │   ├── Cuestionario.jsx  # Formulario dinámico de preguntas
│       │   ├── Historial.jsx     # Lista de evaluaciones del usuario
│       │   ├── HistorialDetalle.jsx  # Desglose completo de una evaluación
│       │   ├── Home.jsx          # Selector de normativa
│       │   └── Resultado.jsx     # Informe de cumplimiento
│       ├── services/
│       │   └── api.js            # Axios + interceptor JWT automático
│       ├── App.js
│       ├── App.css
│       └── index.js
│
├── nginx/
│   ├── nginx.conf                # Reverse proxy HTTPS, TLS 1.2/1.3, cabeceras de seguridad
│   └── certs/                   # Certificado SSL (generado por make cert)
│       ├── cert.pem
│       └── key.pem
│
├── docker-compose.yml            # MongoDB + nginx
├── Makefile                      # Automatización completa
└── README.md
```

---

## Requisitos previos

| Herramienta | Uso |
|-------------|-----|
| **Docker** | MongoDB y nginx |
| **Node.js** v18+ | Backend y frontend |
| **npm** v9+ | Gestión de dependencias |
| **make** | Automatización |
| **openssl** | Generación de certificados (incluido en Linux) |
| **mkcert** *(recomendado)* | Certificados de confianza sin aviso de navegador |

---

## Puesta en marcha

### Opción A — Con certificado de confianza (sin aviso de navegador)

```bash
# Instalar mkcert una sola vez
sudo apt install mkcert libnss3-tools
mkcert -install        # Registra la CA local en el navegador

make up                # Arranca todo
```

### Opción B — Sin mkcert (certificado autofirmado, aviso de navegador)

```bash
make up
# El navegador mostrará un aviso: "Avanzado → Continuar de todos modos"
```

Al terminar verás:

```
CyberAudit is up and running!
  App (HTTPS) -> https://localhost
  Backend     -> http://localhost:5000  (internal)
  Frontend    -> http://localhost:3000  (internal)
```

> La primera vez tarda más porque instala todos los paquetes npm.
> El frontend puede tardar 30-60 segundos adicionales en compilar.

---

## Comandos disponibles

| Comando | Descripción |
|---------|-------------|
| `make up` | Arranca todo: nginx (HTTPS), MongoDB, backend y frontend |
| `make down` | Para todos los servicios |
| `make status` | Muestra qué servicios están corriendo |
| `make logs` | Muestra las últimas líneas de log de backend y frontend |
| `make seed` | Repuebla la base de datos sin reiniciar los servicios |
| `make install` | Instala dependencias npm (backend + frontend) |
| `make cert` | Genera el certificado SSL (mkcert si está disponible, si no openssl) |
| `make recert` | Fuerza la regeneración del certificado (usar tras instalar mkcert) |
| `make clean` | Para todo y elimina `node_modules`, `.env` y logs |

---

## HTTPS y reverse proxy (nginx)

El tráfico pasa siempre por nginx (puerto 443). El backend y el frontend **no son accesibles directamente** desde fuera.

```
Navegador
   │
   ▼  HTTPS :443
 nginx
   ├── /normativas, /resultado, /auth, /me  ──▶  backend :5000
   └── /*                                   ──▶  frontend :3000
```

### Certificado autofirmado (por defecto)

Generado automáticamente en `make up`. El navegador muestra un aviso que se puede aceptar una sola vez.

### Certificado de confianza con mkcert

```bash
sudo apt install mkcert libnss3-tools
mkcert -install    # Solo la primera vez — instala la CA en el sistema
make recert        # Reemplaza el certificado actual por uno de confianza
sudo docker restart cybersec_nginx
```

El certificado es válido 365 días. Para renovarlo: `make recert && sudo docker restart cybersec_nginx`.

---

## Variables de entorno

`backend/.env` se crea automáticamente con `make up`. Para ajustarlo antes de arrancar:

```bash
cp backend/.env.example backend/.env
# Editar backend/.env
make up
```

| Variable | Por defecto | Descripción |
|----------|------------|-------------|
| `MONGODB_URI` | `mongodb://localhost:27017/cybersec_audit` | URI de conexión a MongoDB |
| `PORT` | `5000` | Puerto del backend |
| `CORS_ORIGIN` | `https://localhost` | Origen permitido por CORS |
| `JWT_SECRET` | *(cambiar en producción)* | Secreto para firmar tokens JWT |

Para generar un `JWT_SECRET` seguro:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Para usar MongoDB Atlas:

```env
MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/cybersec_audit
```

---

## Cuentas de usuario e historial

El registro y login son opcionales. `POST /resultado` funciona de forma anónima o autenticada.

### Flujo con cuenta

1. Registrarse o iniciar sesión desde la navbar → **Iniciar sesión**
2. Completar un cuestionario normalmente
3. El resultado queda vinculado a la cuenta automáticamente
4. Acceder a **Historial** en la navbar para ver todas las evaluaciones pasadas
5. Hacer clic en cualquier evaluación para ver el desglose por bloque y pregunta

---

## API REST — Endpoints

### Autenticación

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/auth/register` | Registra un nuevo usuario, devuelve JWT |
| `POST` | `/auth/login` | Inicia sesión, devuelve JWT |

### Perfil e historial *(requieren `Authorization: Bearer <token>`)*

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/me` | Perfil del usuario autenticado |
| `GET` | `/me/historial` | Lista de evaluaciones (sin respuestas, apta para gráficas) |
| `GET` | `/me/historial/:id` | Detalle completo con respuestas y bloques |

### Normativas y evaluación

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/normativas` | Lista todas las normativas disponibles |
| `GET` | `/normativas/:id` | Normativa completa con bloques y preguntas |
| `POST` | `/resultado` | Calcula y guarda el resultado (anónimo o autenticado) |

### Ejemplos

```json
POST /auth/register
{ "nombre": "Ana García", "email": "ana@empresa.com", "password": "secreto123" }
```

```json
POST /resultado
{
  "normativa": "iso27001",
  "respuestas": [
    { "pregunta_id": "ps_1", "valor": 1   },
    { "pregunta_id": "ps_2", "valor": 0.5 },
    { "pregunta_id": "ga_1", "valor": 0   }
  ]
}
```

---

## Lógica de cálculo

```
Puntuación por pregunta = valor_respuesta × peso_pregunta

  Sí      → valor = 1.0
  Parcial → valor = 0.5
  No      → valor = 0.0

Porcentaje = (Σ puntuaciones_obtenidas / puntuación_máxima) × 100
```

| Porcentaje | Nivel | Descripción |
|------------|-------|-------------|
| ≥ 85% | Alto | Excelente postura de seguridad |
| 60–84% | Medio | Mejoras requeridas en algunas áreas |
| 30–59% | Bajo | Brechas significativas de seguridad |
| < 30% | Crítico | Revisión urgente necesaria |

---

## Añadir una nueva normativa

Edita `backend/seed/seed.js` y añade un objeto al array `normativas`. Luego:

```bash
make seed
```

---

## Tecnologías utilizadas

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18, React Router v6, Axios |
| Backend | Node.js, Express 4, bcryptjs, jsonwebtoken |
| Seguridad backend | Helmet, express-rate-limit, CORS |
| Base de datos | MongoDB, Mongoose 8 |
| Proxy / HTTPS | nginx (Docker), TLS 1.2/1.3, mkcert / openssl |
| Estilos | CSS personalizado |
| Dev tools | nodemon, dotenv |
| Infraestructura | Docker, Docker Compose, Make |

---

## Licencia

MIT — Libre para uso educativo y comercial.
