import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { resendVerification, verifyEmail } from '../services/api';
import { VERIFICATION_REQUESTED } from './account-feedback';

const VerifyEmail = () => {
  const [token] = useState(() =>
    new URLSearchParams(window.location.hash.slice(1)).get('token') ||
    new URLSearchParams(window.location.search).get('token')
  );
  const [status, setStatus] = useState(token ? 'loading' : 'idle');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [resendBusy, setResendBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;

    // El enlace es una credencial temporal: se retira de la barra y del historial.
    window.history.replaceState(window.history.state, '', '/verify-email');
    verifyEmail(token)
      .then(() => {
        setStatus('success');
        setMessage('Correo confirmado correctamente. Ya puedes iniciar sesión.');
      })
      .catch(err => {
        setStatus('error');
        setMessage(err.response?.data?.error || 'No se pudo verificar el correo.');
      });
  }, [token]);

  const handleResend = async e => {
    e.preventDefault();
    if (resendBusy) return;
    setResendBusy(true);
    setMessage('');
    try {
      await resendVerification(email.trim());
      setStatus('requested');
      setMessage(VERIFICATION_REQUESTED);
      setEmail('');
    } catch (err) {
      setStatus('error');
      setMessage(err.response?.data?.error || 'No se pudo solicitar otro enlace.');
    } finally {
      setResendBusy(false);
    }
  };

  return (
    <div className="page auth-page">
      <div className="auth-card">
        <h1 className="auth-title">{status === 'requested' ? 'Solicitud recibida' : status === 'success' ? 'Correo confirmado' : 'Confirmación de correo'}</h1>
        {status === 'loading' && <p role="status">Confirmando tu correo...</p>}
        {message && <p role={status === 'error' ? 'alert' : 'status'}>{message}</p>}
        {status === 'requested' && <button type="button" className="auth-link" onClick={() => { setStatus('idle'); setMessage(''); }}>Usar otro correo</button>}
        {(status === 'idle' || status === 'error') && (
          <form onSubmit={handleResend} className="auth-form" aria-busy={resendBusy}>
            <p>Introduce tu correo para solicitar un enlace de confirmación. Si ya lo confirmaste, puedes iniciar sesión.</p>
            <label className="form-label" htmlFor="verification-email">Correo electrónico</label>
            <input
              id="verification-email"
              disabled={resendBusy}
              className="form-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <button type="submit" className="btn-primary auth-submit" disabled={resendBusy}>
              {resendBusy ? 'Solicitando...' : 'Reenviar enlace'}
            </button>
          </form>
        )}
        <p className="auth-switch"><Link to="/auth" className="auth-link">Iniciar sesión</Link></p>
      </div>
    </div>
  );
};

export default VerifyEmail;
