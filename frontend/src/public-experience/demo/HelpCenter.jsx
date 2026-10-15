/* eslint-disable no-restricted-globals -- isolated imported public demonstration */
import React, { useEffect, useRef, useState } from 'react';
import { HELP_ARTICLES, HELP_TOPICS, TOUR_STEPS, searchHelp } from './help-model';
import './help.css';

export function HelpCenter({ progress, storageError, onStart, onVisit, initialArticle = null, returnIndex = null, onReturn = null }) {
  const [query,setQuery] = useState(''), [topic,setTopic] = useState('Todos'), [selected,setSelected] = useState(initialArticle);
  const heading = useRef(null), search = useRef(null);
  const results = searchHelp(query,topic), article = HELP_ARTICLES.find(a => a.id === selected);
  useEffect(() => { if (article) heading.current?.focus(); }, [selected]);
  function back() { setSelected(null); requestAnimationFrame(() => search.current?.focus()); }
  return <div className="help-center">
    {onReturn && <section className="help-tour-return"><div><b>El recorrido te espera aquí</b><p>Paso {returnIndex + 1} de {TOUR_STEPS.length}: {TOUR_STEPS[returnIndex].title}. Cerrar esta ventana también vuelve al mismo punto.</p></div><button className="desk-primary" onClick={onReturn}>Volver al recorrido · paso {returnIndex + 1} de {TOUR_STEPS.length}</button></section>}
    {article ? <>
      <button className="help-back" onClick={back}>← Volver a la búsqueda</button><p className="help-eyebrow">{article.topic}</p>
      <article className="help-article"><h3 ref={heading} tabIndex={-1}>{article.title}</h3><p className="help-summary">{article.summary}</p>{article.paragraphs.map(p => <p key={p}>{p}</p>)}<h4>Cómo hacerlo</h4><ol>{article.steps.map(s => <li key={s}>{s}</li>)}</ol><aside>{article.note}</aside>{onReturn ? <button className="desk-primary" onClick={onReturn}>Seguir con la ruta desde este paso</button> : <button className="desk-primary" onClick={() => onVisit(article.destination)}>{article.action} ↗</button>}</article>
    </> : <>
      <p className="help-intro">Resuelve una duda concreta o descubre cómo moverte por el espacio de trabajo. No es obligatorio completar ningún recorrido.</p>
      <section className="help-tour-intro" aria-label="Recorrido opcional"><div><span className="help-eyebrow">Aprender sobre la propia pantalla</span><h3>Conoce tu espacio de trabajo</h3><p>{TOUR_STEPS.length} pasos breves. Una brújula te acompaña por cada zona. Puedes salir y retomar, o finalizar la ruta; no modifica tareas ni documentos.</p>{progress?.status === 'paused' && <small>Pendiente: paso {progress.index+1}, «{TOUR_STEPS[progress.index].title}».</small>}{progress?.status === 'complete' && <small>Has dado por finalizada la ruta. Puedes repetirla cuando lo necesites.</small>}</div><div className="help-tour-actions"><button className="desk-primary" onClick={() => onStart(progress?.status === 'paused' ? progress.index : 0)}>{progress?.status === 'paused' ? 'Retomar recorrido' : progress?.status === 'complete' ? 'Repetir recorrido' : 'Iniciar recorrido'}</button>{progress?.status === 'paused' && <button className="help-back" onClick={() => onStart(0)}>Empezar desde el principio</button>}</div></section>
      {storageError && <p role="status" className="help-warning">{storageError}</p>}
      <label className="help-search">¿Qué necesitas entender?<input ref={search} type="search" value={query} maxLength={120} onChange={e => setQuery(e.target.value)} placeholder="Ej.: tarea bloqueada, subir PDF, histórico…" /></label>
      <div className="help-topics" role="group" aria-label="Temas de ayuda">{HELP_TOPICS.map(t => <button key={t} aria-pressed={t === topic} onClick={() => setTopic(t)}>{t}</button>)}</div>
      <p className="help-count" role="status">{results.length} {results.length === 1 ? 'artículo' : 'artículos'}{topic !== 'Todos' ? ` · ${topic}` : ''}</p>
      <div className="help-results">{results.map(a => <button key={a.id} onClick={() => setSelected(a.id)}><span><small>{a.topic}</small><strong>{a.title}</strong><span>{a.summary}</span></span><span aria-hidden="true">↗</span></button>)}</div>
      {!results.length && <div className="help-no-results"><h3>No encontramos esa consulta en la guía</h3><p>Prueba una palabra más general o consulta todos los temas. Esta búsqueda no analiza archivos de la empresa.</p><button className="desk-outline" onClick={() => { setQuery(''); setTopic('Todos'); search.current?.focus(); }}>Ver todos los artículos</button></div>}
      <p className="help-privacy">Guía de uso de la demo · búsqueda local, sin IA ni envío de consultas. No es asesoramiento jurídico.</p>
    </>}
  </div>;
}
