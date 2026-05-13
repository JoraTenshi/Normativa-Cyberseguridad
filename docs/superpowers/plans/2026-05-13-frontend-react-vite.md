# NormativaCheck Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la SPA React + Vite + Tailwind de NormativaCheck con navegación por rutas, cuestionario por bloques, evaluación via API y pantalla de resultados con remediaciones.

**Architecture:** Tres páginas (Home, Cuestionario, Resultado) con React Router 6. Cada página hace fetch propio al montar; el resultado de evaluación viaja a `/resultado/:id` via Router `state` sin segundo fetch. Capa `api.js` centraliza todas las llamadas HTTP.

**Tech Stack:** React 18, Vite 5, Tailwind CSS 3, React Router 6, Vitest 2, @testing-library/react 16.

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `frontend/package.json` | Crear | Dependencias y scripts |
| `frontend/vite.config.js` | Crear | Vite + Vitest config |
| `frontend/tailwind.config.js` | Crear | Content paths para purge |
| `frontend/postcss.config.js` | Crear | Tailwind + autoprefixer |
| `frontend/index.html` | Crear | HTML raíz de la SPA |
| `frontend/src/index.css` | Crear | Directivas Tailwind |
| `frontend/src/setupTests.js` | Crear | jest-dom matchers |
| `frontend/src/main.jsx` | Crear | Entry point, BrowserRouter |
| `frontend/src/App.jsx` | Crear | Definición de rutas |
| `frontend/src/api.js` | Crear | Helpers fetch (listarNormativas, obtenerPreguntas, evaluar) |
| `frontend/src/api.test.js` | Crear | Tests de la capa API |
| `frontend/src/components/NormativaCard.jsx` | Crear | Tarjeta de normativa clicable |
| `frontend/src/components/NormativaCard.test.jsx` | Crear | Tests de NormativaCard |
| `frontend/src/components/BloquePreguntas.jsx` | Crear | Sección de preguntas por bloque |
| `frontend/src/components/BloquePreguntas.test.jsx` | Crear | Tests de BloquePreguntas |
| `frontend/src/components/RemediacionItem.jsx` | Crear | Ítem de remediación en resultado |
| `frontend/src/pages/Home.jsx` | Crear | Grid de tarjetas de normativas |
| `frontend/src/pages/Cuestionario.jsx` | Crear | Cuestionario con bloques y envío |
| `frontend/src/pages/Resultado.jsx` | Crear | Puntuación, nivel y remediaciones |
| `frontend/Dockerfile` | Reemplazar | Node 20 + Vite dev server en :3000 |
| `nginx/nginx.conf` | Modificar | Añadir proxy frontend en `/` |
| `docker-compose.yml` | Modificar | Renombrar REACT_APP_API_URL → VITE_API_URL |

---

## Task 1: Scaffold del proyecto (package.json, config, index.html)

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.js`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/postcss.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/index.css`
- Create: `frontend/src/setupTests.js`

- [ ] **Step 1: Crear `frontend/package.json`**

```json
{
  "name": "normativacheck-frontend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.2"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.0.1",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.20",
    "jsdom": "^25.0.1",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.13",
    "vite": "^5.4.8",
    "vitest": "^2.1.2"
  }
}
```

- [ ] **Step 2: Crear `frontend/vite.config.js`**

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    globals: true,
  },
});
```

- [ ] **Step 3: Crear `frontend/tailwind.config.js`**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {} },
  plugins: [],
};
```

- [ ] **Step 4: Crear `frontend/postcss.config.js`**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 5: Crear `frontend/index.html`**

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>NormativaCheck</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Crear `frontend/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 7: Crear `frontend/src/setupTests.js`**

```javascript
import '@testing-library/jest-dom';
```

- [ ] **Step 8: Instalar dependencias**

```bash
cd frontend && npm install
```

Expected: carpeta `node_modules/` creada, sin errores.

- [ ] **Step 9: Verificar que Vitest arranca**

```bash
cd frontend && npm test
```

Expected: `No test files found` (o similar). Sin errores de configuración.

- [ ] **Step 10: Commit**

```bash
git add frontend/package.json frontend/vite.config.js frontend/tailwind.config.js \
        frontend/postcss.config.js frontend/index.html frontend/src/index.css \
        frontend/src/setupTests.js frontend/package-lock.json
