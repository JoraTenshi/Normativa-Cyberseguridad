import React, { useState } from 'react';
import { useNavigate, useLocation, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { register, loginApi, verify2fa, resendVerification } from '../services/api';
import { PrivacyAccess } from '../components/CookieBanner';

const esRutaInterna = destino =>
  typeof destino === 'string' && /^\/(?![/\\])[^\\\s]*$/.test(destino);

const Auth = ({ embedded = false }) => {
  const location = useLocation();
  const [tab, setTab]         = useState(() => !embedded && new URLSearchParams(location.search).get('modo') === 'registro' ? 'register' : 'login');
  const [form, setForm]       = useState({ nombre: '', email: '', password: '' });
  const [error, setError]     = useState(null);
  const [notice, setNotice]   = useState(null);
  const [canResend, setCanResend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [needs2fa, setNeeds2fa] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [mantenerSesion, setMantenerSesion] = useState(false);

  const { user, phase, login } = useAuth();
  const navigate  = useNavigate();
  // Solo rutas internas: evita redirecciones abiertas tras iniciar sesión (//dominio, /\dominio).
  const from      = esRutaInterna(location.state?.from) ? location.state.from : '/espacio-de-trabajo';

  // Si ya hay sesión iniciada, no mostrar el formulario: redirigir.
  if (!embedded && user && phase === 'authenticated') return <Navigate to={from} replace />;

  const handleChange = e =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const switchTab = t => { setTab(t); setError(null); setNotice(null); setCanResend(false); setNeeds2fa(false); };

  const handleSubmit = async e => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      if (tab === 'register') {
        const result = await register(form.nombre, form.email, form.password);

        setForm(prev => ({ ...prev, password: '' }));
        setTab('login');
        setCanResend(true);
        setNotice(result.emailSent
          ? 'Cuenta creada. Revisa tu correo para confirmar la dirección antes de iniciar sesión.'
          : 'Cuenta creada, pero no se pudo enviar el correo. Solicita otro enlace más tarde.');
        return;
      }

      const data = await loginApi(form.email, form.password, mantenerSesion);
      setForm(prev => ({ ...prev, password: '' }));

      if (data.requires2fa) {
        setNeeds2fa(true);
        return;
      }

      if (!(await login())) throw new Error('No se ha podido confirmar la sesión en el servidor.');
      if (!embedded) navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Error de conexión con el servidor');
      setCanResend(err.response?.data?.code === 'EMAIL_NOT_VERIFIED');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await resendVerification(form.email);
      setNotice(data.message);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo solicitar otro enlace');
    } finally {
      setLoading(false);
    }
  };

  const handle2faSubmit = async e => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await verify2fa(totpCode);
      setTotpCode('');
      if (!(await login())) throw new Error('No se ha podido confirmar la sesión en el servidor.');
      if (!embedded) navigate(from, { replace: true });
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
            <span className="auth-title">NormativaCheck</span>
          </div>

          <form onSubmit={handle2faSubmit} className="auth-form">
            <div className="twofa-prompt">
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
          <span className="auth-title">Tu espacio, con todo el contexto.</span>
        </div>

        {!embedded && <p className="auth-intro">Accede a tu cuenta o regístrate para solicitar el espacio de tu empresa.</p>}
        {!embedded && <div className="auth-tabs">
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
        </div>}

        {tab === 'register' && <div className="registration-privacy"><strong>Acceso restringido a validación</strong><p>Utiliza información de prueba. No aportes documentación real de clientes ni datos personales de terceros. La información de privacidad para admitir clientes está pendiente de completar.</p><PrivacyAccess/></div>}
        <form onSubmit={handleSubmit} className="auth-form">
          {tab === 'login' && <div className="form-group">
            <label><input type="checkbox" checked={mantenerSesion}
              onChange={e => setMantenerSesion(e.target.checked)} /> Mantener la sesión en este dispositivo</label>
            <small>Hasta 8 horas desde el acceso y 30 minutos sin actividad. No utilizar en equipos compartidos.</small>
          </div>}
          {notice && <p role="status">{notice}</p>}
          {tab === 'register' && (
            <div className="form-group">
              <label className="form-label" htmlFor="account-name">Nombre</label>
              <input
                id="account-name"
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
            <label className="form-label" htmlFor="account-email">Email</label>
            <input
              id="account-email"
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
            <label className="form-label" htmlFor="account-password">Contraseña</label>
            <input
              id="account-password"
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
            <div className="error-banner" role="alert">
              <span>⚠️</span> {error}
            </div>
          )}

          {tab === 'login' && canResend && (
            <button type="button" className="auth-link" onClick={handleResend} disabled={loading || !form.email}>
              Reenviar enlace de confirmación
            </button>
          )}

          <button type="submit" className="btn-primary auth-submit" disabled={loading}>
            {loading
              ? <><span className="spinner small" /> Procesando...</>
              : tab === 'login' ? 'Entrar' : 'Crear cuenta'
            }
          </button>
        </form>

        {tab === 'login' && (
          <p className="auth-switch"><Link to="/forgot-password" className="auth-link">¿Has olvidado tu contraseña?</Link></p>
        )}

        {!embedded && <p className="auth-switch">
          {tab === 'login'
            ? <>¿Sin cuenta? <button className="auth-link" onClick={() => switchTab('register')}>Regístrate</button></>
            : <>¿Ya tienes cuenta? <button className="auth-link" onClick={() => switchTab('login')}>Inicia sesión</button></>
          }
        </p>}
      </div>
    </div>
  );
};

export default Auth;
