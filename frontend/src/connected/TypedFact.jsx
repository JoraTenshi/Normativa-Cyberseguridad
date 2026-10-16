import React, { useId } from 'react';
import { Field } from './ui';
import { factLabel, factHelp, typedFactError, validTypedValue, valueLabel } from './typed-facts';

function ValueInput({ field, value, onChange, label, describedBy }) {
  const options = field.tipo === 'booleano' ? [true, false] : field.valores;
  if (options) return <Field label={label}><select aria-describedby={describedBy} value={value === '' || value == null ? '' : String(value)} onChange={e => onChange(field.tipo === 'booleano' && e.target.value !== '' ? e.target.value === 'true' : e.target.value)}>
    <option value="">Selecciona una respuesta…</option>
    {value !== '' && value != null && !validTypedValue(field, value) && <option value={String(value)} disabled>Valor anterior sin reinterpretar: {String(value)}</option>}
    {options.map(v => <option key={String(v)} value={String(v)}>{field.tipo === 'booleano' ? field.etiquetasBooleanas?.[String(v)] || (v ? 'Sí, según los datos disponibles' : 'No, según los datos disponibles') : valueLabel(v)}</option>)}
  </select></Field>;
  return <Field label={label}><input aria-describedby={describedBy} type={field.tipo === 'numero' ? 'number' : field.formato === 'fecha_civil' ? 'date' : 'text'} min={field.minimo} max={field.maximo} step={field.entero ? 1 : 'any'} maxLength={400} value={value ?? ''} onInput={e => { if (field.formato === 'fecha_civil') onChange(e.target.value); }} onChange={e => onChange(field.tipo === 'numero' && e.target.value !== '' ? Number(e.target.value) : e.target.value)} /></Field>;
}

export default function TypedFact({ field, fact, onChange }) {
  const helpId = useId(), title = factLabel(field), state = fact?.estado || 'sin_declarar';
  const issue = typedFactError(field, fact);
  const changeState = next => onChange(next === 'desconocido' ? { clave: field.clave, estado: next, motivo: 'por_consultar' } : next === 'conflictivo' ? { clave: field.clave, estado: next, alternativas: [{ valor: fact?.estado === 'conocido' ? fact.valor : '' }, { valor: '' }] } : { clave: field.clave, estado: next, valor: '' });
  return <fieldset className="dp-fact"><legend>{title}</legend>
    <p id={helpId} className="api-why">{field.requiereAnalisis && <strong>Requiere valoración previa. </strong>}{factHelp(field)}</p>
    <Field label={'Situación · ' + title}><select aria-describedby={helpId} value={state} onChange={e => changeState(e.target.value)}>
      <option value="sin_declarar" disabled>Sin respuesta registrada</option><option value="desconocido">No lo sé / pendiente de analizar</option><option value="conocido">Dispongo de un dato o valoración</option><option value="conflictivo">Hay información contradictoria</option>
    </select></Field>
    {state === 'conocido' && <ValueInput field={field} value={fact.valor} describedBy={helpId} label={'Respuesta · ' + title} onChange={valor => onChange({ clave: field.clave, estado: 'conocido', valor })} />}
    {state === 'desconocido' && <Field label={'Por qué queda pendiente · ' + title}><select value={fact.motivo} onChange={e => onChange({ clave: field.clave, estado: 'desconocido', motivo: e.target.value })}><option value="por_consultar">Necesito consultarlo o analizarlo</option><option value="no_sabe">No lo sé</option><option value="no_aportado">Todavía no se ha aportado</option></select></Field>}
    {state === 'conflictivo' && <><p>No se elige ninguna alternativa al guardar.</p>{fact.alternativas.map((alternative, i) => <div key={i} className="dp-alternative"><ValueInput field={field} value={alternative.valor} describedBy={helpId} label={`Alternativa ${i + 1} · ${title}`} onChange={valor => onChange({ ...fact, alternativas: fact.alternativas.map((a, j) => i === j ? { valor } : a) })} />{fact.alternativas.length > 2 && <button type="button" onClick={() => onChange({ ...fact, alternativas: fact.alternativas.filter((_, j) => i !== j) })}>Retirar alternativa {i + 1}</button>}</div>)}{fact.alternativas.length < 5 && <button type="button" onClick={() => onChange({ ...fact, alternativas: [...fact.alternativas, { valor: '' }] })}>Añadir alternativa · {title}</button>}</>}
    {issue && <p className="api-why" role="status">{issue} El valor anterior no se corrige automáticamente.</p>}
  </fieldset>;
}
