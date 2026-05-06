import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { get2faSetup, enable2fa, disable2fa } from '../services/api';

const Settings = () => {
  const { user, login } = useAuth();

  const [step, setStep]         = useState('idle'); // idle | setup | confirm-disable
  const [qr, setQr]             = useState(null);
  const [secret, setSecret]     = useState(null);
  const [totpCode, setTotpCode] = useState('');
  const [error, setError]       = useState(null);
  const [success, setSuccess]   = useState(null);
  const [loading, setLoading]   = useState(false);

  const startSetup = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const data = await get2faSetup();
      setQr(data.qr);
      setSecret(data.secret);
      setStep('setup');
      setTotpCode('');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al generar el código QR');
    } finally {
      setLoading(false);
    }
  };

  const confirmEnable = async e => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await enable2fa(totpCode);
      login({ ...user, twoFactorEnabled: true });
      setStep('idle');
      setSuccess('Autenticación en dos pasos activada.');
      setTotpCode('');
    } catch (err) {
      setError(err.response?.data?.error || 'Código incorrecto');
    } finally {
      setLoading(false);
    }
  };

  const confirmDisable = async e => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await disable2fa(totpCode);
      login({ ...user, twoFactorEnabled: false });
      setStep('idle');
      setSuccess('Autenticación en dos pasos desactivada.');
      setTotpCode('');
    } catch (err) {
      setError(err.response?.data?.error || 'Código incorrecto');
    } finally {
      setLoading(false);
    }
  };

  const cancel = () => {
    setStep('idle');
    setError(null);
    setTotpCode('');
    setQr(null);
    setSecret(null);
  };

  return (
    <div className="page settings-page">
      <h1 className="page-title">Ajustes de cuenta</h1>

      <div className="settings-section">
        <h2 className="settings-section-title">Seguridad</h2>

        <div className="settings-row">
          <div>
            <div className="settings-label">Autenticación en dos pasos (2FA)</div>
            <div className="settings-desc">
              Protege tu cuenta con un código TOTP generado por tu aplicación de autenticación.
            </div>
          </div>
          <span className={`settings-badge ${user?.twoFactorEnabled ? 'enabled' : 'disabled'}`}>
            {user?.twoFactorEnabled ? 'Activado' : 'Desactivado'}
          </span>
        </div>

        {success && (
          <div className="success-banner" style={{ marginTop: '1rem' }}>
            {success}
          </div>
        )}

        {/* ── Setup flow ─── */}
        {step === 'idle' && (
          <div className="twofa-actions">
            {user?.twoFactorEnabled ? (
              <button className="btn-danger" onClick={() => { setStep('confirm-disable'); setError(null); setTotpCode(''); }}>
                Desactivar 2FA
              </button>
            ) : (
              <button className="btn-primary" onClick={startSetup} disabled={loading}>
                {loading ? 'Generando...' : 'Activar 2FA'}
              </button>
            )}
          </div>
        )}

        {step === 'setup' && (
          <div className="twofa-setup">
            <p className="twofa-instruction">
              1. Escanea el código QR con Google Authenticator, Authy u otra app TOTP.<br />
              2. Si no puedes escanear, introduce manualmente la clave secreta.<br />
              3. Introduce el código de 6 dígitos que genera la app para confirmar.
            </p>
            {qr && <img src={qr} alt="QR 2FA" className="twofa-qr" />}
            <div className="twofa-secret">{secret}</div>

            <form onSubmit={confirmEnable}>
              <div className="form-group">
                <label className="form-label">Código de verificación</label>
                <input
                  className="form-input twofa-code-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="000000"
                  value={totpCode}
                  onChange={e => setTotpCode(e.target.value)}
                  required
                  autoComplete="one-time-code"
                />
              </div>

              {error && <div className="error-banner"><span>⚠️</span> {error}</div>}

              <div className="twofa-actions">
                <button type="submit" className="btn-primary" disabled={loading || totpCode.length !== 6}>
                  {loading ? 'Verificando...' : 'Confirmar y activar'}
                </button>
                <button type="button" className="btn-secondary" onClick={cancel}>Cancelar</button>
              </div>
            </form>
          </div>
        )}

        {step === 'confirm-disable' && (
          <div className="twofa-setup">
            <p className="twofa-instruction">
              Introduce el código actual de tu app de autenticación para confirmar la desactivación.
            </p>
            <form onSubmit={confirmDisable}>
              <div className="form-group">
                <label className="form-label">Código de verificación</label>
                <input
                  className="form-input twofa-code-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="000000"
                  value={totpCode}
                  onChange={e => setTotpCode(e.target.value)}
                  required
                  autoComplete="one-time-code"
                />
              </div>

              {error && <div className="error-banner"><span>⚠️</span> {error}</div>}

              <div className="twofa-actions">
                <button type="submit" className="btn-danger" disabled={loading || totpCode.length !== 6}>
                  {loading ? 'Procesando...' : 'Confirmar desactivación'}
                </button>
                <button type="button" className="btn-secondary" onClick={cancel}>Cancelar</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
