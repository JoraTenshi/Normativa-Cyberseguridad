import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { register, loginApi } from '../services/api';

const Auth = () => {
  const [tab, setTab]       = useState('login');
  const [form, setForm]     = useState({ nombre: '', email: '', password: '' });
  const [error, setError]   = useState(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const from      = location.state?.from || '/';

  const handleChange = e =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const switchTab = t => { setTab(t); setError(null); };

  const handleSubmit = async e => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = tab === 'register'
        ? await register(form.nombre, form.email, form.password)
        : await loginApi(form.email, form.password);
      login(data.usuario);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

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
              placeholder={tab === 'register' ? 'Mínimo 8 caracteres' : '••••••••'}
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
