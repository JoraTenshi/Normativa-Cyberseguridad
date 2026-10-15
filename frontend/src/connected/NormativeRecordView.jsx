import React from 'react';
import { civilDate, recordedAt, sourceUrl, recordDimensions, reviewMatches } from './normative-view-model';
import { SupportRead } from './NormativeSupports';
import './normative-record.css';

// Presentation only. No API, catalogue fallback, inferred permissions or writes.
// The final API adapter must provide the exact persisted record and its references.
export default function NormativeRecordView({ ficha, decisionRecord = null, canReview = null,
  requisito = null, revision = null, revisionStatus = null, onOpenDocumentVersion, showSatisfaction = true }) {
  if (!ficha) return <section className="norm-record" aria-label="Ficha normativa"><p>No hay una ficha consultada para este requisito.</p></section>;
  const dimensions = recordDimensions({ ficha, decisionRecord, canReview, requisito, revision, revisionStatus });
  const bound = reviewMatches(ficha, decisionRecord, revision, requisito);
  const evidence = bound ? revision.evidencias || [] : [];
  const criteria = ficha.criterios || [];
  const sources = ficha.fuentes || [];
  const outside = new Map(bound ? (revision.criteriosFueraRuta || []).map(c=>[c.criterioId,c]) : []);
  const criterionResults = new Map(bound ? (revision.criterios || []).map(c => [c.criterioId, c]) : []);
  return <article className="norm-record" aria-labelledby="normative-record-title">
    <header className="norm-record-heading">
      <p className="norm-overline">UN REQUISITO · SU CONTEXTO · SU REVISIÓN</p>
      <h2 id="normative-record-title">{ficha.titulo}</h2><p>{ficha.explicacion}</p>
      <p className="norm-reference">Ficha {ficha.id} · versión {ficha.version}</p>
      {decisionRecord && <p className="norm-reference">Decisión {decisionRecord.numero} · contexto v{decisionRecord.versionContexto} · regla {decisionRecord.reglaId} v{decisionRecord.versionRegla}</p>}
    </header>
    <dl className="norm-dimensions" aria-label="Estados independientes del requisito">
      {dimensions.filter(d => showSatisfaction || d.id !== 'satisfaction').map(d => <div key={d.id} data-state={d.tone}><dt>{d.label}</dt><dd><strong>{d.value}</strong><p>{d.explanation}</p></dd></div>)}
    </dl>
    {revision && !bound && <p className="norm-warning" role="alert">La revisión no corresponde a esta ficha y decisión. No se presenta como valoración de este requisito.</p>}
    <p className="norm-boundary">Una decisión de aplicabilidad, un documento aportado y una tarea terminada no acreditan por sí solos la satisfacción del requisito.</p>
    {decisionRecord?.decision?.referenciaTemporal && <p className="norm-reference">Fecha civil evaluada: {civilDate(decisionRecord.decision.referenciaTemporal.fechaCivil)} · zona {decisionRecord.decision.referenciaTemporal.zonaEvaluacion || 'no informada'}</p>}
    {ficha.coberturaTemporalDelPaquete && <section className="norm-section"><h3>Cobertura histórica de esta ficha</h3><p>Desde {civilDate(ficha.coberturaTemporalDelPaquete.desde)}{ficha.coberturaTemporalDelPaquete.hasta ? ` hasta ${civilDate(ficha.coberturaTemporalDelPaquete.hasta)}` : ' · sin límite final informado'}.</p><p>{ficha.coberturaTemporalDelPaquete.motivo}</p></section>}
    <section className="norm-section"><h3>Alternativa de revisión</h3>{ficha.schemaVersion===2?<>{bound&&revision.ruta?<><h4>{ficha.satisfaccion.rutas.find(r=>r.id===revision.ruta.id)?.titulo||revision.ruta.id}</h4><p>{revision.ruta.motivo}</p><ul>{revision.ruta.hechos.map(h=><li key={h.clave}>{ficha.satisfaccion.hechos.find(f=>f.clave===h.clave)?.pregunta.texto||h.clave}: {({coincide:'dato compatible',no_coincide:'dato no compatible',desconocido:'pendiente',en_conflicto:'en conflicto'})[h.estado]}</li>)}</ul></>:<><p>No hay alternativa revisada en esta vista. Elegirla no declara su cumplimiento.</p><ul>{ficha.satisfaccion.rutas.map(r=><li key={r.id}><strong>{r.titulo}</strong><p>{r.explicacion} · {r.requiereTodos.length} criterios.</p></li>)}</ul></>}</>:<p>Esta ficha revisa todos sus criterios conjuntamente.</p>}</section>
    <section className="norm-section"><h3>Qué se revisa</h3><p>{criteria.length} criterios dentro de un único requisito contextualizado. No son {criteria.length} requisitos independientes.</p>
      <ol className="norm-criteria">{criteria.map(c => {
        const result = criterionResults.get(c.id);
        return <li key={c.id}><p>{c.descripcion}</p>{outside.has(c.id)&&<p className="norm-outside-route"><strong>No exigido por la alternativa examinada.</strong> No significa satisfecho ni no aplicable. {outside.get(c.id).motivo}</p>}
          <ul className="norm-precepts">{(c.preceptos || []).map((p, i) => {const source = sources.find(f => f.id === p.fuenteId), url = sourceUrl(source?.url); return <li key={`${p.fuenteId}-${i}`}><strong>{p.localizador}</strong><span>{source?.titulo || p.fuenteId}</span>{url && <a href={url} target="_blank" rel="noreferrer">Consultar fuente</a>}</li>;})}</ul>
          {result && <div className="norm-criterion-review"><strong>{({ favorable:'Valoración favorable', desfavorable:'Valoración desfavorable', no_determinado:'Valoración no determinada' })[result.resultado] || 'Resultado no reconocido'}</strong><p>{result.motivo}</p>{result.compatibilidad&&<p><strong>Compatibilidad: {({compatible:"Compatible",desconocida:"No determinada",en_conflicto:"En conflicto"})[result.compatibilidad.estado]}.</strong> {result.compatibilidad.motivo}</p>}<p className="norm-reference">Evidencias: {(result.evidenciaIds || []).join(', ') || 'Ninguna vinculada en esta revisión'}</p></div>}
        </li>;
      })}</ol>
    </section>
    <section className="norm-section"><h3>Actuaciones sugeridas</h3><p>Propuestas para organizar el trabajo; no son tareas guardadas ni resultados de revisión.</p><ol className="norm-actions">{(ficha.actuacionesSugeridas || []).map(a => <li key={a.id}><h4>{a.titulo}</h4><p>{a.funcionSugerida}</p><p><strong>Qué preparar:</strong> {a.criterioCierreTarea}</p></li>)}</ol></section>
    <section className="norm-section"><h3>Evidencias de la revisión consultada</h3>{!bound ? <p>No se ha consultado una revisión vinculada a esta ficha y decisión. No se deduce que no existan evidencias.</p> : !evidence.length ? <p>Esta revisión no contiene evidencias vinculadas.</p> : <ul className="norm-evidence">{evidence.map(e => <li key={e.id}><h4>{e.titulo}</h4><p>{e.procedencia}</p><p><strong>Localizador:</strong> {e.localizador}</p><p className="norm-reference">Evidencia {e.id} · versión {e.version}</p><p>Periodo: desde {civilDate(e.periodo?.desde)} hasta {civilDate(e.periodo?.hasta)} (final excluido) · {e.periodo?.zonaEvaluacion || 'zona no informada'}</p>
      <SupportRead support={e.soporte} openPDF={onOpenDocumentVersion}/>
    </li>)}</ul>}</section>
    {bound && <section className="norm-section"><h3>Revisión interna motivada</h3><p>{revision.motivo}</p><p className="norm-reference">Revisión {revision.id} · versión {revision.version} · revisor {revision.revisor?.usuarioId || 'no informado'}</p><p>Periodo: desde {civilDate(revision.periodo?.desde)} hasta {civilDate(revision.periodo?.hasta)} (final excluido).</p><p>Conclusión histórica: {({ favorable:'favorable', desfavorable:'desfavorable', no_determinado:'no determinada' })[revision.conclusion] || 'no reconocida'}. No es una certificación ni un dictamen profesional.</p>{revisionStatus?.requiereRevision && <p className="norm-warning">Esta conclusión histórica requiere una nueva revisión antes de utilizarla como valoración actual.</p>}</section>}
    <details className="norm-section"><summary>Fuentes, versiones y límites</summary>{sources.map(s => <div className="norm-source" key={s.id}><h4>{s.titulo}</h4><p>{s.editor} · fuente v{s.version}</p><p>{s.localizador}</p><p>Consulta de la fuente: <time dateTime={s.consultadaEn}>{recordedAt(s.consultadaEn)}</time>.</p>{sourceUrl(s.url) && <a href={sourceUrl(s.url)} target="_blank" rel="noreferrer">Abrir publicación de referencia</a>}</div>)}<ul>{(ficha.limites || []).map(l => <li key={l}>{l}</li>)}</ul><p>{ficha.usoContenido?.atribucion}</p><p>{ficha.usoContenido?.advertencia}</p>{ficha.revisionEditorial&&<section aria-label="Revisión editorial de la ficha"><h3>Revisión editorial de la ficha</h3><p>Tipo: {ficha.revisionEditorial.tipo==='analisis_asistido_IA_con_fuentes_primarias'?'Análisis asistido por IA con fuentes primarias':(ficha.revisionEditorial.tipo||'No informado').replaceAll('_',' ')}.</p><p>Fecha: <time dateTime={ficha.revisionEditorial.fecha}>{recordedAt(ficha.revisionEditorial.fecha)}</time>.</p><p>Autor declarado: {ficha.revisionEditorial.actor||'No informado'}.</p>{ficha.revisionEditorial.tipo==='analisis_asistido_IA_con_fuentes_primarias'&&<p>Contenido con revisión editorial asistida por IA; no equivale a un dictamen jurídico profesional.</p>}</section>}</details>
  </article>;
}

