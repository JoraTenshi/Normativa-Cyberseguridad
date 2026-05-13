# Multilanguage i18n Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ES/EN/DE/FR i18n to NormativaCheck's React frontend using i18next, with a language selector in the global header.

**Architecture:** i18next is initialized synchronously with 4 static JSON locale files; `react-i18next`'s `useTranslation` hook replaces all hardcoded strings; a thin global header in `App.jsx` renders `LanguageSelector` on every screen.

**Tech Stack:** i18next, react-i18next, i18next-browser-languagedetector, Vitest, @testing-library/react

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `frontend/package.json` | Add 3 i18n deps |
| Create | `frontend/src/i18n/index.js` | Initialize i18next |
| Create | `frontend/src/i18n/locales/es.json` | Spanish translations |
| Create | `frontend/src/i18n/locales/en.json` | English translations |
| Create | `frontend/src/i18n/locales/de.json` | German translations |
| Create | `frontend/src/i18n/locales/fr.json` | French translations |
| Create | `frontend/src/components/LanguageSelector.jsx` | Language `<select>` |
| Create | `frontend/src/components/LanguageSelector.test.jsx` | Tests for selector |
| Modify | `frontend/src/main.jsx` | Import i18n init |
| Modify | `frontend/src/setupTests.js` | Import i18n init for tests |
| Modify | `frontend/src/App.jsx` | Add global header with selector |
| Modify | `frontend/src/pages/Home.jsx` | Use `useTranslation` |
| Modify | `frontend/src/pages/Cuestionario.jsx` | Use `useTranslation` |
| Modify | `frontend/src/pages/Resultado.jsx` | Use `useTranslation` |
| Modify | `frontend/src/components/BloquePreguntas.jsx` | Use `useTranslation` |
| Modify | `frontend/src/components/NormativaCard.jsx` | Use `useTranslation` |
| Modify | `frontend/src/components/RemediacionItem.jsx` | Use `useTranslation` |

---

## Task 1: Install i18n dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Add dependencies to package.json**

Replace the `"dependencies"` block in `frontend/package.json` with:

```json
"dependencies": {
  "i18next": "^23.16.0",
  "i18next-browser-languagedetector": "^8.0.0",
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "react-i18next": "^15.1.0",
  "react-router-dom": "^6.26.2"
},
```

- [ ] **Step 2: Install packages**

```bash
cd frontend && npm install
```

Expected: dependencies resolved, `node_modules/i18next` exists.

