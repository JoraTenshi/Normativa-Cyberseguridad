/* eslint-disable no-restricted-globals -- isolated imported public demonstration */
import React, { useEffect, useState } from 'react';
import Workspace from './demo/Workspace';
import { DEMO_ROUTES, DemoChoices } from './LiveExample';
import './demo/style.css';
export default function Demo() {
  const readEntry = () => DEMO_ROUTES[location.hash.split('/')[2]] ? location.hash.split('/')[2] : null;
  const [entry,setEntry] = useState(readEntry);
  const [showGuide,setShowGuide] = useState(() => !readEntry());
  useEffect(() => { const update = () => { if(location.hash.startsWith('#/demo')) { const next=readEntry(); setEntry(next); setShowGuide(!next); window.scrollTo({top:0,behavior:'instant'}); } }; window.addEventListener('hashchange',update); return () => window.removeEventListener('hashchange',update); },[]);
  const selected = DEMO_ROUTES[entry];
  return <div className="demo-host">
    <div className="demo-return"><a href="#inicio">← Volver a la portada</a><span><b>DEMO</b> · Linde Studio</span><a href="#demo-ayuda">Qué puedes probar ↓</a></div>
    <div id="demo-ayuda" className="demo-explanation"><div className="demo-intro-top"><div><strong>{selected ? selected.title : '¿Por dónde empiezo?'}</strong><p>{selected ? selected.hint : 'Linde Studio necesita completar el anexo de tratamiento de Trama. Sigue esa tarea para conocer el producto o explora libremente el dashboard.'}</p>{selected && <a className="demo-jump" href="#demo-task">Ir al detalle de la tarea ↓</a>}</div><button onClick={() => setShowGuide(v=>!v)}>{showGuide ? 'Ocultar sugerencias' : 'Mostrar sugerencias'}</button></div>{showGuide && <DemoChoices compact/>}</div>
    <Workspace key={entry || 'free'} entryFocus={selected ? selected.modal==='sample'?'document':selected.panel==='basis'?'basis':'work' : null} initialScope={selected?.scope || 'saas'} initialSection={selected?.section || 'overview'} initialPanel={selected?.panel || 'work'} initialModal={selected?.modal || null} initialTask={selected?.task || (selected ? 'encargo' : 'proveedor')}/>
  </div>;
}
