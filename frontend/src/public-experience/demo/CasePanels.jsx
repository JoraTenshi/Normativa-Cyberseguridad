/* eslint-disable no-restricted-globals -- isolated imported public demonstration */
import React, { useEffect, useRef, useState } from 'react';
import { COMPANY_CASE, SCOPE_BRIEFS, DIAGNOSTIC_FACTS, CASE_HISTORY, caseTask, diagnosticCounts } from './case-content';
import { REFERENCES } from './workspace-model';
import { newestFirst } from './help-model';
import './case-panels.css';

export function CompanyContext() {
  return <div className="case-company">
    <span className="case-label">Historia del caso · información ficticia</span>
    <p>{COMPANY_CASE.story}</p>
    <h3>Qué quiere resolver</h3><p>{COMPANY_CASE.goal}</p>
    <details><summary>Equipo y reparto de responsabilidades</summary><p>{COMPANY_CASE.organisation}</p><dl>{COMPANY_CASE.people.map(([name, role]) => <div key={name}><dt>{name}</dt><dd>{role}</dd></div>)}</dl></details>
    <details><summary>Situación organizativa y punto de partida</summary><p>{COMPANY_CASE.boundaries}</p><p>{COMPANY_CASE.readiness}</p><p className="case-muted">{COMPANY_CASE.sources}</p></details>
    <details><summary>Los dos servicios, sin mezclarlos</summary>{Object.entries(SCOPE_BRIEFS).map(([id, s]) => <section key={id}><h3>{s.title}</h3><p>{s.introduction}</p><p>{s.operation}</p><p>{s.data}</p></section>)}</details>
    <p className="case-muted">Esta historia describe el escenario inicial. Editar los campos del perfil no reescribe sus muestras ni verifica datos empresariales.</p>
  </div>;
}

export function CaseSummary({ scope, onOpen }) {
  const s = SCOPE_BRIEFS[scope], counts = diagnosticCounts(scope);
  return <section className="case-summary" aria-label="Contexto del diagnóstico">
    <div><span className="case-label">Diagnóstico de partida · ejemplo</span><h2>{s.title}</h2><p>{s.subtitle}</p></div>
    <div className="case-summary-action"><span>{counts.unresolved} cuestiones por aclarar en {counts.total} temas</span><button onClick={onOpen}>Ver diagnóstico y fuentes <span aria-hidden="true">↗</span></button></div>
  </section>;
}

