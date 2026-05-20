import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getHistorialDetalle } from '../services/api';

const VALOR_LABEL = { 1: 'Sí', 0.5: 'Parcial', 0: 'No' };
const VALOR_CLASE = { 1: 'resp-si', 0.5: 'resp-parcial', 0: 'resp-no' };

const getNivel = (porcentaje) => {
  if (porcentaje >= 85) return { nivel: 'Alto',    color: '#22c55e', clase: 'nivel-alto' };
  if (porcentaje >= 60) return { nivel: 'Medio',   color: '#f59e0b', clase: 'nivel-medio' };
  if (porcentaje >= 30) return { nivel: 'Bajo',    color: '#ef4444', clase: 'nivel-bajo' };
  return                       { nivel: 'Crítico', color: '#7f1d1d', clase: 'nivel-critico' };
};

const HistorialDetalle = () => {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const [detalle, setDetalle]   = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    getHistorialDetalle(id)
      .then(setDetalle)
      .catch(() => setError('No se pudo cargar el detalle de esta evaluación.'))
      .finally(() => setCargando(false));
  }, [id]);

  if (cargando) {
    return (
      <div className="page loading-page">
        <div className="spinner large" />
        <p>Cargando evaluación...</p>
      </div>
    );
  }

  if (error || !detalle) {
    return (
      <div className="page error-page">
        <span className="error-icon large">⚠️</span>
        <p className="error-message">{error || 'Evaluación no encontrada'}</p>
        <button className="btn-primary" onClick={() => navigate('/historial')}>Volver al historial</button>
      </div>
    );
  }

  const nivelInfo   = getNivel(detalle.porcentaje);
  const mapaResp    = Object.fromEntries(detalle.respuestas.map(r => [r.pregunta_id, r.valor]));
  const fecha       = new Date(detalle.createdAt).toLocaleDateString('es-ES', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  return (
    <div className="page detalle-page">
      <div className="detalle-header">
        <button className="btn-back" onClick={() => navigate('/historial')}>← Historial</button>
        <div>
          <h1 className="detalle-titulo">{detalle.normativa_nombre}</h1>
          <p className="detalle-fecha">{fecha}</p>
        </div>
      </div>

      <div className="detalle-resumen">
        <div className="porcentaje-ring-sm">
          <svg viewBox="0 0 160 160" className="ring-svg">
            <circle cx="80" cy="80" r="64" fill="none" strokeWidth="12" className="ring-bg" />
            <circle
              cx="80" cy="80" r="64"
              fill="none" strokeWidth="12"
              stroke={nivelInfo.color}
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 64}`}
              strokeDashoffset={`${2 * Math.PI * 64 * (1 - detalle.porcentaje / 100)}`}
              transform="rotate(-90 80 80)"
            />
          </svg>
          <div className="porcentaje-inner">
            <span className="porcentaje-numero">{detalle.porcentaje}%</span>
            <span className="porcentaje-label">Cumplimiento</span>
          </div>
        </div>

        <div className="detalle-stats">
          <div className={`nivel-badge ${nivelInfo.clase}`} style={{ marginBottom: '0.75rem' }}>
            <span className="nivel-nombre">{nivelInfo.nivel}</span>
          </div>
          <div className="puntuacion-detalle" style={{ gap: '1.5rem' }}>
            <div className="puntuacion-item">
              <span className="puntuacion-valor">{detalle.puntuacion_total.toFixed(1)}</span>
              <span className="puntuacion-label">Obtenidos</span>
            </div>
            <div className="puntuacion-divider" />
            <div className="puntuacion-item">
              <span className="puntuacion-valor">{detalle.puntuacion_maxima}</span>
              <span className="puntuacion-label">Máximo</span>
            </div>
          </div>
        </div>
      </div>

      <h2 className="section-title" style={{ marginTop: '2rem' }}>Detalle por bloque</h2>

      <div className="bloques-container">
        {detalle.bloques.map(bloque => {
          const totalBloque    = bloque.preguntas.reduce((s, p) => s + p.peso, 0);
          const obtenidoBloque = bloque.preguntas.reduce((s, p) => s + (mapaResp[p.id] ?? 0) * p.peso, 0);
          const pctBloque      = totalBloque > 0 ? Math.round((obtenidoBloque / totalBloque) * 100) : 0;

          return (
            <div key={bloque.id} className="bloque">
              <div className="bloque-header">
                <span className="bloque-nombre">{bloque.nombre}</span>
                <span className="bloque-score-badge">{pctBloque}%</span>
              </div>
              <div className="preguntas-lista">
                {bloque.preguntas.map((pregunta, idx) => {
                  const valor = mapaResp[pregunta.id] ?? 0;
                  return (
                    <div key={pregunta.id} className="pregunta detalle-pregunta">
                      <div className="pregunta-header">
                        <span className="pregunta-numero">{idx + 1}</span>
                        <span className="pregunta-texto">{pregunta.texto}</span>
                        <span className="pregunta-peso">×{pregunta.peso}</span>
                      </div>
                      <div className="detalle-respuesta-row">
                        <span className={`detalle-resp-badge ${VALOR_CLASE[valor]}`}>
                          {VALOR_LABEL[valor]}
                        </span>
                        <span className="detalle-contrib">
                          {(valor * pregunta.peso).toFixed(1)} / {pregunta.peso} pts
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="resultado-acciones">
        <button className="btn-secondary" onClick={() => navigate('/historial')}>
          ← Volver al historial
        </button>
        <button className="btn-secondary" onClick={() => navigate(`/cuestionario/${detalle.normativa}`)}>
          Repetir evaluación
        </button>
        {/* ── Botón Plan Director ── */}
        <button
          className="btn-primary"
          onClick={() => navigate(`/pds/${detalle.id}`)}
        >
          Generar Plan Director
        </button>
      </div>
    </div>
  );
};

export default HistorialDetalle;
