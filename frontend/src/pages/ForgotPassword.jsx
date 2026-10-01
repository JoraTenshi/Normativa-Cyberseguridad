import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../services/api';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await forgotPassword(email);
      setMessage(data.message);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo procesar la solicitud.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Recuperar contraseña</h1>
        <p>Introduce el correo de tu cuenta. Si está registrado, recibirás un enlace de recuperación.</p>
        {message ? <p role="status">{message}</p> : (
          <form onSubmit={handleSubmit} className="auth-form">
            <label className="form-label" htmlFor="recovery-email">Email</label>
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
        )}
        <p className="auth-switch"><Link to="/auth" className="auth-link">Volver al inicio de sesión</Link></p>
      </div>
    </div>
  );
};

export default ForgotPassword;
