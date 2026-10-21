import React from 'react';
import { createBrowserRouter, RouterProvider, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import PublicExperience from './public-experience/main';
import { ProductHeader, ProductFooter } from './product/ProductFrame';
import PreviousEvaluationNotice from './product/PreviousEvaluationNotice';
import Auth             from './pages/Auth';
import VerifyEmail      from './pages/VerifyEmail';
import ForgotPassword   from './pages/ForgotPassword';
import ResetPassword    from './pages/ResetPassword';
import Historial        from './pages/Historial';
import HistorialDetalle from './pages/HistorialDetalle';
import Settings         from './pages/Settings';
import PlanDirector     from './pages/PlanDirector';
import ApiWorkspace from './connected/ApiWorkspace';
import EnrollmentPortal from './connected/EnrollmentPortal';
import SessionBoundary from './session/SessionBoundary';
import DraftNavigationGuard from './session/DraftNavigationGuard';
import CookieBanner     from './components/CookieBanner';
import LearningGuideProvider, { LearningRouteSurface } from './connected/learning-guide/LearningGuide';

import './App.css';
import './product/green-theme.css';

function ProtectedRoute({ children }) {
  const { user, phase, machine, error } = useAuth();
  const navigate = useNavigate();
  React.useEffect(() => {
    if (phase === 'anonymous' && !user) navigate('/auth', { replace:true, state:{ from:window.location.pathname } });
  }, [user, phase, navigate]);
  // Keep mounted during a lock: SessionBoundary hides it without losing the draft.
  if (user) return children;
  return <section className="session-loading" role="status">
    <p>{phase === 'unavailable' ? error : 'Comprobando sesión…'}</p>
    {phase === 'unavailable' && <button onClick={() => machine.sync()}>Reintentar conexión</button>}
  </section>;
}

function Application() {
  const location = useLocation();
  const publicPage = location.pathname === '/';
  const workspace = ['/espacio-de-trabajo', '/solicitudes-de-alta', '/administracion/altas'].includes(location.pathname.replace(/\/$/, ''));
  return (
    <>
        <DraftNavigationGuard />
        <SessionBoundary><LearningGuideProvider><div className="app green-app">
          <CookieBanner />
          {!workspace && !publicPage && <ProductHeader />}
          <div className={workspace || publicPage ? 'workspace-content' : 'main-content'}>
            <LearningRouteSurface><Routes>
              <Route path="/"          element={<PublicExperience />} />
              <Route path="/cuestionario/:normativaId" element={<PreviousEvaluationNotice />} />
              <Route path="/resultado" element={<PreviousEvaluationNotice />} />
              <Route path="/auth"      element={<Auth />} />
              <Route path="/solicitudes-de-alta" element={<ProtectedRoute><EnrollmentPortal /></ProtectedRoute>} />
              <Route path="/administracion/altas" element={<ProtectedRoute><EnrollmentPortal admin /></ProtectedRoute>} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/pds/:resultadoId" element={<ProtectedRoute><PlanDirector /></ProtectedRoute>} />
              <Route path="/espacio-de-trabajo" element={
    <ProtectedRoute>
      <ApiWorkspace />
    </ProtectedRoute>
  }
/>
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/historial" element={<ProtectedRoute><Historial /></ProtectedRoute>} />
              <Route path="/historial/:id" element={<ProtectedRoute><HistorialDetalle /></ProtectedRoute>} />
              <Route path="/settings"     element={<ProtectedRoute><Settings /></ProtectedRoute>} />

              <Route path="*" element={
                <div className="page error-page">
                  <h2>404 — Página no encontrada</h2>
                  <Link to="/" className="btn-primary">Volver al inicio</Link>
                </div>
              } />
            </Routes></LearningRouteSurface>
          </div>
          <ProductFooter />
        </div></LearningGuideProvider></SessionBoundary>
    </>
  );
}

const router = createBrowserRouter([{ path:'*', element:<Application /> }]);
function App() { return <AuthProvider><RouterProvider router={router}/></AuthProvider>; }
export default App;
