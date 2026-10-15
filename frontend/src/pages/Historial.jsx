import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getHistorial } from '../services/api';

const NIVEL = {
  'Alto':    { emoji: '🟢', clase: 'nivel-alto' },
  'Medio':   { emoji: '🟡', clase: 'nivel-medio' },
  'Bajo':    { emoji: '🔴', clase: 'nivel-bajo' },
  'Crítico': { emoji: '⚫', clase: 'nivel-critico' },
};

const Historial = () => {
  const navigate = useNavigate();
  const { user }  = useAuth();
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando]   = useState(true);
  const [error, setError]         = useState(null);

  useEffect(() => {
    getHistorial()
      .then(setHistorial)
      .catch(() => setError('No se pudo cargar el historial. Comprueba la conexión y vuelve a intentarlo.'))
      .finally(() => setCargando(false));
  }, []);

  if (cargando) {
    return (
      <div className="page loading-page">
        <div className="spinner large" />
        <p>Cargando historial...</p>
      </div>
    );
  }

  return (
    <div className="page historial-page">
      <div className="historial-header">
        <div>
          <h1 className="historial-titulo">Historial de evaluaciones</h1>
          <p className="historial-sub">{user?.nombre} · {historial.length} evaluación(es) registrada(s)</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/espacio-de-trabajo')}>Ir a mi espacio</button>
      </div>

      <p>Consulta las evaluaciones guardadas con el cuestionario anterior y sus planes. Los resultados se conservan en su contexto original; no describen por sí solos la situación actual de tu empresa.</p>
      {error && <div className="error-banner"><span>⚠️</span> {error}</div>}

      {!error && historial.length === 0 && (
        <div className="historial-empty">
          <p>No tienes evaluaciones anteriores guardadas.</p>
          <p className="historial-empty-hint">
            El trabajo actual de tu empresa se organiza en tu espacio.
          </p>
          <button className="btn-primary" onClick={() => navigate('/espacio-de-trabajo')}>Abrir mi espacio</button>
        </div>
      )}

      {historial.length > 0 && (
        <div className="historial-lista">
          {historial.map(item => {
            const nivel = NIVEL[item.nivel] || NIVEL['Crítico'];
            const fecha = new Date(item.createdAt).toLocaleDateString('es-ES', {
              day: '2-digit', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit'
            });
            return (
              <button
                key={item.id}
                className="historial-item"
                onClick={() => navigate(`/historial/${item.id}`)}
              >
                <div className="historial-item-meta">
                  <span className="historial-normativa">{item.normativa_nombre}</span>
                  <span className="historial-fecha">{fecha}</span>
                </div>
                <div className="historial-item-score">
                  <div className="historial-porcentaje-ring">
                    <svg viewBox="0 0 44 44" className="mini-ring-svg">
                      <circle cx="22" cy="22" r="18" fill="none" strokeWidth="4" className="mini-ring-bg" />
                      <circle
                        cx="22" cy="22" r="18"
                        fill="none" strokeWidth="4"
                        stroke={item.nivel === 'Alto' ? '#22c55e' : item.nivel === 'Medio' ? '#f59e0b' : item.nivel === 'Bajo' ? '#ef4444' : '#7f1d1d'}
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 18}`}
                        strokeDashoffset={`${2 * Math.PI * 18 * (1 - item.porcentaje / 100)}`}
                        transform="rotate(-90 22 22)"
                      />
                    </svg>
                    <span className="mini-ring-label">{item.porcentaje}%</span>
                  </div>
                  <span className={`historial-nivel-badge ${nivel.clase}`}>
                    {nivel.emoji} {item.nivel}
                  </span>
                  <span className="historial-arrow">→</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Historial;
