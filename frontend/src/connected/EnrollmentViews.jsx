import React, { useId, useRef, useState } from 'react';
import './enrollment.css';
import { useDirty } from './ui';

// Presentation-only contract. Server DTOs and authority must be adapted explicitly.
// These views never infer permissions, create memberships or call an API.
const STATUS = {
  unverified: { step: 1, label: 'Confirma tu correo', text: 'Comprueba tu bandeja de entrada y abre el enlace de verificación. Confirmar tu correo no aprueba la solicitud ni activa el acceso a una empresa.' },
  none: { step: 2, label: 'Solicita tu espacio de empresa', text: 'Cuéntanos qué empresa quieres incorporar y cuál es tu relación con ella. La solicitud será revisada antes de habilitar el espacio.' },
  pending: { step: 3, label: 'Solicitud pendiente de revisión', text: 'La administración de NormativaCheck revisará la solicitud. Mientras tanto puedes consultar su estado, pero todavía no tienes acceso al espacio de esta empresa.' },
  rejected: { step: 3, label: 'Solicitud no aprobada', text: 'La solicitud ha sido revisada y no habilita el acceso a la empresa. Consulta el motivo y las opciones disponibles para continuar.' },
  correction: { step: 3, label: 'Necesitamos una aclaración', text: 'Revisa la información solicitada. Una corrección de datos materiales debe volver a revisarse; no conserva una aprobación anterior automáticamente.' },
  approved: { step: 4, label: 'Solicitud aprobada', text: 'La administración ha aprobado esta solicitud. El acceso se comprobará de nuevo con las membresías vigentes del servidor.' },
};

export function EnrollmentStatus({ state, publicReason, busy = false, canRequest = false, canCorrect = false, canRefresh = false, canCheckMemberships = false, onRequest, onCorrect, onRefresh, onCheckMemberships }) {
  const content = STATUS[state];
  if (state === 'loading') return <section className="enrollment-status" aria-busy="true"><h2>Comprobando el estado de tu solicitud</h2><p role="status">Consultando la información del servidor…</p></section>;
  if (!content) return <section className="enrollment-status" role="alert"><h2>No podemos confirmar el estado</h2><p>No se ha habilitado ningún acceso. Vuelve a consultar la solicitud cuando se recupere la conexión.</p>{canRefresh && <button type="button" disabled={busy} onClick={onRefresh}>Volver a consultar</button>}</section>;
  return <section className={`enrollment-status enrollment-${state}`}>
    <ol className="enrollment-steps" aria-label="Proceso de alta">
      {['Correo', 'Solicitud', 'Revisión', 'Acceso'].map((label, index) => <li key={label} aria-current={index + 1 === content.step ? 'step' : undefined} className={index + 1 < content.step ? 'is-past' : ''}><span aria-hidden="true">{index + 1}</span>{label}</li>)}
    </ol>
    <div className="enrollment-state-copy"><span className="enrollment-kicker">TU SOLICITUD DE ALTA</span><h2>{content.label}</h2><p>{content.text}</p>
      {typeof publicReason === 'string' && publicReason.trim() && <div className="enrollment-reason"><h3>Motivo comunicado</h3><p>{publicReason}</p></div>}
      <div className="enrollment-actions">
        {state === 'none' && canRequest && <button type="button" className="enrollment-primary" disabled={busy} onClick={onRequest}>Solicitar espacio de empresa</button>}
        {['rejected', 'correction'].includes(state) && canCorrect && <button type="button" className="enrollment-primary" disabled={busy} onClick={onCorrect}>Revisar los datos de mi solicitud</button>}
        {state === 'approved' && canCheckMemberships && <button type="button" className="enrollment-primary" disabled={busy} onClick={onCheckMemberships}>Comprobar mi acceso</button>}
        {canRefresh && <button type="button" disabled={busy} onClick={onRefresh}>{busy ? 'Consultando…' : 'Actualizar estado'}</button>}
      </div>
    </div>
  </section>;
}

export function EnrollmentSummary({ request }) {
  return <section className="enrollment-summary"><h2>Datos de la solicitud</h2><dl>
    <div><dt>Empresa solicitada</dt><dd>{request.companyName}</dd></div>
    <div><dt>Identificación fiscal declarada</dt><dd>{request.taxId || 'No aportada'}</dd></div>
    <div><dt>País declarado</dt><dd>{request.country === 'ES' ? 'España' : request.country}</dd></div>
    {request.applicantName && <div><dt>Persona solicitante</dt><dd>{request.applicantName}</dd></div>}
    {request.applicantEmail && <div><dt>Correo de la cuenta</dt><dd>{request.applicantEmail}</dd></div>}
    {typeof request.emailVerified === 'boolean' && <div><dt>Verificación del correo</dt><dd>{request.emailVerified === true ? 'Confirmado por el servidor' : 'No confirmada'}</dd></div>}
    <div><dt>Versión que estás consultando</dt><dd>{request.version}</dd></div>
  </dl>{request.representation && <div className="enrollment-reason"><h3>Relación declarada con la empresa</h3><p>{request.representation}</p></div>}
    {request.justification && <div className="enrollment-reason"><h3>Justificación de la solicitud</h3><p>{request.justification}</p></div>}
    <p className="enrollment-boundary">Los datos son declaraciones del solicitante. Verificar el correo no acredita por sí solo la representación de la empresa.</p>
  </section>;
}