```bash
ls node_modules/i18next && ls node_modules/react-i18next && ls node_modules/i18next-browser-languagedetector
```

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: install i18next react-i18next i18next-browser-languagedetector"
```

---

## Task 2: Create Spanish and English translation files

**Files:**
- Create: `frontend/src/i18n/locales/es.json`
- Create: `frontend/src/i18n/locales/en.json`

- [ ] **Step 1: Create ES locale**

`frontend/src/i18n/locales/es.json`:

```json
{
  "home.subtitle": "Evalúa el cumplimiento normativo de ciberseguridad de tu organización",
  "home.error_load": "No se pudieron cargar las normativas.",
  "cuestionario.loading": "Cargando cuestionario...",
  "cuestionario.error_load": "No se pudo cargar el cuestionario.",
  "cuestionario.error_send": "Error al enviar el cuestionario. Inténtalo de nuevo.",
  "cuestionario.back_home": "← Volver al inicio",
  "cuestionario.back": "← Volver",
  "cuestionario.progress": "{{answered}} / {{total}} respondidas",
  "cuestionario.submit": "Evaluar",
  "cuestionario.submitting": "Evaluando...",
  "resultado.title": "Resultado de evaluación",
  "resultado.level": "Nivel {{nivel}}",
  "resultado.questions_evaluated": "{{count}} preguntas evaluadas",
  "resultado.full_compliance": "¡Cumplimiento completo! No hay remediaciones pendientes.",
  "resultado.remediations": "Remediaciones ({{count}})",
  "resultado.back_home": "← Volver al inicio",
  "options.yes": "Sí",
  "options.partial": "Parcialmente",
  "options.no": "No",
  "card.questions": "{{count}} preguntas →",
  "remediation.priority": "Prioritario",
  "remediation.recommended": "Recomendado",
  "remediation.answered": "Respondido: {{value}}",
  "remediation.value_partial": "Parcialmente",
  "remediation.value_no": "No"
}
```

- [ ] **Step 2: Create EN locale**

`frontend/src/i18n/locales/en.json`:

```json
{
  "home.subtitle": "Assess the cybersecurity regulatory compliance of your organization",
  "home.error_load": "Could not load the regulations.",
  "cuestionario.loading": "Loading questionnaire...",
  "cuestionario.error_load": "Could not load the questionnaire.",
  "cuestionario.error_send": "Error submitting the questionnaire. Please try again.",
  "cuestionario.back_home": "← Back to home",
  "cuestionario.back": "← Back",
  "cuestionario.progress": "{{answered}} / {{total}} answered",
  "cuestionario.submit": "Evaluate",
  "cuestionario.submitting": "Evaluating...",
  "resultado.title": "Evaluation result",
  "resultado.level": "Level {{nivel}}",
  "resultado.questions_evaluated": "{{count}} questions evaluated",
  "resultado.full_compliance": "Full compliance! No pending remediations.",
  "resultado.remediations": "Remediations ({{count}})",
  "resultado.back_home": "← Back to home",
  "options.yes": "Yes",
  "options.partial": "Partially",
  "options.no": "No",
  "card.questions": "{{count}} questions →",
  "remediation.priority": "Priority",
  "remediation.recommended": "Recommended",
  "remediation.answered": "Answered: {{value}}",
  "remediation.value_partial": "Partially",
  "remediation.value_no": "No"
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/i18n/locales/es.json frontend/src/i18n/locales/en.json
git commit -m "feat: add ES and EN translation files"
```

---

## Task 3: Create German and French translation files

**Files:**
- Create: `frontend/src/i18n/locales/de.json`
- Create: `frontend/src/i18n/locales/fr.json`

- [ ] **Step 1: Create DE locale**

`frontend/src/i18n/locales/de.json`:

```json
{
  "home.subtitle": "Bewerten Sie die Cybersicherheits-Compliance Ihrer Organisation",
  "home.error_load": "Die Vorschriften konnten nicht geladen werden.",
  "cuestionario.loading": "Fragebogen wird geladen...",
  "cuestionario.error_load": "Der Fragebogen konnte nicht geladen werden.",
  "cuestionario.error_send": "Fehler beim Senden des Fragebogens. Bitte versuchen Sie es erneut.",
  "cuestionario.back_home": "← Zurück zur Startseite",
  "cuestionario.back": "← Zurück",
  "cuestionario.progress": "{{answered}} / {{total}} beantwortet",
  "cuestionario.submit": "Auswerten",
  "cuestionario.submitting": "Wird ausgewertet...",
  "resultado.title": "Auswertungsergebnis",
  "resultado.level": "Stufe {{nivel}}",
  "resultado.questions_evaluated": "{{count}} Fragen ausgewertet",
  "resultado.full_compliance": "Vollständige Compliance! Keine ausstehenden Abhilfemaßnahmen.",
  "resultado.remediations": "Abhilfemaßnahmen ({{count}})",
  "resultado.back_home": "← Zurück zur Startseite",
  "options.yes": "Ja",
  "options.partial": "Teilweise",
  "options.no": "Nein",
  "card.questions": "{{count}} Fragen →",
  "remediation.priority": "Priorität",
  "remediation.recommended": "Empfohlen",
  "remediation.answered": "Beantwortet: {{value}}",
  "remediation.value_partial": "Teilweise",
  "remediation.value_no": "Nein"
}
```

- [ ] **Step 2: Create FR locale**

`frontend/src/i18n/locales/fr.json`:

```json
{
  "home.subtitle": "Évaluez la conformité réglementaire en cybersécurité de votre organisation",
  "home.error_load": "Impossible de charger les réglementations.",
  "cuestionario.loading": "Chargement du questionnaire...",
  "cuestionario.error_load": "Impossible de charger le questionnaire.",
  "cuestionario.error_send": "Erreur lors de l'envoi du questionnaire. Veuillez réessayer.",
  "cuestionario.back_home": "← Retour à l'accueil",
  "cuestionario.back": "← Retour",
  "cuestionario.progress": "{{answered}} / {{total}} répondues",
  "cuestionario.submit": "Évaluer",
  "cuestionario.submitting": "Évaluation en cours...",
  "resultado.title": "Résultat de l'évaluation",
  "resultado.level": "Niveau {{nivel}}",
  "resultado.questions_evaluated": "{{count}} questions évaluées",
  "resultado.full_compliance": "Conformité totale ! Aucune remédiation en attente.",
  "resultado.remediations": "Remédiations ({{count}})",
  "resultado.back_home": "← Retour à l'accueil",
  "options.yes": "Oui",
  "options.partial": "Partiellement",
  "options.no": "Non",
  "card.questions": "{{count}} questions →",
  "remediation.priority": "Prioritaire",
  "remediation.recommended": "Recommandé",
  "remediation.answered": "Répondu : {{value}}",
  "remediation.value_partial": "Partiellement",
  "remediation.value_no": "Non"
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/i18n/locales/de.json frontend/src/i18n/locales/fr.json
git commit -m "feat: add DE and FR translation files"
```

---

## Task 4: Create i18n initialization and wire into entry points

**Files:**
- Create: `frontend/src/i18n/index.js`
- Modify: `frontend/src/main.jsx`
- Modify: `frontend/src/setupTests.js`

- [ ] **Step 1: Create i18n/index.js**

`frontend/src/i18n/index.js`:

```js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import es from './locales/es.json';
import en from './locales/en.json';
import de from './locales/de.json';
import fr from './locales/fr.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
      de: { translation: de },
      fr: { translation: fr },
    },
    fallbackLng: 'es',
    supportedLngs: ['es', 'en', 'de', 'fr'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
```

- [ ] **Step 2: Import i18n in main.jsx**

Replace the content of `frontend/src/main.jsx` with:

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './i18n/index.js';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

- [ ] **Step 3: Import i18n in setupTests.js**

Replace the content of `frontend/src/setupTests.js` with:

```js
import '@testing-library/jest-dom';
import './i18n/index.js';
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/i18n/index.js frontend/src/main.jsx frontend/src/setupTests.js
git commit -m "feat: initialize i18next with 4 locales"
```

---

## Task 5: Create LanguageSelector component (TDD)

**Files:**
- Create: `frontend/src/components/LanguageSelector.test.jsx`
- Create: `frontend/src/components/LanguageSelector.jsx`

- [ ] **Step 1: Write the failing test**

`frontend/src/components/LanguageSelector.test.jsx`:

```jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import LanguageSelector from './LanguageSelector.jsx';
import i18n from '../i18n/index.js';

describe('LanguageSelector', () => {
  it('renders a select with ES, EN, DE, FR options', () => {
    render(<LanguageSelector />);
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'ES' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'EN' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'DE' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'FR' })).toBeInTheDocument();
  });

  it('changes i18n language when an option is selected', () => {
    render(<LanguageSelector />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'en' } });
    expect(i18n.language).toBe('en');
    fireEvent.change(select, { target: { value: 'es' } });
    expect(i18n.language).toBe('es');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npm test -- LanguageSelector
```

Expected: FAIL — `Cannot find module './LanguageSelector.jsx'`

- [ ] **Step 3: Implement LanguageSelector.jsx**

`frontend/src/components/LanguageSelector.jsx`:

```jsx
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { value: 'es', label: 'ES' },
  { value: 'en', label: 'EN' },
  { value: 'de', label: 'DE' },
  { value: 'fr', label: 'FR' },
];