git commit -m "feat: scaffold React+Vite+Tailwind project"
```

---

## Task 2: Infraestructura (Dockerfile, nginx, docker-compose)

**Files:**
- Modify: `frontend/Dockerfile`
- Modify: `nginx/nginx.conf`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Reemplazar `frontend/Dockerfile`**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
```

- [ ] **Step 2: Actualizar `nginx/nginx.conf`**

Reemplazar el bloque `location /` actual (que devuelve texto estático) con el proxy al frontend:

```nginx
server {
    listen 80;
    server_name _;

    location /api/ {
        proxy_pass http://backend:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location / {
        proxy_pass http://frontend:3000;
        proxy_set_header Host $host;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

- [ ] **Step 3: Actualizar `docker-compose.yml` — renombrar variable de entorno del frontend**

En la sección `frontend.environment`, cambiar `REACT_APP_API_URL` por `VITE_API_URL`:

```yaml
  frontend:
    build: ./frontend
    container_name: normativa-cyberseguridad-frontend
    expose:
      - "3000"
    environment:
      VITE_API_URL: ${VITE_API_URL:-http://localhost/api}
    volumes:
      - ./frontend:/app
    networks:
      - cybersecurity-network
```

- [ ] **Step 4: Commit**

```bash
git add frontend/Dockerfile nginx/nginx.conf docker-compose.yml
git commit -m "feat: update Dockerfile and nginx to serve Vite frontend on :3000"
```

---

## Task 3: Capa API (`src/api.js`)

**Files:**
- Create: `frontend/src/api.js`
- Create: `frontend/src/api.test.js`

- [ ] **Step 1: Escribir los tests que deben fallar**

Crear `frontend/src/api.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listarNormativas, obtenerPreguntas, evaluar } from './api.js';

const mockFetch = (data, ok = true) =>
  vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(data),
  });

beforeEach(() => { vi.unstubAllGlobals(); });

describe('listarNormativas', () => {
  it('llama a /normativas y devuelve los datos', async () => {
    const data = [{ id: 'ens', nombre: 'ENS' }];
    vi.stubGlobal('fetch', mockFetch(data));
    const result = await listarNormativas();
    expect(result).toEqual(data);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/normativas'));
  });

  it('lanza error si la respuesta no es ok', async () => {
    vi.stubGlobal('fetch', mockFetch(null, false));
    await expect(listarNormativas()).rejects.toThrow('Error 500');
  });
});

describe('obtenerPreguntas', () => {
  it('llama a /normativas/:id/preguntas', async () => {
    const data = { normativa_id: 'ens', bloques: [] };
    vi.stubGlobal('fetch', mockFetch(data));
    const result = await obtenerPreguntas('ens');
    expect(result).toEqual(data);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/normativas/ens/preguntas'));
  });
});

describe('evaluar', () => {
  it('hace POST a /cuestionario/evaluar con el cuerpo correcto', async () => {
    const resultado = { puntuacion: 75, nivel_cumplimiento: 'MEDIO', remediaciones: [] };
    vi.stubGlobal('fetch', mockFetch(resultado));
    const respuestas = [{ pregunta_id: 'p1', valor: 'si' }];
    const result = await evaluar('ens', respuestas);
    expect(result).toEqual(resultado);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/cuestionario/evaluar'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ normativa_id: 'ens', respuestas }),
      })
    );
  });

  it('lanza error si la respuesta no es ok', async () => {
    vi.stubGlobal('fetch', mockFetch(null, false));
    await expect(evaluar('ens', [])).rejects.toThrow('Error 500');
  });
});
```

- [ ] **Step 2: Ejecutar tests — deben fallar**

```bash
cd frontend && npm test
```

Expected: FAIL — `Cannot find module './api.js'`

- [ ] **Step 3: Crear `frontend/src/api.js`**

```javascript
const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost/api';

