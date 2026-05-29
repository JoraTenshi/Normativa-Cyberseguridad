import { useState, useEffect } from 'react';
import { useConsentimientoCookies } from '../hooks/useConsentimientoCookies';

const TEXTOS_LEGALES = {
  cookies: {
    titulo: 'Política de Cookies',
    contenido: `COOKIES TÉCNICAS (siempre activas)
Son estrictamente necesarias para el funcionamiento de la aplicación: gestión de sesión, autenticación y preferencias básicas de interfaz. No requieren consentimiento conforme al Art. 22.2 LSSI-CE.

COOKIES DE PREFERENCIAS (opcional)
Recuerdan tus ajustes de interfaz (tema de color, idioma) entre sesiones.

COOKIES ANALÍTICAS (opcional)
Nos permiten medir el uso agregado de la aplicación para mejorar la experiencia. No se utilizan para identificarte individualmente.

COOKIES DE MARKETING (opcional)
Actualmente no utilizamos cookies de marketing. Este apartado se reserva para uso futuro.

CÓMO GESTIONAR TU CONSENTIMIENTO
Puedes aceptar, rechazar o configurar las cookies en cualquier momento usando el panel de consentimiento.

BASE LEGAL
El tratamiento de datos se realiza conforme al Art. 22.2 LSSI-CE y el RGPD (UE) 2016/679. Responsable: Cyber Law App — Evolve Academy. Contacto: privacidad@cyber-law.app`,
  },
  privacidad: {
    titulo: 'Política de Privacidad',
    contenido: `RESPONSABLE DEL TRATAMIENTO
Cyber Law App — Proyecto académico Evolve Academy. Contacto: privacidad@cyber-law.app

DATOS QUE RECOGEMOS
— Datos de registro: nombre, dirección de correo electrónico y contraseña (almacenada con hash bcrypt).
— Datos de uso: evaluaciones realizadas, respuestas a cuestionarios y resultados generados.
— Datos técnicos: dirección IP, agente de usuario y cookies técnicas de sesión.

FINALIDAD Y BASE LEGAL
El tratamiento tiene como finalidad la prestación del servicio de autoevaluación de cumplimiento normativo. Base legal: ejecución de contrato (Art. 6.1.b RGPD).

TUS DERECHOS
Tienes derecho de acceso, rectificación, supresión, portabilidad, limitación del tratamiento y oposición. Puedes ejercerlos escribiendo a privacidad@cyber-law.app.

CONSERVACIÓN
Los datos se conservan mientras mantengas cuenta activa. Al eliminar tu cuenta, los datos se suprimen en un plazo máximo de 30 días.

DESTINATARIOS
No cedemos datos a terceros salvo obligación legal. El servicio se aloja en servidores de Hetzner (Alemania), bajo el ámbito del RGPD.`,
  },
  aviso: {
    titulo: 'Aviso Legal',
    contenido: `IDENTIFICACIÓN
En cumplimiento del Art. 10 de la Ley 34/2002 LSSI-CE: Denominación: Cyber Law App · Naturaleza: Proyecto académico — Evolve Academy · Contacto: contacto@cyber-law.app

OBJETO
Esta aplicación es una herramienta de autoevaluación del nivel de cumplimiento normativo en materia de ciberseguridad. Los resultados tienen carácter orientativo y no constituyen asesoramiento jurídico profesional.

PROPIEDAD INTELECTUAL
Los contenidos de esta aplicación son propiedad de sus autores y están protegidos por la legislación de propiedad intelectual. Queda prohibida su reproducción sin autorización expresa.

LIMITACIÓN DE RESPONSABILIDAD
Los autores no se responsabilizan del uso que terceros hagan de los informes generados ni de las decisiones adoptadas en base a los mismos.

LEGISLACIÓN APLICABLE
Este aviso legal se rige por la legislación española. Las partes se someten a los Juzgados y Tribunales de España.`,
  },
};

