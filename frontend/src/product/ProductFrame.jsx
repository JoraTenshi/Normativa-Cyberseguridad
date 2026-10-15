import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { confirmLeave } from '../connected/draft-state';
import { ModalLegal } from '../components/CookieBanner';

export function Brand({onClick}) {
  return <Link to="/" className="product-brand" onClick={onClick} aria-label="NormativaCheck, inicio"><span className="product-symbol" aria-hidden="true"><i>n</i><svg viewBox="0 0 20 20"><path d="m4 10 4 4 8-9"/></svg></span><span>Normativa<b>Check</b></span></Link>;
}
export function ProductHeader() {
  const { user, logout } = useAuth(), navigate = useNavigate();
  const [closing,setClosing] = useState(false), [error,setError] = useState('');
  async function close() {
    if(closing || !confirmLeave()) return;
    setClosing(true); setError('');
    try { if(await logout()) navigate('/auth'); else setError('No se ha confirmado el cierre de sesión. Vuelve a intentarlo.'); }
    catch { setError('No se ha confirmado el cierre de sesión. Vuelve a intentarlo.'); }
    finally { setClosing(false); }
  }
  return <><header className="product-header"><Brand/><nav aria-label="Tu cuenta">{user ? <><Link to="/espacio-de-trabajo">Mi espacio</Link><Link to="/historial">Evaluaciones guardadas</Link><Link to="/settings">Mi cuenta</Link><button disabled={closing} onClick={close}>{closing ? 'Cerrando…' : 'Cerrar sesión'}</button></> : <><Link to="/#/demo">Probar la demo</Link><Link to="/auth">Iniciar sesión</Link></>}</nav></header>{error&&<p className="product-error" role="alert">{error}</p>}</>;
}
export function ProductFooter() {
  const [legal,setLegal]=useState(null);
  return <><footer className="product-footer"><span>NormativaCheck · Requisitos, documentación y trabajo conectados.</span><nav aria-label="Información del servicio"><button onClick={()=>setLegal('aviso')}>Información del servicio</button><button onClick={()=>setLegal('privacidad')}>Privacidad</button><button onClick={()=>setLegal('cookies')}>Sesión y almacenamiento</button><Link to="/">Inicio</Link></nav></footer>{legal&&<ModalLegal tipo={legal} onCerrar={()=>setLegal(null)}/>}</>;
}
