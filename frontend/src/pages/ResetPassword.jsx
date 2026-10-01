import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { resetPassword } from '../services/api';

const ResetPassword = () => {
  const [token] = useState(() =>
    new URLSearchParams(window.location.hash.slice(1)).get('token') ||
    new URLSearchParams(window.location.search).get('token')
  );
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) window.history.replaceState(window.history.state, '', '/reset-password');
  }, [token]);

  const handleSubmit = async e => {
    e.preventDefault();
    setError(null);
    if (password !== confirmation) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    try {
      const data = await resetPassword(token, password);
      setSuccess(data.message);
      setPassword('');
      setConfirmation('');
      localStorage.removeItem('cyberaudit_user');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cambiar la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Nueva contraseña</h1>
        {!token && <div className="error-banner" role="alert">Falta el token del enlace de recuperación.</div>}
        {success ? (
          <p role="status">{success} <a href="/auth" className="auth-link">Iniciar sesión</a></p>
        ) : token ? (
          <form onSubmit={handleSubmit} className="auth-form">
            <label className="form-label" htmlFor="new-password">Contraseña nueva</label>
            <input
              id="new-password"
              className="form-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
            <p>Mínimo 8 caracteres, con una mayúscula, una minúscula y un número.</p>
            <label className="form-label" htmlFor="confirm-password">Repite la contraseña</label>
            <input
              id="confirm-password"
              className="form-input"
              type="password"
              value={confirmation}
              onChange={e => setConfirmation(e.target.value)}
              autoComplete="new-password"
              required
            />
            {error && <div className="error-banner" role="alert">{error}</div>}
            <button type="submit" className="btn-primary auth-submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Cambiar contraseña'}
            </button>
          </form>
        ) : null}
        <p className="auth-switch"><Link to="/forgot-password" className="auth-link">Solicitar otro enlace</Link></p>
      </div>
    </div>
  );
};

export default ResetPassword;
