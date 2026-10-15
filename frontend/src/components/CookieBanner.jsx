import { useState, useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { useConsentimientoCookies } from '../hooks/useConsentimientoCookies';

// Factual information for the restricted validation cut, not a final policy.
const TEXTOS_LEGALES = {
  cookies: {
    titulo: 'Sesión y almacenamiento local',
    secciones: [
      ['Tu cuenta', 'El acceso al espacio de empresa utiliza cookies de sesión y controles de autenticación. La opción «Mantener la sesión» permite conservarla al cerrar y volver a abrir el navegador, sin ampliar los mismos límites: hasta 8 horas desde el acceso y 30 minutos sin actividad. Cierra la sesión al terminar, especialmente en equipos compartidos.'],
      ['La demostración', 'La demo trabaja con datos ficticios y conserva tus cambios en el almacenamiento de este navegador. Es independiente de los documentos y actuaciones guardados en el servidor de tu organización. No introduzcas datos personales ni información confidencial en la demo.'],
      ['Sin opciones publicitarias', 'Esta versión no incorpora herramientas de analítica ni publicidad. No solicitamos autorización genérica para incorporarlas en el futuro. Cerrar este aviso solo recuerda que lo has visto; no acepta condiciones ni activa servicios opcionales.'],
      ['Vuelve cuando lo necesites', 'Puedes consultar esta información desde «Sesión y almacenamiento» en el pie de la página. Si habías elegido opciones en el panel anterior, el botón siguiente las deja desactivadas. No borra la demo, los documentos ni la sesión. Las cookies y el almacenamiento también se pueden gestionar desde tu navegador; borrarlos puede cerrar tu sesión o reiniciar la demo.'],
    ],
  },
  privacidad: {
    titulo: 'Información sobre privacidad',
    secciones: [
      ['Responsable de los datos de las cuentas', 'José Luis Burguera Gómez. Contacto para consultas y solicitudes de privacidad: normativacheck@gmail.com. Este contacto no identifica al remitente técnico de los correos de verificación o recuperación.'],
      ['Qué información maneja esta versión', 'El registro solicita nombre, correo y contraseña. El espacio de empresa permite guardar solicitudes de alta, actividad declarada, documentos, actuaciones y sus versiones, de acuerdo con los permisos de cada cuenta. La infraestructura registra información técnica de acceso y seguridad. La demo, en cambio, conserva su progreso ficticio en el navegador.'],
      ['Validación restringida', 'Esta versión está destinada a pruebas controladas con información ficticia, no a incorporar documentación real de clientes. No aportes datos personales o confidenciales de terceros. Que el proyecto sea académico no elimina las obligaciones de protección de datos.'],
      ['Información pendiente antes de admitir clientes', 'Esta información no constituye una política de privacidad definitiva. Quedan por concretar y validar las finalidades y bases jurídicas por tratamiento, los proveedores y destinatarios, las transferencias que correspondan y los plazos de conservación. Los papeles respecto de datos aportados por empresas deben determinarse para cada tratamiento; no se atribuyen automáticamente al responsable de las cuentas.'],
      ['Consultas sobre tus datos', 'Puedes dirigirte a normativacheck@gmail.com para plantear consultas o solicitudes sobre tus datos. Este aviso no afirma que se haya probado la recepción del buzón ni el envío de correos de la aplicación.'],
    ],
  },
  aviso: {
    titulo: 'Información del servicio',
    secciones: [
      ['NormativaCheck', 'Proyecto académico desarrollado por un equipo de trabajo para conectar requisitos de seguridad, documentación y actuaciones. La demo utiliza un caso ficticio; el espacio de empresa requiere cuenta verificada y solicitud aprobada.'],
      ['Qué ofrece y qué no', 'La herramienta permite organizar información y registrar revisiones con su contexto. Una tarea terminada o un documento adjunto no certifica el cumplimiento de una empresa ni sustituye la revisión profesional que corresponda.'],
      ['Estado de esta versión', 'Acceso restringido a validación con datos ficticios. La información jurídica y las condiciones para admitir clientes reales están pendientes de completar y validar. No se presenta este texto como un contrato, una exención de responsabilidad ni un aviso legal definitivo.'],
      ['Contacto sobre cuentas y privacidad', 'José Luis Burguera Gómez · normativacheck@gmail.com. No se atribuye la prestación del servicio a una sociedad o entidad académica no confirmada.'],
    ],
  },
};

function CloseIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
}

