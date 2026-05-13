import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Cuestionario from './pages/Cuestionario.jsx';
import Resultado from './pages/Resultado.jsx';
import LanguageSelector from './components/LanguageSelector.jsx';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="flex justify-end px-6 py-3 border-b border-slate-800">
        <LanguageSelector />
      </div>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/cuestionario/:id" element={<Cuestionario />} />
        <Route path="/resultado/:id" element={<Resultado />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