export async function listarNormativas() {
  const res = await fetch(`${BASE_URL}/normativas`);
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function obtenerPreguntas(id) {
  const res = await fetch(`${BASE_URL}/normativas/${id}/preguntas`);
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function evaluar(normativaId, respuestas) {
  const res = await fetch(`${BASE_URL}/cuestionario/evaluar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ normativa_id: normativaId, respuestas }),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}
```

- [ ] **Step 4: Ejecutar tests — deben pasar**

```bash
cd frontend && npm test
```

Expected: 6 tests PASS, 0 FAIL.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api.js frontend/src/api.test.js
git commit -m "feat: add API layer with fetch helpers"
```

---

## Task 4: App shell (`main.jsx` + `App.jsx`)

**Files:**
- Create: `frontend/src/main.jsx`
- Create: `frontend/src/App.jsx`

- [ ] **Step 1: Crear `frontend/src/main.jsx`**

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

- [ ] **Step 2: Crear `frontend/src/App.jsx`**

```jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Cuestionario from './pages/Cuestionario.jsx';
import Resultado from './pages/Resultado.jsx';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/cuestionario/:id" element={<Cuestionario />} />
        <Route path="/resultado/:id" element={<Resultado />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/main.jsx frontend/src/App.jsx
git commit -m "feat: add app shell with React Router routes"
```

---

## Task 5: Componente `NormativaCard`

**Files:**
- Create: `frontend/src/components/NormativaCard.jsx`
- Create: `frontend/src/components/NormativaCard.test.jsx`

- [ ] **Step 1: Escribir el test que debe fallar**

Crear `frontend/src/components/NormativaCard.test.jsx`:

```jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import NormativaCard from './NormativaCard.jsx';

const normativa = {
  id: 'ens',
  nombre: 'Esquema Nacional de Seguridad (ENS)',
  descripcion: 'Marco normativo español.',
  version: 'RD 311/2022',
  total_preguntas: 12,
};

function renderWithRouter(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

it('muestra nombre, versión, descripción y número de preguntas', () => {
  renderWithRouter(<NormativaCard normativa={normativa} />);
  expect(screen.getByText(normativa.nombre)).toBeInTheDocument();
  expect(screen.getByText(normativa.version)).toBeInTheDocument();
  expect(screen.getByText(normativa.descripcion)).toBeInTheDocument();
  expect(screen.getByText(/12 preguntas/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Ejecutar test — debe fallar**

```bash
cd frontend && npm test
```

Expected: FAIL — `Cannot find module './NormativaCard.jsx'`

- [ ] **Step 3: Crear `frontend/src/components/NormativaCard.jsx`**

```jsx
import { useNavigate } from 'react-router-dom';

export default function NormativaCard({ normativa }) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/cuestionario/${normativa.id}`)}
      className="bg-slate-800 rounded-xl p-6 text-left w-full hover:bg-slate-700 transition-colors border border-slate-700 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <div className="flex justify-between items-start mb-3">
        <h2 className="text-lg font-semibold text-white leading-tight">{normativa.nombre}</h2>
        <span className="ml-2 shrink-0 text-xs font-medium bg-blue-600 text-white px-2 py-1 rounded-full">
          {normativa.version}
        </span>
      </div>
      <p className="text-slate-400 text-sm mb-4 leading-relaxed">{normativa.descripcion}</p>
      <p className="text-blue-400 text-sm font-medium">{normativa.total_preguntas} preguntas →</p>
    </button>
  );
}
```

- [ ] **Step 4: Ejecutar tests — deben pasar**

```bash
cd frontend && npm test
```

Expected: todos los tests PASS (API + NormativaCard).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/NormativaCard.jsx frontend/src/components/NormativaCard.test.jsx
git commit -m "feat: add NormativaCard component"
```

---

## Task 6: Página Home

**Files:**
- Create: `frontend/src/pages/Home.jsx`

- [ ] **Step 1: Crear `frontend/src/pages/Home.jsx`**

```jsx
import { useState, useEffect } from 'react';
import NormativaCard from '../components/NormativaCard.jsx';
import { listarNormativas } from '../api.js';

export default function Home() {
  const [normativas, setNormativas] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    listarNormativas()
      .then(setNormativas)
      .catch(() => setError('No se pudieron cargar las normativas.'));
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-white mb-2">NormativaCheck</h1>
        <p className="text-slate-400 text-lg">
          Evalúa el cumplimiento normativo de ciberseguridad de tu organización
        </p>
      </header>

      {error && (
        <p className="text-red-400 text-center mb-8">{error}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {normativas.map((n) => (
          <NormativaCard key={n.id} normativa={n} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Home.jsx
git commit -m "feat: add Home page with normativa cards grid"
```

---

## Task 7: Componente `BloquePreguntas`

**Files:**
- Create: `frontend/src/components/BloquePreguntas.jsx`
- Create: `frontend/src/components/BloquePreguntas.test.jsx`

- [ ] **Step 1: Escribir el test que debe fallar**

Crear `frontend/src/components/BloquePreguntas.test.jsx`:

```jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BloquePreguntas from './BloquePreguntas.jsx';

const bloque = {
  id: 'b1',
  nombre: 'Marco Organizativo',
  preguntas: [
    { id: 'p1', pregunta: '¿Existe una política de seguridad?' },
    { id: 'p2', pregunta: '¿Se han designado roles?' },
  ],
};

it('muestra el nombre del bloque y las preguntas', () => {
  render(<BloquePreguntas bloque={bloque} respuestas={{}} onRespuesta={() => {}} />);
  expect(screen.getByText('Marco Organizativo')).toBeInTheDocument();
  expect(screen.getByText('¿Existe una política de seguridad?')).toBeInTheDocument();
  expect(screen.getByText('¿Se han designado roles?')).toBeInTheDocument();
});

it('llama onRespuesta con preguntaId y valor al hacer click en Sí', () => {
  const onRespuesta = vi.fn();
  render(<BloquePreguntas bloque={bloque} respuestas={{}} onRespuesta={onRespuesta} />);
  const siButtons = screen.getAllByText('Sí');
  fireEvent.click(siButtons[0]);
  expect(onRespuesta).toHaveBeenCalledWith('p1', 'si');
});

it('llama onRespuesta con "no" al hacer click en No', () => {
  const onRespuesta = vi.fn();
  render(<BloquePreguntas bloque={bloque} respuestas={{}} onRespuesta={onRespuesta} />);
  const noButtons = screen.getAllByText('No');
  fireEvent.click(noButtons[1]);
  expect(onRespuesta).toHaveBeenCalledWith('p2', 'no');
});

it('marca el botón seleccionado cuando hay respuesta en respuestas prop', () => {
  render(
    <BloquePreguntas bloque={bloque} respuestas={{ p1: 'si' }} onRespuesta={() => {}} />
  );
  const siButtons = screen.getAllByText('Sí');
  expect(siButtons[0]).toHaveClass('ring-2');
});
```

- [ ] **Step 2: Ejecutar test — debe fallar**

```bash
cd frontend && npm test
```

Expected: FAIL — `Cannot find module './BloquePreguntas.jsx'`

- [ ] **Step 3: Crear `frontend/src/components/BloquePreguntas.jsx`**

```jsx
const OPCIONES = [
  { valor: 'si', label: 'Sí', activa: 'bg-green-600 hover:bg-green-700 text-white ring-2 ring-white ring-offset-2 ring-offset-slate-800' },
  { valor: 'parcialmente', label: 'Parcialmente', activa: 'bg-yellow-500 hover:bg-yellow-600 text-white ring-2 ring-white ring-offset-2 ring-offset-slate-800' },
  { valor: 'no', label: 'No', activa: 'bg-red-600 hover:bg-red-700 text-white ring-2 ring-white ring-offset-2 ring-offset-slate-800' },
];

const INACTIVA = 'bg-slate-600 hover:bg-slate-500 text-slate-300';

export default function BloquePreguntas({ bloque, respuestas, onRespuesta }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-white bg-slate-700 rounded-lg px-4 py-3 mb-4">
        {bloque.nombre}
      </h2>
      <div className="space-y-6">
        {bloque.preguntas.map((pregunta) => (
          <div key={pregunta.id} className="bg-slate-800 rounded-lg p-5 border border-slate-700">
            <p className="text-slate-200 text-sm mb-4 leading-relaxed">{pregunta.pregunta}</p>
            <div className="flex flex-wrap gap-2">
              {OPCIONES.map((opcion) => {
                const seleccionada = respuestas[pregunta.id] === opcion.valor;
                return (
                  <button
                    key={opcion.valor}
                    onClick={() => onRespuesta(pregunta.id, opcion.valor)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      seleccionada ? opcion.activa : INACTIVA
                    }`}
                  >
                    {opcion.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Ejecutar tests — deben pasar**

```bash
cd frontend && npm test
```

Expected: todos los tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/BloquePreguntas.jsx frontend/src/components/BloquePreguntas.test.jsx
git commit -m "feat: add BloquePreguntas component with Sí/Parcialmente/No buttons"
```

---

## Task 8: Página Cuestionario

**Files:**
- Create: `frontend/src/pages/Cuestionario.jsx`

- [ ] **Step 1: Crear `frontend/src/pages/Cuestionario.jsx`**

```jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import BloquePreguntas from '../components/BloquePreguntas.jsx';
import { obtenerPreguntas, evaluar } from '../api.js';

export default function Cuestionario() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cuestionario, setCuestionario] = useState(null);
  const [respuestas, setRespuestas] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    obtenerPreguntas(id)
      .then(setCuestionario)
      .catch(() => setError('No se pudo cargar el cuestionario.'));
  }, [id]);

  const totalPreguntas =
    cuestionario?.bloques.reduce((acc, b) => acc + b.preguntas.length, 0) ?? 0;
  const todasRespondidas =
    totalPreguntas > 0 && Object.keys(respuestas).length === totalPreguntas;

  function handleRespuesta(preguntaId, valor) {
    setRespuestas((prev) => ({ ...prev, [preguntaId]: valor }));
  }

  async function handleEnviar() {
    setEnviando(true);
    try {
      const respuestasArray = Object.entries(respuestas).map(([pregunta_id, valor]) => ({
        pregunta_id,
        valor,
      }));
      const resultado = await evaluar(id, respuestasArray);
      navigate(`/resultado/${id}`, { state: { resultado } });
    } catch {
      setError('Error al enviar el cuestionario. Inténtalo de nuevo.');
      setEnviando(false);
    }
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={() => navigate('/')} className="text-blue-400 hover:text-blue-300">
          ← Volver al inicio
        </button>
      </div>
    );
  }

  if (!cuestionario) {
    return <div className="p-8 text-center text-slate-400">Cargando cuestionario...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate('/')}
          className="text-slate-400 hover:text-white text-sm transition-colors"
        >
          ← Volver
        </button>
        <h1 className="text-2xl font-bold text-white">{cuestionario.nombre}</h1>
      </div>

      {cuestionario.bloques.map((bloque) => (
        <BloquePreguntas
          key={bloque.id}
          bloque={bloque}
          respuestas={respuestas}
          onRespuesta={handleRespuesta}
        />
      ))}

      <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700 py-4 mt-8">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-sm">
            {Object.keys(respuestas).length} / {totalPreguntas} respondidas
          </span>
          <button
            onClick={handleEnviar}
            disabled={!todasRespondidas || enviando}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold px-8 py-3 rounded-lg transition-colors"
          >
            {enviando ? 'Evaluando...' : 'Evaluar'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Cuestionario.jsx
git commit -m "feat: add Cuestionario page with block sections and submit"
```

---

## Task 9: Componente `RemediacionItem`

**Files:**
- Create: `frontend/src/components/RemediacionItem.jsx`

- [ ] **Step 1: Crear `frontend/src/components/RemediacionItem.jsx`**

```jsx
export default function RemediacionItem({ item }) {
  const esPrioritario = item.peso >= 8;

  return (
    <div className="bg-slate-800 rounded-lg p-5 border border-slate-700">
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-slate-200 text-sm font-medium leading-snug">{item.pregunta}</p>
        <span
          className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-full ${
            esPrioritario ? 'bg-red-900 text-red-300' : 'bg-yellow-900 text-yellow-300'
          }`}
        >
          {esPrioritario ? 'Prioritario' : 'Recomendado'}
        </span>
      </div>
      <p className="text-slate-400 text-sm mb-3 leading-relaxed">{item.remediacion}</p>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">{item.referencia}</span>
        <span
          className={`font-medium ${
            item.valor === 'parcialmente' ? 'text-yellow-500' : 'text-red-500'
          }`}
        >
          Respondido: {item.valor === 'parcialmente' ? 'Parcialmente' : 'No'}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/RemediacionItem.jsx
git commit -m "feat: add RemediacionItem component"
```

---

## Task 10: Página Resultado

**Files:**
- Create: `frontend/src/pages/Resultado.jsx`

- [ ] **Step 1: Crear `frontend/src/pages/Resultado.jsx`**

```jsx
import { useLocation, useNavigate } from 'react-router-dom';
import RemediacionItem from '../components/RemediacionItem.jsx';

function coloresPorNivel(nivel) {
  if (nivel === 'ALTO')
    return { texto: 'text-green-400', borde: 'border-green-400', badge: 'bg-green-900 text-green-300' };
  if (nivel === 'MEDIO')
    return { texto: 'text-yellow-400', borde: 'border-yellow-400', badge: 'bg-yellow-900 text-yellow-300' };
  return { texto: 'text-red-400', borde: 'border-red-400', badge: 'bg-red-900 text-red-300' };
}

export default function Resultado() {
  const { state } = useLocation();
  const navigate = useNavigate();

  if (!state?.resultado) {
    navigate('/', { replace: true });
    return null;
  }

  const { resultado } = state;
  const colores = coloresPorNivel(resultado.nivel_cumplimiento);

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-white mb-8">Resultado de evaluación</h1>

      <div className="bg-slate-800 rounded-xl p-8 border border-slate-700 mb-8 flex flex-col sm:flex-row items-center gap-8">
        <div
          className={`w-36 h-36 rounded-full border-8 ${colores.borde} flex items-center justify-center shrink-0`}
        >
          <span className={`text-4xl font-bold ${colores.texto}`}>
            {Math.round(resultado.puntuacion)}%
          </span>
        </div>
        <div>
          <div
            className={`inline-block text-sm font-bold px-3 py-1 rounded-full mb-3 ${colores.badge}`}
          >
            Nivel {resultado.nivel_cumplimiento}
          </div>
          <p className="text-slate-400 text-sm">
            {resultado.preguntas_evaluadas} preguntas evaluadas
          </p>
          {resultado.remediaciones.length === 0 && (
            <p className="text-green-400 text-sm mt-2 font-medium">
              ¡Cumplimiento completo! No hay remediaciones pendientes.
            </p>
          )}
        </div>
      </div>

      {resultado.remediaciones.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-white mb-4">
            Remediaciones ({resultado.remediaciones.length})
          </h2>
          <div className="space-y-4">
            {resultado.remediaciones.map((item) => (
              <RemediacionItem key={item.pregunta_id} item={item} />
            ))}
          </div>
        </section>
      )}

      <button
        onClick={() => navigate('/')}
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
      >
        ← Volver al inicio
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Ejecutar todos los tests**

```bash
cd frontend && npm test
```

Expected: todos los tests PASS (API + NormativaCard + BloquePreguntas).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Resultado.jsx
git commit -m "feat: add Resultado page with score circle, level badge and remediations"
```

---

## Task 11: Verificación final

**Files:** ninguno nuevo

- [ ] **Step 1: Ejecutar suite de tests completa**

```bash
cd frontend && npm test
```

Expected: todos los tests PASS, 0 FAIL.

- [ ] **Step 2: Verificar que Vite arranca correctamente**

```bash
cd frontend && npm run dev -- --port 3000
```

Expected: `VITE ready in Xms ➜  Local: http://localhost:3000/`  
Abrir `http://localhost:3000` en el navegador y verificar:
- Se ven 4 tarjetas de normativas (requiere que el backend esté corriendo)
- Click en una tarjeta navega a `/cuestionario/:id`
- El cuestionario muestra preguntas agrupadas por bloque
- Los botones Sí/Parcialmente/No se marcan al hacer click
- El contador avanza y el botón "Evaluar" se activa al responder todas
- Al enviar navega a `/resultado/:id` con porcentaje, nivel y remediaciones
- "Volver al inicio" regresa a `/`

Ctrl+C para detener.

- [ ] **Step 3: Verificar estructura final de archivos**

```bash
find frontend/src -type f | sort
```

Expected output:
```
frontend/src/api.js
frontend/src/api.test.js
frontend/src/App.jsx
frontend/src/components/BloquePreguntas.jsx
frontend/src/components/BloquePreguntas.test.jsx
frontend/src/components/NormativaCard.jsx
frontend/src/components/NormativaCard.test.jsx
frontend/src/components/RemediacionItem.jsx
frontend/src/index.css
frontend/src/main.jsx
frontend/src/pages/Cuestionario.jsx
frontend/src/pages/Home.jsx
frontend/src/pages/Resultado.jsx
frontend/src/setupTests.js
```

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "feat: complete NormativaCheck React frontend with Vite + Tailwind"
```

---

## Criterios de aceptación

- [ ] `npm test` en `/frontend` pasa sin errores
- [ ] Las 4 normativas se cargan desde la API y se muestran como tarjetas
- [ ] El cuestionario agrupa preguntas por bloque con cabeceras diferenciadas
- [ ] El botón "Evaluar" solo se activa cuando todas las preguntas tienen respuesta
- [ ] El resultado muestra porcentaje en círculo coloreado, nivel y lista de remediaciones
- [ ] El frontend sirve en puerto 3000 dentro de Docker
- [ ] nginx proxea `/` al frontend y `/api/` al backend