export default function LanguageSelector() {
  const { i18n } = useTranslation();
  const currentLang = i18n.language?.split('-')[0] || 'es';

  return (
    <select
      value={currentLang}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      className="bg-slate-700 text-white text-sm rounded px-2 py-1 border border-slate-600 cursor-pointer"
    >
      {LANGUAGES.map((lang) => (
        <option key={lang.value} value={lang.value}>
          {lang.label}
        </option>
      ))}
    </select>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npm test -- LanguageSelector
```

Expected: PASS — 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/LanguageSelector.jsx frontend/src/components/LanguageSelector.test.jsx
git commit -m "feat: add LanguageSelector component"
```

---

## Task 6: Add global header to App.jsx

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Update App.jsx**

Replace the full content of `frontend/src/App.jsx` with:

```jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Cuestionario from './pages/Cuestionario.jsx';
import Resultado from './pages/Resultado.jsx';
import LanguageSelector from './components/LanguageSelector.jsx';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="flex justify-end px-6 py-3 border-b border-slate-800">
        <LanguageSelector />
      </div>
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

- [ ] **Step 2: Run existing tests to confirm no regressions**

```bash
cd frontend && npm test
```

Expected: all tests pass (selector test + pre-existing component tests).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: add global header with LanguageSelector to App"
```

---

## Task 7: Translate Home.jsx

**Files:**
- Modify: `frontend/src/pages/Home.jsx`

- [ ] **Step 1: Update Home.jsx**

Replace the full content of `frontend/src/pages/Home.jsx` with:

```jsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import NormativaCard from '../components/NormativaCard.jsx';
import { listarNormativas } from '../api.js';

export default function Home() {
  const { t } = useTranslation();
  const [normativas, setNormativas] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    listarNormativas()
      .then(setNormativas)
      .catch(() => setError(t('home.error_load')));
  }, [t]);

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-white mb-2">NormativaCheck</h1>
        <p className="text-slate-400 text-lg">{t('home.subtitle')}</p>
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

- [ ] **Step 2: Run tests**

```bash
cd frontend && npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Home.jsx
git commit -m "feat: translate Home page"
```

---

## Task 8: Translate Cuestionario.jsx

**Files:**
- Modify: `frontend/src/pages/Cuestionario.jsx`

- [ ] **Step 1: Update Cuestionario.jsx**

Replace the full content of `frontend/src/pages/Cuestionario.jsx` with:

```jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import BloquePreguntas from '../components/BloquePreguntas.jsx';
import { obtenerPreguntas, evaluar } from '../api.js';

export default function Cuestionario() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [cuestionario, setCuestionario] = useState(null);
  const [respuestas, setRespuestas] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    obtenerPreguntas(id)
      .then(setCuestionario)
      .catch(() => setError(t('cuestionario.error_load')));
  }, [id, t]);

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
      setError(t('cuestionario.error_send'));
      setEnviando(false);
    }
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={() => navigate('/')} className="text-blue-400 hover:text-blue-300">
          {t('cuestionario.back_home')}
        </button>
      </div>
    );
  }

  if (!cuestionario) {
    return <div className="p-8 text-center text-slate-400">{t('cuestionario.loading')}</div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate('/')}
          className="text-slate-400 hover:text-white text-sm transition-colors"
        >
          {t('cuestionario.back')}
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
            {t('cuestionario.progress', {
              answered: Object.keys(respuestas).length,
              total: totalPreguntas,
            })}
          </span>
          <button
            onClick={handleEnviar}
            disabled={!todasRespondidas || enviando}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold px-8 py-3 rounded-lg transition-colors"
          >
            {enviando ? t('cuestionario.submitting') : t('cuestionario.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run tests**

```bash
cd frontend && npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Cuestionario.jsx
git commit -m "feat: translate Cuestionario page"
```

---

## Task 9: Translate Resultado.jsx

**Files:**
- Modify: `frontend/src/pages/Resultado.jsx`

- [ ] **Step 1: Update Resultado.jsx**

Replace the full content of `frontend/src/pages/Resultado.jsx` with:

```jsx
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();

  if (!state?.resultado) {
    navigate('/', { replace: true });
    return null;
  }

  const { resultado } = state;
  const colores = coloresPorNivel(resultado.nivel_cumplimiento);

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-white mb-8">{t('resultado.title')}</h1>

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
            {t('resultado.level', { nivel: resultado.nivel_cumplimiento })}
          </div>
          <p className="text-slate-400 text-sm">
            {t('resultado.questions_evaluated', { count: resultado.preguntas_evaluadas })}
          </p>
          {resultado.remediaciones.length === 0 && (
            <p className="text-green-400 text-sm mt-2 font-medium">
              {t('resultado.full_compliance')}
            </p>
          )}
        </div>
      </div>

      {resultado.remediaciones.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-white mb-4">
            {t('resultado.remediations', { count: resultado.remediaciones.length })}
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
        {t('resultado.back_home')}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Run tests**

```bash
cd frontend && npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Resultado.jsx
git commit -m "feat: translate Resultado page"
```

---

## Task 10: Translate BloquePreguntas.jsx

**Files:**
- Modify: `frontend/src/components/BloquePreguntas.jsx`

- [ ] **Step 1: Update BloquePreguntas.jsx**

Replace the full content of `frontend/src/components/BloquePreguntas.jsx` with:

```jsx
import { useTranslation } from 'react-i18next';

const OPCIONES = [
  { valor: 'si', labelKey: 'options.yes', activa: 'bg-green-600 hover:bg-green-700 text-white ring-2 ring-white ring-offset-2 ring-offset-slate-800' },
  { valor: 'parcialmente', labelKey: 'options.partial', activa: 'bg-yellow-500 hover:bg-yellow-600 text-white ring-2 ring-white ring-offset-2 ring-offset-slate-800' },
  { valor: 'no', labelKey: 'options.no', activa: 'bg-red-600 hover:bg-red-700 text-white ring-2 ring-white ring-offset-2 ring-offset-slate-800' },
];

const INACTIVA = 'bg-slate-600 hover:bg-slate-500 text-slate-300';

export default function BloquePreguntas({ bloque, respuestas, onRespuesta }) {
  const { t } = useTranslation();

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
                    {t(opcion.labelKey)}
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

- [ ] **Step 2: Run tests**

```bash
cd frontend && npm test
```

Expected: all tests pass. The existing BloquePreguntas test checks for "Sí"/"Parcialmente"/"No" which are the ES default translations — they still match.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/BloquePreguntas.jsx
git commit -m "feat: translate BloquePreguntas component"
```

---

## Task 11: Translate NormativaCard.jsx

**Files:**
- Modify: `frontend/src/components/NormativaCard.jsx`

- [ ] **Step 1: Update NormativaCard.jsx**

Replace the full content of `frontend/src/components/NormativaCard.jsx` with:

```jsx
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function NormativaCard({ normativa }) {
  const navigate = useNavigate();
  const { t } = useTranslation();

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
      <p className="text-blue-400 text-sm font-medium">
        {t('card.questions', { count: normativa.total_preguntas })}
      </p>
    </button>
  );
}
```

- [ ] **Step 2: Run tests**

```bash
cd frontend && npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/NormativaCard.jsx
git commit -m "feat: translate NormativaCard component"
```

---

## Task 12: Translate RemediacionItem.jsx

**Files:**
- Modify: `frontend/src/components/RemediacionItem.jsx`

- [ ] **Step 1: Update RemediacionItem.jsx**

Replace the full content of `frontend/src/components/RemediacionItem.jsx` with:

```jsx
import { useTranslation } from 'react-i18next';

export default function RemediacionItem({ item }) {
  const { t } = useTranslation();
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
          {esPrioritario ? t('remediation.priority') : t('remediation.recommended')}
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
          {t('remediation.answered', {
            value: item.valor === 'parcialmente'
              ? t('remediation.value_partial')
              : t('remediation.value_no'),
          })}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run all tests**

```bash
cd frontend && npm test
```

Expected: all tests pass.

- [ ] **Step 3: Final commit**

```bash
git add frontend/src/components/RemediacionItem.jsx
git commit -m "feat: add multilanguage support (ES, EN, DE, FR)"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** All keys from spec mapped — home, cuestionario, resultado, options, card, remediation. LanguageSelector in upper-right via App.jsx global header. Dependencies in package.json. ✓
- [x] **No placeholders:** All steps have complete code blocks. ✓
- [x] **Type consistency:** `labelKey` used in OPCIONES (Task 10), `t(opcion.labelKey)` used in render — consistent. `i18n.language.split('-')[0]` used in LanguageSelector — consistent with init. ✓
- [x] **Test coverage:** LanguageSelector has its own test file. setupTests.js imports i18n so existing tests see default ES translations and don't break. ✓
