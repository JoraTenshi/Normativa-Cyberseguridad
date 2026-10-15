/* eslint-disable no-restricted-globals -- isolated imported public demonstration */
import React, { Component, Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AUDIENCES, TYPE_START, advanceType, typeDelay, isDemoHash, STORY, anchorBehavior } from './landing-model.js';
import { FlowMap, PhaseVisual, ProductVisual, QuestionScreen, useReducedMotion } from './Visuals';
import './landing.css';
import './landing-typography.css';
import './journey-readability.css';
import './marketing.css';
import './journey-flow.css';
import CloseIcon from './CloseIcon';
const Demo = lazy(() => import('./Demo.jsx'));

export function Icon({ name = 'arrow', size = 20 }) {
  const paths = {
    arrow: <path d="M5 12h14M13 6l6 6-6 6"/>,
    down: <path d="M12 4v16M6 14l6 6 6-6"/>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.arrow}</svg>;
}
function Brand() {
  return <a href="#inicio" className="nc-brand" aria-label="NormativaCheck, inicio"><span className="nc-symbol" aria-hidden="true"><span className="nc-mark">n</span><span className="brand-check"><svg viewBox="0 0 20 20"><path d="m4 10 4 4 8-9"/></svg></span></span>Normativa<span className="brand-light">Check</span></a>;
}
function Typewriter({ reduce }) {
  const [state, setState] = useState(TYPE_START);
  const [rest, setRest] = useState(false);
  useEffect(() => {
    if (reduce || rest) return;
    const timer = setTimeout(() => setState(advanceType), typeDelay(state));
    return () => clearTimeout(timer);
  }, [state, reduce, rest]);
  return <div className="audience-line" onMouseEnter={() => setRest(true)} onMouseLeave={() => setRest(false)}>
    <span>Para </span><span className="type-space" aria-hidden="true">{reduce ? AUDIENCES[0] : AUDIENCES[state.word].slice(0, state.count)}<i className={reduce || rest ? 'cursor still' : 'cursor'}/></span>
    <span className="visually-hidden">{AUDIENCES.join(', ')}.</span>
  </div>;
}
function Story({ reduce }) {
  return <section className="home-story section-shell" id="como-funciona" aria-labelledby="story-heading">
    <div className="section-heading"><span className="eyebrow">CÓMO FUNCIONA</span><h2 id="story-heading">De conocer tu empresa<br/><em>a organizar su revisión.</em></h2><p className="section-note">Explora las tres fases con situaciones ficticias. Puedes cambiar de actividad en cada pantalla.</p></div>
    <div className="phase-list">{STORY.map((step, i) => <article className="phase-row" id={'fase-' + (i + 1)} key={step.label}>
      <div className="phase-copy"><span className="step-index"><b>{'0' + (i + 1)}</b>{step.label}</span><h3>{step.title}</h3><p>{step.text}</p><ul>{step.points.map(point => <li key={point}>{point}</li>)}</ul></div>
      <PhaseVisual phase={i} reduce={reduce}/>
    </article>)}</div>
  </section>;
}
const INFO = {
  privacidad: ['Tu privacidad en la demo', 'La demo utiliza una empresa ficticia. Los cambios que hagas se conservan en este navegador; no se envían documentos, contraseñas ni datos de tu empresa.', 'No introduzcas información personal o confidencial.'],
  cookies: ['Almacenamiento de la demo', 'Se guarda tu progreso en este navegador. La demo no utiliza cookies publicitarias ni analítica de terceros.'],
  legal: ['Sobre esta demostración', 'NormativaCheck nace como un proyecto académico. La demo utiliza una empresa ficticia y está separada del acceso a tu cuenta y del espacio de tu organización.', 'Organizar documentos y actuaciones no equivale a una evaluación de conformidad ni a una certificación.'],
};
function InfoDialog({ topic, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const el = ref.current;
    el.showModal();
    return () => { if (el.open) el.close(); previous?.focus?.(); };
  }, []);
  const [title, ...paragraphs] = INFO[topic];
  return <dialog className="home-dialog" ref={ref} onCancel={onClose} aria-labelledby="info-title">
    <button className="dialog-close nc-close-control" aria-label="Cerrar información" onClick={onClose}><CloseIcon/></button>
    <h2 id="info-title">{title}</h2>{paragraphs.map(p => <p key={p}>{p}</p>)}
    <div className="dialog-actions"><button className="home-btn secondary" onClick={onClose}>Volver</button><a className="home-btn primary" href="#/demo" onClick={onClose}>Explorar la demo <Icon/></a></div>
  </dialog>;
}
function Home() {
  const reduce = useReducedMotion();
  const [topic, setTopic] = useState(null);
  const [menu, setMenu] = useState(false);
  const links = [['quienes-somos','Quiénes somos'],['producto','El producto'],['como-funciona','Cómo funciona'],['preguntas','Preguntas frecuentes']];
  function followSection(event) {
    if(event.defaultPrevented || event.button!==0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const link=event.target.closest('a[href^="#"]');
    const next=link?.getAttribute('href');
    if(!next || isDemoHash(next) || !document.getElementById(next.slice(1))) return;
    event.preventDefault();
    if(location.hash===next) document.getElementById(next.slice(1)).scrollIntoView({behavior:anchorBehavior(reduce),block:'start'});
    else { history.pushState(null,'',next); window.dispatchEvent(new HashChangeEvent('hashchange')); }
  }
  return <div className={'nc-home' + (reduce ? ' motion-off' : '')} onClickCapture={followSection}>
    <a className="home-skip" href="#principal" onClick={() => document.getElementById('principal')?.focus({preventScroll:true})}>Saltar al contenido</a>
    <header className="home-header" id="inicio">
      <Brand/><nav id="home-navigation" className={'home-nav' + (menu ? ' open' : '')} aria-label="Navegación principal">{links.map(([id,label]) => <a href={'#' + id} key={id} onClick={() => setMenu(false)}>{label}</a>)}</nav>
      <button className="mobile-menu nc-close-control" aria-label={menu ? 'Cerrar menú' : 'Abrir menú'} aria-controls="home-navigation" aria-expanded={menu} onClick={() => setMenu(v => !v)}>{menu ? <CloseIcon/> : '☰'}</button>
    </header>
    <main id="principal" tabIndex={-1}>
      <section className="home-hero" aria-labelledby="hero-title">
        <div className="hero-copy"><span className="eyebrow">PARA PEQUEÑAS EMPRESAS DE SOFTWARE Y CIBERSEGURIDAD</span><h1 id="hero-title">Pon en orden los requisitos de seguridad <em>de tu empresa.</em></h1>
          <Typewriter reduce={reduce}/>
          <p className="hero-description">Conecta los requisitos de la normativa y de tus clientes con los documentos, tareas y responsables de tu equipo. Ten claro qué está preparado, qué falta y qué necesita revisión.</p>
          <div className="hero-actions"><a href="#/demo" className="home-btn primary">Explorar la demo <Icon/></a><a href="#como-funciona" className="home-btn secondary">Ver cómo funciona <Icon name="down" size={18}/></a></div>
          <p className="hero-demo-note">Demostración con una empresa ficticia. No necesitas registrarte ni aportar documentos de tu empresa.</p>
        </div>
        <FlowMap reduce={reduce}/>
      </section>
      <section className="home-product" id="producto">
        <div className="section-shell"><div className="section-heading"><span className="eyebrow">EL PRODUCTO</span><h2>Requisitos, documentos y tareas<br/><em>conectados en un mismo espacio.</em></h2><p className="product-intro">Organiza lo que debes revisar según tus servicios, tus compromisos con clientes y los marcos de seguridad que adoptes. Relaciona cada requisito con su documentación y el trabajo necesario para revisarlo.</p><p className="section-note">Las pantallas siguientes muestran situaciones ficticias para explorar esa forma de trabajar.</p></div>
          <div className="product-rows">
            <article className="product-row"><div className="product-copy"><span className="step-index">01 / REQUISITOS Y COMPROMISOS</span><h3>Entiende por qué debes revisar cada requisito.</h3><p>Una obligación legal, un compromiso con tu cliente y un marco voluntario no son lo mismo. Consulta su origen junto al trabajo que necesitas organizar.</p><p>Protección de datos cuando tratas información personal; ENS si tu servicio entra en su ámbito; condiciones de seguridad que hayas acordado con tus clientes.</p><a className="text-link" href="#/demo/fundamento">Ver un requisito y su tarea <Icon/></a></div><ProductVisual kind="basis" reduce={reduce}/></article>
            <article className="product-row"><div className="product-copy"><span className="step-index">02 / DOCUMENTACIÓN</span><h3>Cada documento, vinculado a lo que necesitas demostrar.</h3><p>Consulta para qué sirve, qué versión está en revisión y qué información falta. Relaciónalo con el requisito y la tarea correspondiente.</p><a className="text-link" href="#/demo/documento">Revisar un documento <Icon/></a></div><ProductVisual kind="documents"/></article>
            <article className="product-row"><div className="product-copy"><span className="step-index">03 / SEGUIMIENTO</span><h3>Qué falta, quién lo lleva y qué ha cambiado.</h3><p>Relaciona las actuaciones con sus requisitos, asigna un responsable y conserva cada cambio de estado con su motivo. Recupera las decisiones anteriores sin reconstruirlas entre mensajes.</p><a className="text-link" href="#/demo/tarea">Ver el trabajo y sus cambios <Icon/></a></div><ProductVisual kind="history"/></article>
          </div>
        </div>
      </section>
      <Story reduce={reduce}/>
      <section className="about-section section-shell" id="quienes-somos">
        <div className="about-copy"><span className="eyebrow">QUIÉNES SOMOS</span><h2>Creamos NormativaCheck para ordenar <em>un problema que conocemos de cerca.</em></h2><p>NormativaCheck nace como proyecto de un equipo de cinco personas en un máster de ciberseguridad. Estamos desarrollando una herramienta para ayudar a pequeñas empresas tecnológicas a organizar sus requisitos, documentación y trabajo pendiente.</p></div>
        <div className="about-visual" aria-label="Nuestro enfoque: contexto, criterio y trabajo">
          <div className="team-symbols" aria-hidden="true"><span>01</span><span>02</span><span>03</span><span>04</span><span>05</span></div>
          <strong>Un equipo.<br/>Un problema compartido.</strong><blockquote>Que saber qué falta no dependa de buscar entre carpetas, correos y conversaciones.</blockquote><div className="about-values"><span>Contexto</span><span>Criterio</span><span>Seguimiento</span></div>
        </div>
      </section>
      <section className="demo-invitation" id="demostracion">
        <div className="demo-invite-copy"><span className="eyebrow">SITUACIONES QUE RECONOCES</span><h2>De una pregunta concreta<br/><em>al trabajo que hay detrás.</em></h2><p>Un cliente pide evidencias. Tu equipo necesita revisar accesos. Hay que comprobar una recuperación. Elige una situación y abre la tarea relacionada en el espacio de trabajo.</p><p className="section-note">Estos casos se exploran con los datos ficticios de Linde Studio.</p></div>
        <QuestionScreen reduce={reduce}/>
      </section>
      <section className="home-faq section-shell" id="preguntas"><div><span className="eyebrow">PREGUNTAS FRECUENTES</span><h2>Lo importante,<br/><em>sin letra pequeña.</em></h2></div><div className="faq-items">{[
        ['¿Para qué empresas está pensado?', 'Para pequeñas empresas de software y ciberseguridad: desarrollo a medida, SaaS, consultoría, pentesting, SOC, servicios gestionados, integración y soporte. Puedes combinar actividades; trabajar para clientes públicos o privados añade contexto, no te obliga a elegir un único tipo de empresa.'],
        ['¿Tengo que saber de normativa para empezar?', 'No necesitas conocer cada norma. El punto de partida es lo que hace tu empresa: sus servicios, productos, clientes y formas de trabajar. Cuando un dato no está claro, se identifica como una cuestión por resolver.'],
        ['¿Qué puedo probar en la demo?', 'Puedes consultar el caso de Linde Studio, abrir una tarea y su fundamento, leer documentación, cambiar responsables y estados, y consultar el histórico. El espacio utiliza datos ficticios y conserva los cambios en este navegador.'],
        ['¿NormativaCheck certifica el cumplimiento de mi empresa?', 'No. Te ayuda a organizar requisitos, documentación y trabajo pendiente. Esa preparación no equivale por sí sola a una evaluación de conformidad ni a una certificación.'],
        ['¿En qué se diferencia la demo del espacio de mi empresa?', 'La demo usa datos ficticios guardados solo en este navegador. El espacio de empresa requiere una cuenta verificada y una solicitud de alta aprobada. Sus documentos y actuaciones se guardan en el servidor según tus permisos. Las fechas y herramientas colaborativas de la demo no están todas disponibles en el espacio real. No se analizan documentos con IA.'],
        ['¿Tengo que aportar documentos de mi empresa para probarlo?', 'No. La demo ya incluye documentos con los que puedes familiarizarte con el producto. No introduzcas información personal ni documentos confidenciales.'],
      ].map(([q,a]) => <details key={q}><summary>{q}<span aria-hidden="true">+</span></summary><p>{a}</p></details>)}</div></section>
      <section className="signup-section section-shell" id="registro"><div><span className="eyebrow">SI TE HA INTERESADO</span><h2>El siguiente paso,<br/><em>con tu empresa.</em></h2><p>Crea tu cuenta, confirma tu correo y solicita el espacio de tu empresa. El acceso a la organización requiere una aprobación.</p></div><div className="signup-actions"><Link to="/auth?modo=registro" className="home-btn primary">Regístrate <Icon/></Link><Link to="/auth" className="text-link">Ya tengo cuenta →</Link></div></section>
    </main>
    <footer className="home-footer"><div className="footer-main">
      <div className="footer-brand"><Brand/><p>Requisitos, documentación<br/>y trabajo, conectados.</p></div>
      <div><h3>NormativaCheck</h3><a href="#quienes-somos">Quiénes somos</a><a href="#producto">El producto</a><a href="#como-funciona">Cómo funciona</a></div>
      <div><h3>Descubre</h3><a href="#/demo">Explorar la demo</a><a href="#demostracion">Casos de uso</a><Link to="/auth">Accede a tu cuenta</Link><a href="#preguntas">Preguntas frecuentes</a></div>
      <div><h3>Sobre la demo</h3><button onClick={() => setTopic('privacidad')}>Privacidad en la demo</button><button onClick={() => setTopic('cookies')}>Almacenamiento local</button><button onClick={() => setTopic('legal')}>Información de la demostración</button></div>
    </div><div className="footer-bottom"><span>© 2026 NormativaCheck</span><a href="#inicio">Volver arriba ↑</a></div></footer>
    {topic && <InfoDialog topic={topic} onClose={() => setTopic(null)}/>}
  </div>;
}
class DemoBoundary extends Component {
  state = { failed:false };
  static getDerivedStateFromError() { return { failed:true }; }
  render() {
    if (this.state.failed) return <div className="demo-load-error" role="alert"><span className="error-symbol" aria-hidden="true">↻</span><h1>No hemos podido abrir la demo.</h1><p>Comprueba la conexión y vuelve a intentarlo. Puedes regresar a la portada sin perder los cambios que ya habías guardado.</p><div><a href="#inicio" className="home-btn primary">Volver a la portada</a><button className="home-btn secondary" onClick={() => window.location.reload()}>Recargar</button></div></div>;
    return this.props.children;
  }
}
export default function PublicExperience() {
  const [hash,setHash] = useState(() => location.hash);
  const demo = isDemoHash(hash);
  const wasDemo = useRef(false);
  useEffect(() => { const route = () => setHash(location.hash); window.addEventListener('hashchange',route); return () => window.removeEventListener('hashchange',route); },[]);
  useEffect(() => {
    document.title = demo ? 'Demo · NormativaCheck' : 'NormativaCheck | Requisitos de seguridad y cumplimiento para pymes tecnológicas';
    if (demo && !wasDemo.current) window.scrollTo({top:0,behavior:'instant'});
    if (!demo) requestAnimationFrame(() => {
      const behavior=anchorBehavior(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      if (!hash || hash === '#inicio') window.scrollTo({top:0,behavior});
      else document.getElementById(hash.slice(1))?.scrollIntoView({behavior,block:'start'});
    });
    wasDemo.current = demo;
  },[demo,hash]);
  return <div className={'public-experience' + (demo ? ' view-demo' : '')}>{demo ? <div className="demo-route"><DemoBoundary><Suspense fallback={<div className="demo-loading" role="status"><span className="loading-mark" aria-hidden="true">n<span>✓</span></span><p>Abriendo la demostración…</p><a href="#inicio">Volver a la portada</a></div>}><Demo/></Suspense></DemoBoundary></div> : <Home/>}</div>;
}