export function DiagnosticPanel({ scope, onDocument, onTask }) {
  const s = SCOPE_BRIEFS[scope];
  return <div className="case-diagnostic">
    <p className="case-notice">Escenario editorial fijo · no es un cuestionario procesado ni una evaluación realizada por IA. Los datos, conversaciones y documentos son ficticios.</p>
    <div className="case-diagnostic-lead"><span className="case-label">Qué estamos evaluando</span><h3>{s.title}</h3><p>{s.introduction}</p></div>
    <dl className="case-scale">{s.scale.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    <details><summary>Operación, datos y responsabilidades de este alcance</summary><p>{s.operation}</p><p>{s.data}</p><p>{s.relationships}</p></details>
    <section className="case-decision"><h3>Por dónde empezar y por qué</h3><p>{s.decision}</p><p>{s.open}</p></section>
    <div className="case-section-heading"><h3>Lo que sabemos y lo que falta aclarar</h3><span>Respuestas del escenario · 01–05 oct 2026</span></div>
    <div className="case-facts">{DIAGNOSTIC_FACTS[scope].map((f, i) => <article key={f.topic}>
      <header><span className="case-label">{String(i + 1).padStart(2,'0')} / {f.topic}</span><span className={`case-state ${f.state === 'Contradicción' ? 'is-conflict' : ''}`}>{f.state}</span></header>
      <h4>{f.question}</h4><p>{f.answer}</p><p className="case-fact-source">Origen: {f.source}</p>
      <div className="case-actions">{f.section && <button onClick={() => onDocument(f.task, f.section)}>Leer muestra de origen <span className="sr-only">de {f.topic}</span></button>}<button onClick={() => onTask(f.task)}>Abrir tarea relacionada <span className="sr-only">con {f.topic}</span></button></div>
    </article>)}</div>
    <p className="case-notice">El diagnóstico de partida no se recalcula al modificar tareas. Su finalidad es mostrar la relación entre pregunta, respuesta, fuente y actuación. Aportar una muestra o terminar una tarea no confirma automáticamente una obligación.</p>
  </div>;
}

export function TaskContext({ scope, id, onTask, onDocument }) {
  const c = caseTask(scope, id);
  return <div className="case-task-context">
    <details><summary>Situación de partida y motivo del trabajo</summary><p>{c.background}</p><p>{c.consequence}</p></details>
    <details><summary>Qué debe quedar resuelto para cerrar el trabajo</summary><ol>{c.acceptance.map(text => <li key={text}>{text}</li>)}</ol><p className="case-muted">Criterios de trabajo propuestos para este ejemplo; no son una lista legal exhaustiva ni una validación automática.</p></details>
    <details><summary>Dependencias y notas del equipo</summary><p>{c.dependency.text}</p><button className="case-inline" onClick={() => onTask(c.dependency.id)}>Abrir tarea de la que depende</button><div className="case-conversations">{c.messages.map(([author, text]) => <div key={author}><b>{author} · conversación ficticia</b><p>{text}</p></div>)}</div></details>
    <button className="case-document-link" onClick={() => onDocument(id)}>Leer documento de muestra <span aria-hidden="true">↗</span><small>{c.document.id} · {c.document.kind}</small></button>
  </div>;
}

export function SampleReader({ scope, id, initialSection = null, onTask }) {
  const c = caseTask(scope, id), sample = c.document;
  const [analysis, setAnalysis] = useState(false);
  const parts = useRef({});
  function jump(number) { const el = parts.current[number]; el?.scrollIntoView({ block: 'nearest' }); el?.focus({ preventScroll: true }); }
  useEffect(() => { if (initialSection) { const frame = requestAnimationFrame(() => jump(initialSection)); return () => cancelAnimationFrame(frame); } }, [initialSection, id, scope]);
  return <div className="case-reader">
    <div className="case-reader-heading"><span className="case-label">{sample.id} / {sample.kind}</span><h3>{sample.title}</h3><p>{sample.version}</p></div>
    <p className="case-notice">Muestra de texto redactada para la demo. No es un archivo aportado, un contrato utilizable ni una extracción de un documento real. Leerla no la añade como evidencia.</p>
    <nav className="case-reader-index" aria-label="Apartados de la muestra">{sample.sections.map(part => <button key={part.number} onClick={() => jump(part.number)}>{part.number}. {part.title}</button>)}</nav>
    <article className="case-paper" aria-label="Texto del documento de muestra">{sample.sections.map(part => <section key={part.number} tabIndex={-1} ref={el => { parts.current[part.number] = el; }}><span className="case-label">Apartado {part.number}</span><h4>{part.title}</h4><p>{part.text}</p></section>)}</article>
    <div className="case-ai-switch"><div><h3>Qué podría señalar un análisis asistido</h3><p>Resultado preparado de antemano para explorar la UX. No se llama a ningún modelo.</p></div><button className="desk-outline" aria-expanded={analysis} onClick={() => setAnalysis(!analysis)}>{analysis ? 'Ocultar análisis simulado' : 'Mostrar análisis IA simulado'}</button></div>
    {analysis && <section className="case-ai-results" aria-label="Análisis IA simulado"><p className="case-label">Simulación editorial · requiere contraste</p>{sample.findings.map((f, i) => <article key={i}><header><span className="case-state">{f.status}</span><button onClick={() => jump(f.section)}>Ver apartado {f.section}</button></header><h4>{f.title}</h4><p>{f.text}</p></article>)}<p className="case-muted">Encontrar una afirmación no prueba que sea cierta ni que una medida esté implantada. «No encontrado» tampoco demuestra que no exista en otro documento. No se genera una conclusión de cumplimiento.</p></section>}
    <footer className="case-reader-footer"><button className="desk-primary" onClick={() => onTask(id)}>Volver a la tarea de este documento</button><span>La revisión humana y la aplicabilidad siguen separadas.</span></footer>
  </div>;
}

export function CaseTimeline({ scope, onTask }) {
  return <section className="case-timeline"><h3>Antecedentes del caso</h3><p>Historia ficticia de preparación. No son eventos de otros usuarios ni un registro del servidor. Más recientes primero.</p><ol>{newestFirst(CASE_HISTORY, e => e.isoDate).map(e => <li key={e.isoDate}><time dateTime={e.isoDate}>{e.date}</time><div><b>{e.actor}</b><p>{e.text}</p><button onClick={() => onTask(e.tasks[scope])}>Ver tarea relacionada</button></div></li>)}</ol></section>;
}

export function ContextualBasis({ scope, id, referenceId }) {
  const c = caseTask(scope, id), ref = REFERENCES[referenceId];
  return <section className="case-basis-context"><h4>Cómo se traduce en este trabajo</h4><p>{c.consequence}</p><h4>Qué no permite concluir</h4><p>{ref.url ? (referenceId === 'transferencias' ? 'Hasta identificar las entidades que reciben datos, las operaciones y los destinos, este caso mantiene la cuestión abierta. La declaración de alojamiento no sustituye esa comprobación.' : ref.framework === 'NIST CSF 2.0' ? 'La adopción de este objetivo es voluntaria en la historia. Esta tarea no certifica a Linde ni significa que se haya implantado todo el marco.' : 'La referencia orienta la revisión dentro del alcance descrito. Este ejemplo no determina todas las obligaciones de la empresa ni sustituye el contraste de los hechos y del texto completo.') : 'Una cláusula propuesta no demuestra aceptación. El borrador sirve para localizar qué hay que contrastar, no para declarar incumplimientos ni compromisos vigentes.'}</p></section>;
}

export function ScopeReport({ scope, rows, onTask }) {
  const s = SCOPE_BRIEFS[scope];
  return <div className="case-report"><h3>Lectura del alcance</h3><p>{s.introduction}</p><p>{s.decision}</p><h3>Decisiones aún abiertas en el diagnóstico de partida</h3><ul>{s.pending.map(p => <li key={p}>{p}</li>)}</ul><h3>Trabajo actual y siguiente resultado</h3>{rows.map(t => <article key={t.id}><button onClick={() => onTask(t.id)}>{t.code} · {t.title}</button><p>{t.status} · {t.owner} · {t.evidence.length} documento(s) simulados, sin revisar</p><p>{t.expected}</p><small>{t.refs.map(r => `${REFERENCES[r].framework} ${REFERENCES[r].label}`).join(' / ')}</small></article>)}<p className="case-muted">El trabajo actual refleja tus cambios locales. La narración del caso es fija y no equivale a una evaluación jurídica actualizada.</p></div>;
}
