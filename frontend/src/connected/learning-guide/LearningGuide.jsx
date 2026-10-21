import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { CHAPTERS, chaptersFor, hasArrived } from './catalog';
import { readProgress, setStep, writeProgress } from './progress';
import './learning-guide.css';
import { PracticeProvider, FirstSteps } from './Practice';

const GuideContext = createContext(null);

// Register refs, never CSS selectors derived from business data. Outside the
// provider this hook is deliberately inert (isolated screens/tests still work).
export function useLearningSurface(descriptor) {
  const context = useContext(GuideContext);
  const root = useRef(null), live = useRef(descriptor);
  live.current = descriptor;
  const register = context?.register;
  const { id, kind, chapter, section, scope, role, ready = true, allowed = false, priority = 1 } = descriptor;
  useEffect(() => {
    if (!register) return undefined;
    return register({ id, kind, chapter, section, scope, role, ready, allowed, priority, root,
      practiceScope:descriptor.practiceScope,
      heading:() => live.current.heading?.current || root.current,
      navigate:next => live.current.navigate?.(next) });
  }, [register, id, kind, chapter, section, scope, role, ready, allowed, priority, descriptor.practiceScope]);
  return root;
}

export function LearningRouteSurface({ children }) {
  const { pathname } = useLocation();
  const { phase } = useAuth();
  const chapter = pathname === '/settings' ? 'account' : pathname === '/historial' ? 'history'
    : /^\/historial\/[^/]+\/?$/.test(pathname) ? 'result'
      : /^\/pds\/[^/]+\/?$/.test(pathname) ? 'plan' : null;
  const root = useLearningSurface({ id:'route', kind:'route', chapter, ready:phase === 'authenticated' && !!chapter, allowed:true });
  return <div ref={root} className="learning-route-surface" tabIndex={-1}>{children}</div>;
}

export default function LearningGuideProvider({ children }) {
  const auth = useAuth();
  const [surfaces, setSurfaces] = useState(() => new Map());
  const register = useCallback(surface => {
    const token = Symbol(surface.id);
    setSurfaces(old => new Map(old).set(token, surface));
    return () => setSurfaces(old => { const next = new Map(old); next.delete(token); return next; });
  }, []);
  const context = useMemo(() => ({ register }), [register]);
  return <GuideContext.Provider value={context}>
    <PracticeProvider key={auth.user?.id || 'anonymous'}><GuideSession key={auth.user?.id || 'anonymous'} auth={auth} surfaces={surfaces}>{children}</GuideSession></PracticeProvider>
  </GuideContext.Provider>;
}

function Compass() {
  return <svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><circle cx="16" cy="16" r="13"/><path d="m21 11-3 7-7 3 3-7z"/><circle cx="16" cy="16" r="1"/></svg>;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(!!media?.matches);
    update(); media?.addEventListener?.('change', update);
    return () => media?.removeEventListener?.('change', update);
  }, []);
  return reduced;
}

