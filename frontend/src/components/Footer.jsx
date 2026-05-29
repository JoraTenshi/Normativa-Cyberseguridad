import { useState } from 'react';
import { ModalLegal } from './CookieBanner';

export default function Footer() {
  const year = new Date().getFullYear();
  const [modalLegal, setModalLegal] = useState(null);
  return (
    <>
      {modalLegal && (
        <ModalLegal tipo={modalLegal} onCerrar={() => setModalLegal(null)} />
      )}

      <footer className="site-footer">
        <div className="footer-legal">
          <ul>
            <li>
              <button className="footer-legal-btn" onClick={() => setModalLegal('aviso')}>
                Aviso Legal
              </button>
            </li>
            <li>
              <button className="footer-legal-btn" onClick={() => setModalLegal('privacidad')}>
                Política de Privacidad
              </button>
            </li>
            <li>
              <button className="footer-legal-btn" onClick={() => setModalLegal('cookies')}>
                Política de Cookies
              </button>
            </li>
          </ul>
          <span className="footer-copyright">
            © {year} Cyber Law App · Proyecto académico — Evolve Academy
          </span>
        </div>
      </footer>
    </>
  );
}
