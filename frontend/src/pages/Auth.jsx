import React, { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { register, loginApi, verify2fa } from '../services/api';

const Auth = () => {
  const [tab, setTab]         = useState('login');
  const [form, setForm]       = useState({ nombre: '', email: '', password: '' });
  const [error, setError]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [needs2fa, setNeeds2fa] = useState(false);
  const [totpCode, setTotpCode] = useState('');

  const { user, login } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const from      = location.state?.from || '/';

  // Si ya hay sesión iniciada, no mostrar el formulario: redirigir.
  if (user) return <Navigate to={from} replace />;

  const handleChange = e =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const switchTab = t => { setTab(t); setError(null); setNeeds2fa(false); };

  const handleSubmit = async e => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = tab === 'register'
        ? await register(form.nombre, form.email, form.password)
        : await loginApi(form.email, form.password);

      if (data.requires2fa) {
        setNeeds2fa(true);
        setLoading(false);
        return;
      }

      login(data.usuario);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const handle2faSubmit = async e => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await verify2fa(totpCode);
      login(data.usuario);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Código incorrecto');
    } finally {
      setLoading(false);
    }
  };

  if (needs2fa) {
    return (
      <div className="page auth-page">
        <div className="auth-card">
          <div className="auth-brand">
            <span className="auth-icon">🛡️</span>
            <span className="auth-title">CyberAudit</span>
          </div>

          <form onSubmit={handle2faSubmit} className="auth-form">
            <div className="twofa-prompt">
              <div className="twofa-prompt-icon">🔐</div>
              <div className="twofa-prompt-title">Verificación en dos pasos</div>
              <p className="twofa-prompt-desc">Introduce el código de tu aplicación de autenticación.</p>
            </div>

            <div className="form-group">
              <label className="form-label">Código 2FA</label>
              <input
                className="form-input twofa-code-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                value={totpCode}
                onChange={e => setTotpCode(e.target.value)}
                autoFocus
                required
                autoComplete="one-time-code"
              />
            </div>

            {error && (
              <div className="error-banner">
                <span>⚠️</span> {error}
              </div>
            )}

            <button type="submit" className="btn-primary auth-submit" disabled={loading || totpCode.length !== 6}>
              {loading ? <><span className="spinner small" /> Verificando...</> : 'Verificar'}
            </button>
          </form>

          <p className="auth-switch">
            <button className="auth-link" onClick={() => { setNeeds2fa(false); setError(null); setTotpCode(''); }}>
              Volver al inicio de sesión
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-icon">🛡️</span>
          <span className="auth-title">CyberAudit</span>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => switchTab('login')}
          >
            Iniciar sesión
          </button>
          <button
            className={`auth-tab ${tab === 'register' ? 'active' : ''}`}
            onClick={() => switchTab('register')}
          >
            Registrarse
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {tab === 'register' && (
            <div className="form-group">
              <label className="form-label">Nombre</label>
              <input
                className="form-input"
                name="nombre"
                type="text"
                placeholder="Tu nombre completo"
                value={form.nombre}
                onChange={handleChange}
                required
                autoComplete="name"
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              name="email"
              type="email"
              placeholder="tu@empresa.com"
              value={form.email}
              onChange={handleChange}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Contraseña</label>
            <input
              className="form-input"
              name="password"
              type="password"
              placeholder={tab === 'register' ? 'Mínimo 8 car., mayúscula, minúscula y número' : '••••••••'}
              value={form.password}
              onChange={handleChange}
              required
              autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
            />
          </div>

          {error && (
            <div className="error-banner">
              <span>⚠️</span> {error}
            </div>
          )}

          <button type="submit" className="btn-primary auth-submit" disabled={loading}>
            {loading
              ? <><span className="spinner small" /> Procesando...</>
              : tab === 'login' ? 'Entrar' : 'Crear cuenta'
            }
          </button>
        </form>

        <p className="auth-switch">
          {tab === 'login'
            ? <>¿Sin cuenta? <button className="auth-link" onClick={() => switchTab('register')}>Regístrate</button></>
            : <>¿Ya tienes cuenta? <button className="auth-link" onClick={() => switchTab('login')}>Inicia sesión</button></>
          }
        </p>
      </div>
    </div>
  );
};

export default Auth;