export function EnrollmentDecision({ request, authorityConfirmed, canDecide, blocked = false, onDecide }) {
  const [decision, setDecision] = useState(''), [reason, setReason] = useState(''), [confirmed, setConfirmed] = useState('');
  const [sending, setSending] = useState(false), [error, setError] = useState(null);
  const [internalNote, setInternalNote] = useState('');
  useDirty(Boolean(decision || reason || internalNote));
  const lock = useRef(false), formId = useId();
  const identity = `${request.id}:${request.version}:${decision}`;
  const permitted = authorityConfirmed === true && canDecide === true;
  const eligible = permitted && !blocked && ['pending', 'correction'].includes(request.state) && ['aprobar', 'rechazar', 'pedir_aclaracion'].includes(decision) && (decision === 'rechazar' || request.state === 'pending') && (decision !== 'aprobar' || request.emailVerified === true);
  const valid = eligible && reason.trim().length >= 20 && reason.trim().length <= 1000 && internalNote.length <= 2000 && confirmed === identity;
  async function submit(event) {
    event.preventDefault();
    if (!valid || lock.current) return;
    lock.current = true; setSending(true); setError(null);
    try { await onDecide({ version: request.version, decision, motivoPublico: reason.trim(), notaInterna: internalNote.trim() }); }
    catch (e) { setError(e); }
    finally { lock.current = false; setSending(false); }
  }
  return <>{!permitted && <section className="enrollment-decision" role="status"><h2>Revisión de altas</h2><p>No hay autorización confirmada para decidir esta solicitud. No se pueden decidir solicitudes propias, cerradas o no habilitadas por el servidor.</p></section>}
  <section className="enrollment-decision" hidden={!permitted}><span className="enrollment-kicker">ADMINISTRACIÓN DE LA PLATAFORMA</span><h2>Decide sobre esta solicitud</h2>
    <p>La aprobación habilita el espacio y la membresía previstos para esta versión. No es una certificación ni concede acceso general a los documentos privados de otras empresas.</p>
    {request.emailVerified !== true && <p className="enrollment-warning" role="status">El correo no está verificado. La solicitud no se puede aprobar.</p>}
    {blocked && <p className="enrollment-warning" role="alert">La decisión está bloqueada. Consulta el estado actual y revisa los cambios antes de preparar otro envío. Tu motivo permanece aquí.</p>}
    <form onSubmit={submit} aria-label="Decisión sobre la solicitud">
      <fieldset disabled={sending || blocked || !permitted}><legend>Decisión explícita</legend>
        <label htmlFor={`${formId}-decision`}>Qué quieres hacer</label>
        <select id={`${formId}-decision`} value={decision} onChange={e => { setDecision(e.target.value); setConfirmed(''); }} required>
          <option value="">Selecciona una decisión…</option>
          <option value="aprobar" disabled={request.emailVerified !== true || request.state !== 'pending'}>Aprobar la solicitud</option>
          <option value="pedir_aclaracion" disabled={request.state !== 'pending'}>Pedir una aclaración</option>
          <option value="rechazar">Rechazar la solicitud</option>
        </select>
        <label htmlFor={`${formId}-reason`}>Motivo que verá el solicitante</label>
        <textarea id={`${formId}-reason`} value={reason} onChange={e => { setReason(e.target.value); setConfirmed(''); }} minLength={20} maxLength={1000} required rows={4}/>
        <p className="enrollment-field-hint">Entre 20 y 1000 caracteres. Se conservará con la decisión y será visible para el solicitante.</p>
        <label htmlFor={`${formId}-internal`}>Nota interna de administración (opcional)</label>
        <textarea id={`${formId}-internal`} value={internalNote} onChange={e => { setInternalNote(e.target.value); setConfirmed(''); }} maxLength={2000} rows={3}/>
        <p className="enrollment-field-hint">No se muestra al solicitante. No incluyas contraseñas ni códigos de acceso.</p>
        <label className="enrollment-confirm"><input type="checkbox" checked={confirmed === identity} onChange={e => setConfirmed(e.target.checked ? identity : '')} disabled={!eligible}/><span>He revisado los datos y confirmo esta decisión sobre la versión {request.version} de la solicitud de <strong>{request.companyName}</strong>.</span></label>
        <button className={decision === 'rechazar' ? 'enrollment-reject-button' : 'enrollment-primary'} type="submit" disabled={!valid || sending}>{sending ? 'Registrando decisión…' : decision === 'aprobar' ? 'Confirmar aprobación' : decision === 'rechazar' ? 'Confirmar rechazo' : decision === 'pedir_aclaracion' ? 'Solicitar aclaración' : 'Confirmar decisión'}</button>
      </fieldset>
    </form>
    {error && <p className="enrollment-warning" role="alert">{error.message || 'No se ha confirmado la decisión. El motivo se conserva.'}</p>}
  </section></>;
}