export function ModalLegal({ tipo, onCerrar }) {
  const texto = TEXTOS_LEGALES[tipo];
  if (!texto) return null;

  return (
    <div className="modal-legal-overlay" onClick={onCerrar}>
      <div className="modal-legal" onClick={e => e.stopPropagation()}>
        <div className="modal-legal-header">
          <h2 className="modal-legal-titulo">{texto.titulo}</h2>
          <button className="modal-legal-cerrar" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </div>
        <div className="modal-legal-body">
          {texto.contenido.split('\n\n').map((parrafo, i) => {
            const esTitulo = parrafo === parrafo.toUpperCase() && parrafo.length < 80;
            return esTitulo
              ? <h3 key={i} className="modal-legal-seccion">{parrafo}</h3>
              : <p   key={i} className="modal-legal-parrafo">{parrafo}</p>;
          })}
        </div>
        <div className="modal-legal-footer">
          <button className="btn-secondary" onClick={onCerrar}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

export default function CookieBanner() {
  const { estado, aceptarTodo, rechazarTodo, configurar } = useConsentimientoCookies();
  const [verConfig, setVerConfig]   = useState(false);
  const [modalLegal, setModalLegal] = useState(null);
  const [cfg, setCfg] = useState({ preferencias: false, analitica: false, marketing: false });

  useEffect(() => {
    const bloquear = estado === null || estado === undefined;
    document.body.style.overflow = bloquear ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [estado]);

  if (estado === undefined) return null;
  if (estado !== null)      return null;

  return (
    <>
      {modalLegal && (
        <ModalLegal tipo={modalLegal} onCerrar={() => setModalLegal(null)} />
      )}

      <div className="cookie-overlay" />

      <div role="dialog" aria-labelledby="cb-title" className="cookie-banner">
        <div className="cookie-banner-header">
          <h3 id="cb-title" className="cookie-banner-title">🍪 Usamos cookies</h3>
          <button
            className="modal-legal-cerrar"
            onClick={rechazarTodo}
            aria-label="Cerrar sin aceptar"
            title="Cerrar (se volverá a mostrar en la próxima visita)"
          >✕</button>
        </div>

        <p className="cookie-banner-desc">
          Utilizamos cookies técnicas estrictamente necesarias para que la aplicación funcione.
          También podemos usar, con tu consentimiento, cookies de preferencias, analítica y marketing.{' '}
          <button className="cookie-link-btn" onClick={() => setModalLegal('cookies')}>
            Política de Cookies
          </button>
          {' '}·{' '}
          <button className="cookie-link-btn" onClick={() => setModalLegal('privacidad')}>
            Política de Privacidad
          </button>
        </p>

        {!verConfig ? (
          <div className="cookie-banner-actions">
            <button className="btn-primary"   onClick={aceptarTodo}>Aceptar todo</button>
            <button className="btn-secondary" onClick={rechazarTodo}>Rechazar todo</button>
            <button className="btn-secondary" onClick={() => setVerConfig(true)}>Configurar</button>
          </div>
        ) : (
          <div className="cookie-banner-config">
            {[
              { key: 'preferencias', label: 'Preferencias', desc: 'Tema, idioma y ajustes de interfaz' },
              { key: 'analitica',    label: 'Analítica',    desc: 'Uso agregado para mejorar la app' },
              { key: 'marketing',    label: 'Marketing',    desc: 'Actualmente no utilizadas' },
            ].map(({ key, label, desc }) => (
              <label key={key} className="cookie-toggle">
                <input
                  type="checkbox"
                  checked={cfg[key]}
                  onChange={e => setCfg(p => ({ ...p, [key]: e.target.checked }))}
                />
                <div className="cookie-toggle-text">
                  <span className="cookie-toggle-label">{label}</span>
                  <span className="cookie-toggle-desc">{desc}</span>
                </div>
              </label>
            ))}
            <div className="cookie-banner-actions">
              <button className="btn-primary"   onClick={() => configurar(cfg)}>Guardar selección</button>
              <button className="btn-secondary" onClick={() => setVerConfig(false)}>Volver</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export { TEXTOS_LEGALES };
