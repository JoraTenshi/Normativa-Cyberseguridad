# Multilanguage Support (i18n) — NormativaCheck Frontend

**Date:** 2026-05-13  
**Status:** Approved

## Overview

Add internationalization (i18n) to the NormativaCheck React frontend using `i18next` and `react-i18next`. Supported languages: Spanish (default), English, German, French. A language selector is visible in the upper right corner on all screens.

## Dependencies

Add to `frontend/package.json` dependencies:
- `i18next` — core i18n engine
- `react-i18next` — React bindings (`useTranslation` hook, `<Trans>` component)
- `i18next-browser-languagedetector` — detects and persists language via `localStorage`

## File Structure

```
frontend/src/i18n/
  index.js          # i18next initialization
  locales/
    es.json         # Spanish (default)
    en.json         # English
    de.json         # German
    fr.json         # French
```

## i18n Initialization (`src/i18n/index.js`)

- Import and configure i18next with `initReactI18next` and `LanguageDetector`
- Default language: `es`
- Fallback language: `es`
- Load all 4 locale JSON files statically (no lazy loading needed at this scale)
- Detection order: `localStorage`, then `navigator`
- Cache selected language to `localStorage`

## Translation Keys

All keys use a flat namespace structure. Keys are grouped by component for readability.

### Home
| Key | ES |
|---|---|
| `home.subtitle` | Evalúa el cumplimiento normativo de ciberseguridad de tu organización |
| `home.error_load` | No se pudieron cargar las normativas. |

### Cuestionario
| Key | ES |
|---|---|
| `cuestionario.loading` | Cargando cuestionario... |
| `cuestionario.error_load` | No se pudo cargar el cuestionario. |
| `cuestionario.error_send` | Error al enviar el cuestionario. Inténtalo de nuevo. |
| `cuestionario.back_home` | ← Volver al inicio |
| `cuestionario.back` | ← Volver |
| `cuestionario.progress` | `{{answered}} / {{total}} respondidas` |
| `cuestionario.submit` | Evaluar |
| `cuestionario.submitting` | Evaluando... |

### Resultado
| Key | ES |
|---|---|
| `resultado.title` | Resultado de evaluación |
| `resultado.level` | Nivel {{nivel}} |
| `resultado.questions_evaluated` | `{{count}} preguntas evaluadas` |
| `resultado.full_compliance` | ¡Cumplimiento completo! No hay remediaciones pendientes. |
| `resultado.remediations` | Remediaciones ({{count}}) |
| `resultado.back_home` | ← Volver al inicio |

### BloquePreguntas
| Key | ES |
|---|---|
| `options.yes` | Sí |
| `options.partial` | Parcialmente |
| `options.no` | No |

### NormativaCard
| Key | ES |
|---|---|
| `card.questions` | `{{count}} preguntas →` |

### RemediacionItem
| Key | ES |
|---|---|
| `remediation.priority` | Prioritario |
| `remediation.recommended` | Recomendado |
| `remediation.answered` | Respondido: {{value}} |
| `remediation.value_partial` | Parcialmente |
| `remediation.value_no` | No |

## Language Selector Component

New component: `src/components/LanguageSelector.jsx`

- A `<select>` element with options: `{ value: 'es', label: 'ES' }`, `{ value: 'en', label: 'EN' }`, `{ value: 'de', label: 'DE' }`, `{ value: 'fr', label: 'FR' }`
- Uses `useTranslation` to call `i18n.changeLanguage(value)` on change
- Styled with Tailwind: `bg-slate-700 text-white text-sm rounded px-2 py-1 border border-slate-600`
- Reflects current language as selected option

## Global Header in App.jsx

`App.jsx` gains a thin top bar:
```
<div className="min-h-screen bg-slate-900 text-white">
  <div className="flex justify-end px-6 py-3 border-b border-slate-800">
    <LanguageSelector />
  </div>
  <Routes>...</Routes>
</div>
```

This ensures the selector is visible on every screen without modifying each page.

## main.jsx

Import `src/i18n/index.js` before `<App />` renders so i18next is initialized before any component mounts.

## Scope

- All UI strings in Home, Cuestionario, Resultado, BloquePreguntas, NormativaCard, RemediacionItem are translated.
- Content served by the API (normativa names, question text, remediation text) is **not** translated — that is backend data outside this scope.
- No changes to routing, API layer, or test files.