export function ModalLegal({ tipo, onCerrar }) {
  const ref = useRef(null), closeRef = useRef(onCerrar), titleId = useId();
  const { desactivarOpcionales } = useConsentimientoCookies();
  const [resultado, setResultado] = useState('');
  const texto = TEXTOS_LEGALES[tipo];
  closeRef.current = onCerrar;
  useEffect(() => {
    if (!texto) return undefined;
    const previous = document.activeElement, el = ref.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    el.querySelector('button').focus();
    function keydown(event) {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRef.current(); }
      if (event.key === 'Tab') {
        const buttons = [...el.querySelectorAll('button:not(:disabled),a[href]')];
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    el.addEventListener('keydown', keydown);
    return () => { el.removeEventListener('keydown', keydown); document.body.style.overflow = overflow; previous?.focus?.(); };
  }, [texto]);
  if (!texto) return null;
  return createPortal(<div className="green-app modal-legal-overlay" onClick={onCerrar}>
    <section ref={ref} className="modal-legal" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={e => e.stopPropagation()}>
      <div className="modal-legal-header"><h2 id={titleId} className="modal-legal-titulo">{texto.titulo}</h2><button type="button" className="modal-legal-cerrar" onClick={onCerrar} aria-label="Cerrar información"><CloseIcon/></button></div>
      <div className="modal-legal-body">{texto.secciones.map(([heading,body]) => <section key={heading}><h3 className="modal-legal-seccion">{heading}</h3><p className="modal-legal-parrafo">{body}</p></section>)}
        {tipo === 'cookies' && <><button type="button" className="btn-secondary" onClick={() => setResultado(desactivarOpcionales() ? 'Opciones anteriores desactivadas. La demo y la sesión se conservan.' : 'El navegador no permite guardar esta preferencia. Esta versión no activa servicios opcionales; puedes gestionar los datos locales desde tu navegador.')}>Desactivar opciones del panel anterior</button>{resultado && <p role="status">{resultado}</p>}</>}
      </div>
      <div className="modal-legal-footer"><button type="button" className="btn-secondary" onClick={onCerrar}>Volver</button></div>
    </section>
  </div>, document.body);
}

export function PrivacyAccess({label = 'Información sobre privacidad'}) {
  const [open,setOpen] = useState(false);
  return <><button type="button" className="cookie-link-btn" onClick={() => setOpen(true)}>{label}</button>{open && <ModalLegal tipo="privacidad" onCerrar={() => setOpen(false)}/>}</>;
}

export default function CookieBanner() {
  const { estado, recordarAviso } = useConsentimientoCookies();
  const [info,setInfo] = useState(false);
  if (estado !== null) return null;
  return <aside className="storage-notice" aria-label="Información de almacenamiento">
    <div><strong>Sesión y almacenamiento local</strong><p>La sesión permite acceder a tu cuenta; la demo guarda su progreso en este navegador. Esta versión no incorpora analítica ni publicidad.</p></div>
    <div className="storage-notice-actions"><button type="button" className="btn-secondary" onClick={() => setInfo(true)}>Ver información</button><button type="button" className="btn-primary" onClick={recordarAviso}>Entendido</button><button type="button" className="modal-legal-cerrar" aria-label="Cerrar aviso de almacenamiento" title="Cerrar el aviso sin activar servicios opcionales" onClick={recordarAviso}><CloseIcon/></button></div>
    {info && <ModalLegal tipo="cookies" onCerrar={() => setInfo(false)}/>}
  </aside>;
}

export { TEXTOS_LEGALES };
