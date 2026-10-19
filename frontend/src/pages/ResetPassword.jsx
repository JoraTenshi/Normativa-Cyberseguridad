import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { resetPassword } from '../services/api';
import { PASSWORD_HELP, validPassword } from './account-feedback';

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
    if (loading) return;
    setError(null);
    if (password !== confirmation) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (!validPassword(password)) { setError(PASSWORD_HELP); return; }
    setLoading(true);
    try {
      await resetPassword(token, password);
      setSuccess(true);
      setPassword('');
      setConfirmation('');
      try { localStorage.removeItem('cyberaudit_user'); } catch { /* Storage availability cannot undo a successful reset. */ }
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cambiar la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page auth-page">
      <div className="auth-card">
        <h1 className="auth-title">{success ? 'Contraseña cambiada' : 'Nueva contraseña'}</h1>
        {!token && <div className="error-banner" role="alert">Este enlace de recuperación está incompleto. Solicita uno nuevo para cambiar tu contraseña.</div>}
        {success ? (
          <>
            <p role="status">Tu contraseña se ha cambiado. Inicia sesión con la nueva contraseña.</p>
            <p>Cambiar la contraseña no confirma tu correo. Si aún está pendiente, solicita un enlace de confirmación.</p>
            <p className="auth-switch"><a href="/auth" className="auth-link">Iniciar sesión</a></p>
            <p className="auth-switch"><a href="/verify-email" className="auth-link">Confirmar mi correo</a></p>
          </>
        ) : token ? (
          <form onSubmit={handleSubmit} className="auth-form" aria-busy={loading}>
            <label className="form-label" htmlFor="new-password">Contraseña nueva</label>
            <input
              id="new-password"
              disabled={loading}
              aria-describedby="reset-password-help"
              className="form-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
            <p id="reset-password-help">{PASSWORD_HELP}</p>
            <label className="form-label" htmlFor="confirm-password">Repite la contraseña</label>
            <input
              id="confirm-password"
              disabled={loading}
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
        {!success && <p className="auth-switch"><Link to="/forgot-password" className="auth-link">Solicitar otro enlace</Link></p>}
      </div>
    </div>
  );
};

export default ResetPassword;
