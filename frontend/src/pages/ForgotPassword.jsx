import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../services/api';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await forgotPassword(email);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo procesar la solicitud.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page auth-page">
      <div className="auth-card">
        <h1 className="auth-title">{submitted ? 'Solicitud recibida' : 'Recuperar contraseña'}</h1>
        {submitted ? <p role="status">Si la cuenta existe y el servicio de correo está disponible, se intentará enviar un enlace de recuperación. Este aviso no confirma el envío. Revisa también el correo no deseado; si no llega, contacta con quien administra la aplicación.</p> : (
          <>
          <p>Introduce el correo electrónico asociado a tu cuenta para solicitar un enlace de recuperación.</p>
          <form onSubmit={handleSubmit} className="auth-form">
            <label className="form-label" htmlFor="recovery-email">Correo electrónico</label>
            <input
              id="recovery-email"
              className="form-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            {error && <div className="error-banner" role="alert">{error}</div>}
            <button type="submit" className="btn-primary auth-submit" disabled={loading}>
              {loading ? 'Solicitando...' : 'Enviar enlace'}
            </button>
          </form>
          </>
        )}
        <p className="auth-switch"><Link to="/auth" className="auth-link">Volver al inicio de sesión</Link></p>
      </div>
    </div>
  );
};

export default ForgotPassword;
