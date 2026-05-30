import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Home             from './pages/Home';
import Cuestionario     from './pages/Cuestionario';
import Resultado        from './pages/Resultado';
import Auth             from './pages/Auth';
import Historial        from './pages/Historial';
import HistorialDetalle from './pages/HistorialDetalle';
import Settings         from './pages/Settings';
import PlanDirector from './pages/PlanDirector';
import cyberlaw from './images/cyber.png';
import DevToolsEasterEgg from './components/useJoseEE';
import './App.css';
import CookieBanner from './components/CookieBanner';
import Footer from './components/Footer';


function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);

  const close = () => setOpen(false);

  const handleLogout = () => {
    logout();
    navigate('/');
    close();
  };

  return (
    <>
      <nav className="navbar">
        <div className="navbar-left">
            <button
              className={`hamburger-btn${open ? ' open' : ''}`}
              onClick={() => setOpen(v => !v)}
              aria-label="Menú"
            >
              <span className="ham-line" />
              <span className="ham-line" />
              <span className="ham-line" />
            </button>
          </div>
        <div className="navbar-inner">
          <Link to="/" className="navbar-brand" onClick={close}>
            <img src={cyberlaw} alt="" className="navbar-icon" />
            <span className="navbar-name">
              <span class="letter">C</span>
              <span class="letter">Y</span>
              <span class="letter">B</span>
              <span class="letter">E</span>
              <span class="letter">R</span>
              <span class="letter">L</span>
              <span class="letter">A</span>
              <span class="letter">W</span>
            </span>
          </Link>

          <div className="navbar-right-placeholder" />
        </div>
      </nav>

      {/* Overlay */}
      <div
        className={`drawer-overlay${open ? ' visible' : ''}`}
        onClick={close}
      />

      {/* Drawer */}
      <div className={`drawer${open ? ' open' : ''}`}>
        <div className="drawer-header">
          <span className="drawer-logo-name">CyberLaw</span>
          <button className="drawer-close-btn" onClick={close} aria-label="Cerrar menú">
            {'<<<'}
          </button>
        </div>

        <div className="drawer-body">
          {user ? (
            <>
              <span className="drawer-section-label">Cuenta</span>
              <div className="drawer-item user-item">{user.nombre}</div>
              <div className="drawer-divider" />
              <span className="drawer-section-label">Navegación</span>
              <Link to="/" className="drawer-item" onClick={close}>Inicio</Link>
              <Link to="/historial" className="drawer-item" onClick={close}>Historial</Link>
              <Link to="/settings" className="drawer-item" onClick={close}>Ajustes</Link>
            </>
          ) : (
            <>
              <span className="drawer-section-label">Navegación</span>
              <Link to="/" className="drawer-item" onClick={close}>Inicio</Link>
            </>
          )}
        </div>

        <div className="drawer-footer">
          {user ? (
            <button className="drawer-item danger" onClick={handleLogout}>
              Cerrar sesión
            </button>
          ) : (
            <Link to="/auth" className="drawer-item login-item" onClick={close}>
              Iniciar sesión
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
function ProtectedRoute({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  React.useEffect(() => {
    if (!user) navigate('/auth', { replace: true, state: { from: window.location.pathname } });
  }, [user, navigate]);
  return user ? children : null;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app">
          <DevToolsEasterEgg />
          <CookieBanner />
          <Navbar />
          <main className="main-content">
            <Routes>
              <Route path="/"          element={<Home />} />
              <Route path="/cuestionario/:normativaId" element={<Cuestionario />} />
              <Route path="/resultado" element={<Resultado />} />
              <Route path="/auth"      element={<Auth />} />
              <Route path="/historial" element={<ProtectedRoute><Historial /></ProtectedRoute>} />
              <Route path="/historial/:id" element={<ProtectedRoute><HistorialDetalle /></ProtectedRoute>} />
              <Route path="/settings"     element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/pds/:resultadoId"element={<ProtectedRoute><PlanDirector /></ProtectedRoute>}/>
              <Route path="*" element={
                <div className="page error-page">
                  <h2>404 — Página no encontrada</h2>
                  <Link to="/" className="btn-primary">Volver al inicio</Link>
                </div>
              } />
            </Routes>
          </main>
          <footer className="footer">
           <Footer />            
          </footer>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
