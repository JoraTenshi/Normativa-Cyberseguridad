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
import cyberlaw from './images/cyber.png';
import './App.css';

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
            <img src={cyberlaw} alt="" className="navbar-icon" style={{ width: 26, height: 26 }} />
            <span className="navbar-name">CyberLaw</span>
            <span className="navbar-tagline">Audit</span>
          </Link>

          <div className="navbar-right-placeholder" />
        </div>
      </nav>

      <div
        className={`drawer-overlay${open ? ' visible' : ''}`}
        onClick={close}
      />

      <div className={`drawer${open ? ' open' : ''}`}>
        <div className="drawer-header">
          <div className="drawer-logo">
            <img src={cyberlaw} alt="" style={{ width: 16, height: 16 }} />
          </div>
          <span className="drawer-logo-name">CyberLaw</span>
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
              <Route path="*" element={
                <div className="page error-page">
                  <h2>404 — Página no encontrada</h2>
                  <Link to="/" className="btn-primary">Volver al inicio</Link>
                </div>
              } />
            </Routes>
          </main>
          <footer className="footer">
            <p>CyberLaw · Herramienta de Autoevaluación de Ciberseguridad · ISO 27001 · ENS</p>
          </footer>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
