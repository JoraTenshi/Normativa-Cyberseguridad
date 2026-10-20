import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { register, loginApi, verify2fa, resendVerification } from '../services/api';
import { PrivacyAccess } from '../components/CookieBanner';
import { PASSWORD_HELP, validPassword, VERIFICATION_REQUESTED, REGISTRATION_REQUESTED } from './account-feedback';
import { isLocalTeacherDemo } from '../utils/localTeacherDemo';
import { canOfferPasswordSave, canChooseSavedPassword, chooseSavedPassword, offerPasswordSave } from '../services/browserPasswordManager';

const esRutaInterna = destino =>
  typeof destino === 'string' && /^\/(?![/\\])[^\\\s]*$/.test(destino);

const Auth = ({ embedded = false }) => {
  const location = useLocation();
  const view = useRef({ key: location.key, mounted: true });
  const pendingPasswordSave = useRef(null);
  view.current.key = location.key;
  useEffect(() => { view.current.mounted = true; return () => { view.current.mounted = false; pendingPasswordSave.current = null; }; }, []);
  const localTeacherDemo = isLocalTeacherDemo();
  const [tab, setTab]         = useState(() => !localTeacherDemo && !embedded && new URLSearchParams(location.search).get('modo') === 'registro' ? 'register' : 'login');
  const [form, setForm]       = useState({ nombre: '', email: '', password: '' });
  const [error, setError]     = useState(null);
  const [notice, setNotice]   = useState(null);
  const [canResend, setCanResend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [needs2fa, setNeeds2fa] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [mantenerSesion, setMantenerSesion] = useState(false);
  const [recordarPassword, setRecordarPassword] = useState(false);
  const [choosingSavedPassword, setChoosingSavedPassword] = useState(false);
  const [finalizingSignIn, setFinalizingSignIn] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);

  const { user, phase, login } = useAuth();
  const navigate  = useNavigate();
  // Solo rutas internas: evita redirecciones abiertas tras iniciar sesión (//dominio, /\dominio).
  const from      = esRutaInterna(location.state?.from) ? location.state.from : '/espacio-de-trabajo';

  // Header/back navigation may reuse this component. Reflect the new route,
  // without resetting the embedded session-unlock form or its surrounding draft.
  useEffect(() => {
    if (embedded) return;
    setTab(!localTeacherDemo && new URLSearchParams(location.search).get('modo') === 'registro' ? 'register' : 'login');
    setError(null); setNotice(null); setCanResend(false); setNeeds2fa(false);
    setRegistrationComplete(false); setTotpCode(''); setLoading(false);
    pendingPasswordSave.current = null;
    setForm(prev => ({ ...prev, password: '' }));
  }, [embedded, localTeacherDemo, location.key, location.search]);

  // Si ya hay sesión iniciada, no mostrar el formulario: redirigir.
  if (!embedded && user && phase === 'authenticated' && !finalizingSignIn) return <Navigate to={from} replace />;

  const handleChange = e => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (e.target.name === 'email') { setCanResend(false); setNotice(null); setError(null); }
  };

  const switchTab = t => { pendingPasswordSave.current = null; setTab(t); setError(null); setNotice(null); setCanResend(false); setNeeds2fa(false); setRegistrationComplete(false); setTotpCode(''); setForm(prev => ({ ...prev, password: '' })); };

  const handleChooseSavedPassword = async () => {
    if (loading || choosingSavedPassword) return;
    const key = location.key;
    setChoosingSavedPassword(true);
    setNotice(null);
    const saved = await chooseSavedPassword();
    if (view.current.mounted && view.current.key === key) {
      if (saved) {
        setForm(prev => ({ ...prev, email: saved.email, password: saved.password }));
        setError(null);
      } else {
        setNotice('No se seleccionó ninguna contraseña guardada en este navegador. Puedes escribirla o usar el gestor de contraseñas del navegador.');
      }
      setChoosingSavedPassword(false);
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (loading) return;
    const key = location.key;
    const current = () => view.current.mounted && view.current.key === key;
    setError(null);
    setNotice(null);
    setCanResend(false);
    if (tab === 'register' && !validPassword(form.password)) { setError(PASSWORD_HELP); return; }
    setLoading(true);

    try {
      if (tab === 'register') {
        await register(form.nombre.trim(), form.email.trim(), form.password);
        if (!current()) return;

        setForm(prev => ({ ...prev, password: '' }));
        setTab('login');
        setCanResend(true);
        setRegistrationComplete(true);
        setNotice(REGISTRATION_REQUESTED);
        return;
      }

      pendingPasswordSave.current = null;
      // Password managers can fill DOM inputs without emitting React change events.
      const fields = new FormData(e.currentTarget);
      const submitted = { email: String(fields.get('email') || '').trim(), password: String(fields.get('password') || '') };
      const data = await loginApi(submitted.email, submitted.password, mantenerSesion);
      if (!current()) return;
      setForm(prev => ({ ...prev, password: '' }));

      if (data.requires2fa) {
        if (recordarPassword) pendingPasswordSave.current = submitted;
        setNeeds2fa(true);
        return;
      }

      setFinalizingSignIn(true);
      if (!(await login())) throw new Error('No se ha podido confirmar la sesión en el servidor.');
      if (!current()) return;
      if (recordarPassword) await offerPasswordSave(submitted);
      if (!current()) return;
      if (!embedded) navigate(from, { replace: true });
    } catch (err) {
      if (!current()) return;
      setError(tab === 'register' && err.response?.status === 409
        ? 'No se ha podido completar el registro con estos datos. Puedes intentar iniciar sesión, confirmar tu correo o recuperar el acceso.'
        : err.response?.data?.error || err.message || 'Error de conexión con el servidor');
      setCanResend(err.response?.data?.code === 'EMAIL_NOT_VERIFIED');
    } finally {
      if (current()) { setLoading(false); setFinalizingSignIn(false); }
    }
  };

  const handleResend = async () => {
    if (loading) return;
    const key = location.key;
    const current = () => view.current.mounted && view.current.key === key;
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      await resendVerification(form.email.trim());
      if (!current()) return;
      setNotice(VERIFICATION_REQUESTED);
      setCanResend(false);
    } catch (err) {
      if (!current()) return;
      setError(err.response?.data?.error || 'No se pudo solicitar otro enlace');
    } finally {
      if (current()) setLoading(false);
    }
  };

  const handle2faSubmit = async e => {
    e.preventDefault();
    if (loading) return;
    const key = location.key;
    const current = () => view.current.mounted && view.current.key === key;
    setError(null);
    setLoading(true);
    try {
      await verify2fa(totpCode);
      if (!current()) return;
      setTotpCode('');
      setFinalizingSignIn(true);
      if (!(await login())) throw new Error('No se ha podido confirmar la sesión en el servidor.');
      if (!current()) return;
      if (pendingPasswordSave.current) await offerPasswordSave(pendingPasswordSave.current);
      if (!current()) return;
      pendingPasswordSave.current = null;
      if (!embedded) navigate(from, { replace: true });
    } catch (err) {
      if (!current()) return;
      setError(err.response?.data?.error || 'Código incorrecto');
    } finally {
      if (current()) { setLoading(false); setFinalizingSignIn(false); }
    }
  };

  if (needs2fa) {
    return (
      <div className="page auth-page">
        <div className="auth-card">
          <div className="auth-brand">
            <span className="auth-title">NormativaCheck</span>
          </div>

          <form onSubmit={handle2faSubmit} className="auth-form" aria-busy={loading}>
            <div className="twofa-prompt">
              <div className="twofa-prompt-title">Verificación en dos pasos</div>
              <p className="twofa-prompt-desc">Introduce el código de tu aplicación de autenticación.</p>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="account-totp">Código 2FA</label>
              <input
                id="account-totp"
                disabled={loading}
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
              <div className="error-banner" role="alert">
                <span>⚠️</span> {error}
              </div>
            )}

            <button type="submit" className="btn-primary auth-submit" disabled={loading || totpCode.length !== 6}>
              {loading ? <><span className="spinner small" /> Verificando...</> : 'Verificar'}
            </button>
          </form>

          <p className="auth-switch">
            <button className="auth-link" disabled={loading} onClick={() => { pendingPasswordSave.current = null; setNeeds2fa(false); setError(null); setTotpCode(''); }}>
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

        {!embedded && <p className="auth-intro">{localTeacherDemo
          ? 'Demo local: entra con admin.workspace@example.invalid y la contraseña que mostró una sola vez node scripts/local-demo.cjs account. Esta instalación no envía correos ni admite nuevas cuentas o recuperación por email.'
          : 'Accede a tu cuenta o regístrate para solicitar el espacio de tu empresa.'}</p>}
        {!embedded && !localTeacherDemo && !registrationComplete && <div className="auth-tabs" role="group" aria-label="Acceso a tu cuenta">
          <button
            disabled={loading}
            aria-pressed={tab === 'login'}
            className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => switchTab('login')}
          >
            Iniciar sesión
          </button>
          <button
            disabled={loading}
            aria-pressed={tab === 'register'}
            className={`auth-tab ${tab === 'register' ? 'active' : ''}`}
            onClick={() => switchTab('register')}
          >
            Registrarse
          </button>
        </div>}

        {tab === 'register' && <div className="registration-privacy"><strong>Acceso restringido a validación</strong><p>Utiliza información de prueba. No aportes documentación real de clientes ni datos personales de terceros. La información de privacidad para admitir clientes está pendiente de completar.</p><PrivacyAccess/></div>}
        {registrationComplete ? <section aria-label="Solicitud de registro">
          <h1 className="auth-title">Solicitud recibida</h1>
          {notice && <p role="status">{notice}</p>}
          <p>Revisa también el correo no deseado. Si no llega un enlace, contacta con quien administra la aplicación. Confirmar el correo no concede automáticamente acceso al espacio de una empresa.</p>
          {error && <div className="error-banner" role="alert">{error}</div>}
          {canResend && <button type="button" className="btn-primary auth-submit" onClick={handleResend} disabled={loading}>{loading ? 'Solicitando...' : 'Reenviar enlace de confirmación'}</button>}
          <p className="auth-switch"><button className="auth-link" disabled={loading} onClick={() => switchTab('login')}>Ir al inicio de sesión</button></p>
        </section> : <form onSubmit={handleSubmit} className="auth-form" aria-busy={loading}>
          {tab === 'login' && <div className="form-group">
            <label><input type="checkbox" disabled={loading} checked={mantenerSesion}
              onChange={e => setMantenerSesion(e.target.checked)} /> Mantener la sesión en este dispositivo</label>
            <small>Hasta 8 horas desde el acceso y 30 minutos sin actividad. No utilizar en equipos compartidos.</small>
          </div>}
          {tab === 'login' && <div className="form-group">
            {canOfferPasswordSave() ? <label><input type="checkbox" disabled={loading} checked={recordarPassword}
              onChange={e => setRecordarPassword(e.target.checked)} /> Pedir al navegador que guarde la contraseña</label>
              : <span>Tu navegador puede ofrecerte guardar la contraseña al iniciar sesión.</span>}
            <small>El navegador decide si la guarda. NormativaCheck no almacena tu contraseña en este dispositivo. No utilizar en equipos compartidos.</small>
            {canChooseSavedPassword() && <button type="button" className="auth-link" disabled={loading || choosingSavedPassword}
              onClick={handleChooseSavedPassword}>Usar contraseña guardada</button>}
          </div>}
          {notice && <p role="status">{notice}</p>}
          {tab === 'register' && (
            <div className="form-group">
              <label className="form-label" htmlFor="account-name">Nombre</label>
              <input
                id="account-name"
                disabled={loading}
                maxLength={100}
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
              disabled={loading}
              className="form-input"
              name="email"
              type="email"
              placeholder="tu@empresa.com"
              value={form.email}
              onChange={handleChange}
              required
              autoComplete={tab === 'login' ? 'username' : 'email'}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="account-password">Contraseña</label>
            <input
              id="account-password"
              disabled={loading}
              aria-describedby={tab === 'register' ? 'registration-password-help' : undefined}
              className="form-input"
              name="password"
              type="password"
              placeholder={tab === 'register' ? 'Mínimo 8 car., mayúscula, minúscula y número' : '••••••••'}
              value={form.password}
              onChange={handleChange}
              required
              autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
            />
            {tab === 'register' && <p id="registration-password-help">{PASSWORD_HELP}</p>}
          </div>

          {error && (
            <div className="error-banner" role="alert">
              <span>⚠️</span> {error}
            </div>
          )}

          {tab === 'login' && canResend && !localTeacherDemo && (
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
        </form>}

        {!localTeacherDemo && <>
          <p className="auth-switch"><Link to="/forgot-password" className="auth-link" target={embedded ? '_blank' : undefined} rel={embedded ? 'noopener noreferrer' : undefined}>¿Has olvidado tu contraseña?{embedded ? ' (nueva pestaña)' : ''}</Link></p>
          <p className="auth-switch"><Link to="/verify-email" className="auth-link" target={embedded ? '_blank' : undefined} rel={embedded ? 'noopener noreferrer' : undefined}>¿No has confirmado tu correo? Reenviar enlace{embedded ? ' (nueva pestaña)' : ''}</Link></p>
          {embedded && <p>La ayuda se abre en otra pestaña. Conserva esta pestaña para volver a identificarte sin abandonar tu borrador.</p>}
        </>}

        {!embedded && !localTeacherDemo && !registrationComplete && <p className="auth-switch">
          {tab === 'login'
            ? <>¿Sin cuenta? <button className="auth-link" disabled={loading} onClick={() => switchTab('register')}>Regístrate</button></>
            : <>¿Ya tienes cuenta? <button className="auth-link" disabled={loading} onClick={() => switchTab('login')}>Inicia sesión</button></>
          }
        </p>}
      </div>
    </div>
  );
};

export default Auth;
