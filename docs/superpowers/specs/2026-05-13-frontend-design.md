# NormativaCheck Frontend — Design Spec

**Date:** 2026-05-13  
**Status:** Approved

---

## 1. Objetivo

Construir el frontend de NormativaCheck como una SPA React que permite al usuario seleccionar una normativa, responder su cuestionario y ver el resultado de cumplimiento con remediaciones priorizadas.

---

## 2. Stack técnico

| Herramienta | Versión | Motivo |
|-------------|---------|--------|
| React | 18 | Framework UI |
| Vite | 5 | Bundler/dev server |
| Tailwind CSS | 3 | Estilos utilitarios |
| React Router | 6 | Navegación SPA con URLs |

Sin dependencias adicionales de gestión de estado. Fetch nativo + `useState` por página.

---

## 3. Estructura de archivos

```
frontend/
├── Dockerfile
├── index.html
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── package.json
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── index.css
    ├── api.js
    ├── pages/
    │   ├── Home.jsx
    │   ├── Cuestionario.jsx
    │   └── Resultado.jsx
    └── components/
        ├── NormativaCard.jsx
        ├── BloquePreguntas.jsx
        └── RemediacionItem.jsx
```

---

## 4. Rutas

| Ruta | Componente | Descripción |
|------|-----------|-------------|
| `/` | `Home` | Grid de 4 tarjetas de normativas |
| `/cuestionario/:id` | `Cuestionario` | Cuestionario con preguntas por bloque |
| `/resultado/:id` | `Resultado` | Puntuación, nivel y remediaciones |

---

## 5. Capa de API (`src/api.js`)

Todas las llamadas usan `VITE_API_URL` (por defecto `http://localhost/api`).

```
listarNormativas()       → GET /api/normativas
obtenerPreguntas(id)     → GET /api/normativas/:id/preguntas
evaluar(normativaId, respuestas) → POST /api/cuestionario/evaluar
```

El resultado de `evaluar` se pasa a `/resultado/:id` via React Router `state` para evitar un segundo fetch.

---

## 6. Páginas

### 6.1 Home (`/`)

- Fondo: `#0f172a` (slate-900)
- Header con logo/nombre "NormativaCheck" y tagline
- Grid 2×2 de `NormativaCard`
- Cada tarjeta muestra: nombre, versión, descripción corta, número total de preguntas
- Click navega a `/cuestionario/:id`

### 6.2 Cuestionario (`/cuestionario/:id`)

- Al montar: `GET /api/normativas/:id/preguntas`
- Estado: `respuestas: Record<preguntaId, "si"|"parcialmente"|"no">`
- Preguntas agrupadas por bloque (cabecera de sección diferenciada)
- Cada pregunta: texto + 3 botones pill (Sí / Parcialmente / No)
  - Sí → verde (`bg-green-600`)
  - Parcialmente → amarillo (`bg-yellow-500`)
  - No → rojo (`bg-red-600`)
  - Sin respuesta → borde gris neutro
- Botón "Evaluar" deshabilitado hasta que todas las preguntas tengan respuesta
- Al enviar: `POST /api/cuestionario/evaluar` → navega a `/resultado/:id` con `state: { resultado }`
- Botón "Volver" en la cabecera

### 6.3 Resultado (`/resultado/:id`)

- Si no hay `state` (acceso directo a la URL), redirige a `/`
- Círculo de puntuación grande con porcentaje:
  - ≥ 80% → verde
  - ≥ 50% → amarillo
  - < 50% → rojo
- Badge de nivel `ALTO / MEDIO / BAJO` con color correspondiente
- Contador: "X preguntas evaluadas"
- Lista de remediaciones (`RemediacionItem`) ordenadas por peso desc:
  - Solo preguntas que no respondieron "Sí"
  - Cada ítem: texto de la pregunta, respuesta dada, texto de remediación, referencia normativa, indicador de peso (prioridad alta/media)
- Botón "Volver al inicio" → `/`

---

## 7. Paleta de colores

| Token | Hex | Uso |
|-------|-----|-----|
| `slate-900` | `#0f172a` | Fondo principal |
| `slate-800` | `#1e293b` | Tarjetas/cabeceras |
| `slate-700` | `#334155` | Bordes, separadores |
| `white` | `#ffffff` | Texto principal sobre fondos oscuros |
| `blue-500` | `#3b82f6` | Acentos, botón primario activo |
| `green-600` | `#16a34a` | Respuesta Sí / nivel ALTO |
| `yellow-500` | `#eab308` | Respuesta Parcialmente / nivel MEDIO |
| `red-600` | `#dc2626` | Respuesta No / nivel BAJO |

---

## 8. Dockerfile del frontend

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
```

---

## 9. Cambios en nginx

`nginx/nginx.conf` añade proxy del frontend:

```nginx
location / {
    proxy_pass http://frontend:3000;
    proxy_set_header Host $host;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

El bloque `/api/` ya existe y no cambia.

---

## 10. Variables de entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost/api` | Base URL de la API |

En `docker-compose.yml` se usa `REACT_APP_API_URL`; se renombrará a `VITE_API_URL` para que Vite la exponga al cliente.

---

## 11. Criterios de éxito

- [ ] Las 4 normativas se cargan desde la API y se muestran como tarjetas
- [ ] El cuestionario agrupa las preguntas por bloque
- [ ] El botón "Evaluar" solo se activa con todas las preguntas respondidas
- [ ] El resultado muestra porcentaje, nivel y remediaciones
- [ ] El diseño es coherente en azul oscuro y blanco
- [ ] El frontend sirve en puerto 3000 dentro de Docker
- [ ] nginx proxea `/` al frontend y `/api/` al backend