function GuideSession({ auth, surfaces, children }) {
  const route = useNavigate(), location = useLocation();
  const reduced = useReducedMotion();
  const [practice, setPractice] = useState(false);
  const [open, setOpen] = useState(false), [menu, setMenu] = useState(true);
  const [chapterId, setChapterId] = useState(null), [index, setIndex] = useState(0);
  const [pending, setPending] = useState(null), [notice, setNotice] = useState('');
  const [saved, setSaved] = useState(null);
  const title = useRef(null), launcher = useRef(null), returnFocus = useRef(null);
  const wasVisible = useRef(false);
  const priorScope = useRef(null), priorGeneration = useRef(auth.generation), priorPath = useRef(location.pathname);
  const authenticated = auth.phase === 'authenticated' && !!auth.user?.id;
  const surface = [...surfaces.values()].filter(item => item.ready).sort((a,b) => b.priority - a.priority)[0] || null;
  const chapters = chaptersFor(surface);
  const chapter = chapters.find(item => item.id === chapterId);
  const step = chapter?.steps[index];
  const arrived = !!chapter && hasArrived(chapter, surface);
  const visible = open && authenticated && !!surface;
  const target = step?.target === 'heading' ? surface?.heading() : surface?.root.current;

  const persist = useCallback((id, status) => {
    setSaved(old => {
      const current = old || readProgress(auth.user?.id);
      const value = setStep(current.value, id, status);
      return { value, persistent:writeProgress(auth.user?.id, value) };
    });
  }, [auth.user?.id]);

  // A session lock, permission epoch or company change pauses, never navigates
  // back or replays an action. The app owns drafts and session recovery.
  useEffect(() => {
    if (!authenticated || priorGeneration.current !== auth.generation) {
      setOpen(false); setPending(null); setSaved(null);
    }
    priorGeneration.current = auth.generation;
  }, [authenticated, auth.generation]);
  const scope = surface?.scope || null;
  useEffect(() => {
    if (priorScope.current && scope && priorScope.current !== scope) {
      setOpen(false); setPending(null); setNotice('La empresa o sus permisos han cambiado. Puedes retomar la guía para este espacio.');
    }
    if (scope) priorScope.current = scope;
  }, [scope]);
  useEffect(() => {
    if (priorPath.current !== location.pathname) {
      // Manual route changes do not keep explaining the previous page.
      if (!pending) setMenu(true);
      priorPath.current = location.pathname;
    }
  }, [location.pathname, pending]);

  useEffect(() => {
    if (!pending) return undefined;
    const intended = CHAPTERS.find(item => item.id === pending.chapterId);
    if (hasArrived(intended, surface)) {
      setChapterId(pending.chapterId); setIndex(pending.index); setMenu(false); setNotice(''); setPending(null);
      return undefined;
    }
    const timer = setTimeout(() => {
      setPending(null);
      setNotice('No hemos llegado a esa sección. Si has cancelado la salida, tu borrador sigue en su sitio. Puedes reintentar o elegir otro capítulo.');
    }, 8000);
    return () => clearTimeout(timer);
  }, [pending, surface]);

  useEffect(() => {
    if (visible && !practice && !menu && !pending && arrived && step) persist(step.id, 'visited');
  }, [visible, practice, menu, pending, arrived, step, persist]);

  useEffect(() => {
    if (visible) title.current?.focus({ preventScroll:true });
  }, [visible, practice, menu, chapterId, index]);
  const close = useCallback(() => {
    setOpen(false); setPending(null);
  }, []);
  useEffect(() => {
    if (wasVisible.current && !visible && authenticated) {
      const element = returnFocus.current;
      if (element?.isConnected && element !== document.body && !element.closest('[hidden], [inert]')) element.focus({ preventScroll:true });
      else launcher.current?.focus({ preventScroll:true });
    }
    wasVisible.current = visible;
  }, [visible, authenticated]);
  useEffect(() => {
    if (!visible) return undefined;
    const escape = event => {
      // The application's own confirmation/security dialogs get first refusal.
      if (event.key === 'Escape' && !event.defaultPrevented && !document.querySelector('dialog[open]')) {
        event.preventDefault(); close();
      }
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [visible, close]);
  useEffect(() => {
    if (!visible || practice || menu || pending || !arrived || !target || target.closest('[hidden], [inert]')) return undefined;
    target.classList.add('learning-guide-target');
    return () => target.classList.remove('learning-guide-target');
  }, [visible, practice, menu, pending, arrived, target, step]);

  function start(event, firstSteps = false) {
    returnFocus.current = event?.currentTarget || document.activeElement;
    if (!saved) setSaved(readProgress(auth.user.id));
    setPractice(firstSteps); setOpen(true); setMenu(true); setNotice('');
  }
  function go(nextChapter, nextIndex = 0) {
    if (!authenticated || !chapters.some(item => item.id === nextChapter.id)) return;
    setNotice('');
    if (hasArrived(nextChapter, surface)) {
      setPending(null); setChapterId(nextChapter.id); setIndex(nextIndex); setMenu(false);
    } else if (nextChapter.section) {
      // Existing workspace adapter returns false when draft discard is cancelled.
      if (surface?.navigate(nextChapter.section) === true) setPending({ chapterId:nextChapter.id, index:nextIndex });
      else setNotice('Sigues en tu pantalla actual. No se ha cambiado el capítulo ni el borrador.');
    } else if (nextChapter.path) {
      setPending({ chapterId:nextChapter.id, index:nextIndex });
      route(nextChapter.path); // Existing DraftNavigationGuard decides; no bypass.
    }
  }
  function showTarget() {
    if (!target || !arrived || target.closest('[hidden], [inert]')) return;
    target.scrollIntoView?.({ behavior:reduced ? 'auto' : 'smooth', block:'center' });
    // A container can be focused without changing input values or clicking it.
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll:true });
  }
  const lastId = saved?.value.lastStep;
  const lastChapter = chapters.find(item => item.steps.some(s => s.id === lastId));
  const knownSteps = chapters.flatMap(item => item.steps);
  const understood = knownSteps.filter(s => saved?.value.steps[s.id] === 'understood').length;
  const skipped = knownSteps.filter(s => saved?.value.steps[s.id] === 'skipped').length;
  const status = { visited:'Visto', understood:'Comprendido por ti', skipped:'Omitido' };

  return <div className={`learning-layout${visible ? ' learning-layout--open' : ''}`}>
    <div className="learning-app-content">{children}</div>
    {authenticated && surface && !visible && <div className="learning-launchers"><button className="learning-launcher" onClick={event => start(event,true)}><Compass/>Tus primeros pasos</button><button ref={launcher} className="learning-launcher learning-secondary-launcher" onClick={event => start(event)}>Guía de uso</button></div>}
    {authenticated && <aside hidden={!visible} className="learning-panel" aria-labelledby="learning-title">
      <header><span className="learning-symbol"><Compass/></span><div><span className="learning-eyebrow">APRENDE A UTILIZAR TU ESPACIO</span><h2 id="learning-title" ref={title} tabIndex={-1}>{practice ? 'Tus primeros pasos' : menu ? 'Elige qué quieres aprender' : chapter?.title || 'Guía de uso'}</h2></div>
        <button className="learning-close" aria-label="Cerrar y pausar la guía" onClick={close}>×</button></header>
      <FirstSteps active={practice && visible} surface={surface} userId={auth.user?.id} reduced={reduced} onChapters={() => {setPractice(false);setMenu(true);}}/>
      <div hidden={practice}>
      <button className="learning-primary" onClick={() => {setPractice(true);setPending(null);}}>Empezar «Tus primeros pasos»</button>
      <p className="learning-intro">Tú decides el ritmo. Puedes usar la pantalla, saltar capítulos y volver después. La guía no guarda ni modifica tu trabajo.</p>
      <p className="learning-storage">{saved?.persistent ? 'Progreso guardado solo en este navegador; no se sincroniza.' : 'Progreso solo en esta sesión de la guía: el almacenamiento no está disponible o el registro anterior no era válido.'}</p>
      <p className="learning-summary">{understood} de {knownSteps.length} objetivos marcados como comprendidos{skipped ? ` · ${skipped} omitidos` : ''}, en los capítulos disponibles aquí. No mide cumplimiento normativo.</p>
      {notice && <p className="learning-notice" role="status">{notice}</p>}
      {pending && <div className="learning-notice" role="status"><p>Esperando la sección. Si hay un aviso de cambios sin guardar, decide en ese aviso.</p><button onClick={() => { setPending(null); setMenu(true); }}>Volver a capítulos</button></div>}
      {menu ? <>
        {lastChapter && <button className="learning-primary" onClick={() => go(lastChapter, lastChapter.steps.findIndex(s => s.id === lastId))}>Retomar donde lo dejé</button>}
        <nav aria-label="Capítulos de aprendizaje"><ol className="learning-chapters">{chapters.map(item => <li key={item.id}><button disabled={!!pending} onClick={() => go(item)}><span>{item.group}</span><strong>{item.title}</strong><small>{item.steps.filter(s => saved?.value.steps[s.id] === 'understood').length} / {item.steps.length} comprendidos</small></button></li>)}</ol></nav>
      </> : chapter && step ? <>
        <button className="learning-back" onClick={() => { setPending(null); setMenu(true); }}>← Todos los capítulos</button>
        <section className="learning-step" key={step.id} aria-labelledby="learning-step-title">
          <p className="learning-step-count" aria-live="polite">Objetivo {index + 1} de {chapter.steps.length} · {status[saved?.value.steps[step.id]] || 'Por explorar'}</p>
          <h3 id="learning-step-title">{step.title}</h3><p>{step.text}</p><p className="learning-goal">{step.goal}</p>
          {!arrived && <p role="status">Has cambiado de sección. Vuelve al capítulo para continuar o elige otro; no marcamos pasos automáticamente.</p>}
          <div className="learning-actions"><button disabled={!arrived || !!pending} onClick={showTarget}>Mostrar la zona</button>
            <button className="learning-primary" disabled={!arrived || !!pending} onClick={() => persist(step.id, 'understood')}>Lo he comprendido</button>
            <button disabled={!arrived || !!pending} onClick={() => { persist(step.id, 'skipped'); index + 1 < chapter.steps.length ? go(chapter, index + 1) : setMenu(true); }}>Omitir este objetivo</button></div>
        </section>
        <div className="learning-paging"><button disabled={index === 0 || !!pending} onClick={() => go(chapter, index - 1)}>Anterior</button>{index + 1 < chapter.steps.length
          ? <button disabled={!!pending} onClick={() => go(chapter, index + 1)}>Siguiente objetivo →</button>
          : <button onClick={() => setMenu(true)}>Elegir otro capítulo →</button>}</div>
      </> : <button onClick={() => setMenu(true)}>Ver capítulos disponibles</button>}
      </div>
      <footer><button onClick={close}>Pausar y seguir trabajando</button><p>Completar la guía es una declaración de aprendizaje, no una certificación. Los permisos y las acciones siguen siendo los de la aplicación.</p></footer>
    </aside>}
  </div>;
}
