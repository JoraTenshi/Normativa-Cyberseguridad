import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { resendVerification, verifyEmail } from '../services/api';

const VerifyEmail = () => {
  const [token] = useState(() =>
    new URLSearchParams(window.location.hash.slice(1)).get('token') ||
    new URLSearchParams(window.location.search).get('token')
  );
  const [status, setStatus] = useState(token ? 'loading' : 'error');
  const [message, setMessage] = useState(token ? 'Confirmando tu correo...' : 'El enlace no contiene un token de verificación.');
  const [email, setEmail] = useState('');
  const [resendBusy, setResendBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;

    // El enlace es una credencial temporal: se retira de la barra y del historial.
    window.history.replaceState(window.history.state, '', '/verify-email');
    verifyEmail(token)
      .then(data => {
        setStatus('success');
        setMessage(data.message);
      })
      .catch(err => {
        setStatus('error');
        setMessage(err.response?.data?.error || 'No se pudo verificar el correo.');
      });
  }, [token]);

  const handleResend = async e => {
    e.preventDefault();
    setResendBusy(true);
    try {
      const data = await resendVerification(email);
      setMessage(data.message);
      setEmail('');
    } catch (err) {
      setMessage(err.response?.data?.error || 'No se pudo solicitar otro enlace.');
    } finally {
      setResendBusy(false);
    }
  };

  return (
    <div className="page auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Confirmación de correo</h1>
        <p role="status">{message}</p>
        {status === 'success' ? (
          <p className="auth-switch"><Link to="/auth" className="auth-link">Iniciar sesión</Link></p>
        ) : status === 'error' ? (
          <form onSubmit={handleResend} className="auth-form">
            <p>Si tu enlace ha caducado, solicita uno nuevo.</p>
            <label className="form-label" htmlFor="verification-email">Email</label>
            <input
              id="verification-email"
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
        ) : null}
      </div>
    </div>
  );
};

export default VerifyEmail;
