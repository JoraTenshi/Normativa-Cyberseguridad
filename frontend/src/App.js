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
import './App.css';

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand">
          <span className="navbar-icon">🛡️</span>
          <span className="navbar-name">CyberAudit</span>
        </Link>

        <div className="navbar-right">
          {user ? (
            <>
              <Link to="/historial" className="navbar-link">Historial</Link>
              <Link to="/settings" className="navbar-link">Ajustes</Link>
              <span className="navbar-user">{user.nombre}</span>
              <button className="navbar-logout" onClick={handleLogout}>Salir</button>
            </>
          ) : (
            <Link to="/auth" className="btn-primary navbar-login-btn">Iniciar sesión</Link>
          )}
        </div>
      </div>
    </nav>
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
            <p>CyberAudit · Herramienta de Autoevaluación de Ciberseguridad · ISO 27001 · ENS</p>
          </footer>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
