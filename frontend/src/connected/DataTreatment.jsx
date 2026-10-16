import React, { useState } from 'react';
import { cleanFact } from '../api-client';
import { ErrorBox, Notice, RemoteStatus, useRemote } from './ui';
import { Reason, SaveForm } from './NormativeControls';
import TypedFact from './TypedFact';
import { replaceTypedFact, treatmentChanges, validateContract } from './typed-facts';
import './data-treatment.css';

const GROUPS = [
  { title: 'Actividad y papel', keys: ['dp_rol', 'dp_fase'], intro: 'Delimita el tratamiento concreto. Tu entidad puede tener papeles distintos en otras actividades.' },
  { title: 'Ámbito y valoración', keys: ['dp_ambito_rgpd', 'dp_establecimiento_es', 'dp_regimen_general'], intro: 'Recoge lo que ya se ha valorado. Si falta el análisis, conserva la respuesta como pendiente.' },
  { title: 'Datos para el registro', keys: ['rat_fecha_personas_empleadas', 'rat_personas_empleadas', 'rat_no_ocasional', 'rat_riesgo_derechos', 'rat_art9', 'rat_art10'], intro: 'Estas declaraciones ayudan a preparar el registro de actividades. No son por sí solas un RAT completo ni una propuesta de exención.' }
];

export default function DataTreatment({ api, base, path, data, onSaved, onRestart }) {
  const contract = useRemote(api, base + '/operaciones/contrato-dp');
  let issue = null;
  if (contract.data) { try { validateContract(contract.data); } catch (error) { issue = error; } }
  return <><RemoteStatus remote={contract} /><ErrorBox error={issue} />{contract.error && <button onClick={contract.refresh}>Volver a consultar el contrato de tratamientos</button>}{contract.data && !issue && <TreatmentEditor key={`${data.operacion.id}:${data.contexto.version}:${contract.data.revisionEditorial}`} api={api} path={path} data={data} contract={contract.data} onSaved={onSaved} onRestart={onRestart} />}</>;
}

export function TreatmentEditor({ api, path, data, contract, onSaved, onRestart }) {
  const [facts, setFacts] = useState(() => data.contexto.hechos.map(cleanFact)), [reason, setReason] = useState(''), [step, setStep] = useState(0);
  const extra = contract.campos.filter(f => !GROUPS.some(g => g.keys.includes(f.clave)));
  const groups = extra.length ? [...GROUPS, { title: 'Otros datos del tratamiento', keys: extra.map(f => f.clave), intro: 'Datos adicionales del contrato consultado.' }] : GROUPS;
  const group = groups[step], fields = contract.campos.filter(f => group.keys.includes(f.clave));
  return <SaveForm noValidate api={api} path={path} data={{ ...data, version: data.contexto.version }} title="Tratamiento de datos personales" submitLabel="Guardar respuestas del tratamiento" maxBodyBytes={contract.limites.cuerpoHttpBytes} onSaved={onSaved} onRestart={onRestart} body={() => ({ cambios: treatmentChanges(contract, data.contexto.hechos, facts, reason), motivo: reason.trim() })}>
    <Notice>Responde solo por «{data.operacion.nombre}». Puedes guardar un bloque y continuar después. No saberlo todavía no significa que una obligación no aplique.</Notice>
    <nav className="dp-steps" aria-label="Bloques del tratamiento">{groups.map((g, i) => <button type="button" key={g.title} aria-current={step === i ? 'step' : undefined} onClick={() => setStep(i)}><span>{i + 1}</span>{g.title}</button>)}</nav>
    <h3>{group.title}</h3><p>{group.intro}</p>
    {fields.map(field => <TypedFact key={field.clave} field={field} fact={facts.find(f => f.clave === field.clave)} onChange={fact => setFacts(old => replaceTypedFact(old, fact))} />)}
    <div className="api-actions">{step > 0 && <button type="button" onClick={() => setStep(s => s - 1)}>Bloque anterior</button>}{step < groups.length - 1 && <button type="button" onClick={() => setStep(s => s + 1)}>Siguiente bloque</button>}<span>Bloque {step + 1} de {groups.length} · no es un porcentaje de cumplimiento</span></div>
    <Reason value={reason} onChange={setReason} />
  </SaveForm>;
}
