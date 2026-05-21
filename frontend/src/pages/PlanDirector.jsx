import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPlanDirector } from '../services/api';

const getNivelInfo = (nivel) => {
  const map = {
    'Alto':    { clase: 'nivel-alto',    color: '#22c55e' },
    'Medio':   { clase: 'nivel-medio',   color: '#f59e0b' },
    'Bajo':    { clase: 'nivel-bajo',    color: '#ef4444' },
    'Crítico': { clase: 'nivel-critico', color: '#7f1d1d' },
  };
  return map[nivel] || map['Crítico'];
};

const NIVEL_ACCION = {
  alto:    { clase: 'resp-si',      label: 'Alto' },
  medio:   { clase: 'resp-parcial', label: 'Medio' },
  bajo:    { clase: 'resp-no',      label: 'Bajo' },
  critico: { clase: 'resp-no',      label: 'Crítico' },
};

const VALOR_ACCION = {
  0:   { clase: 'resp-no',      label: 'No cumplido' },
  0.5: { clase: 'resp-parcial', label: 'Parcial' },
};

const PdsAccion = ({ accion, idx }) => {
  const nivelBadge = NIVEL_ACCION[accion.nivel?.toLowerCase()] || NIVEL_ACCION.bajo;
  const valorBadge = VALOR_ACCION[accion.valor_actual];

  return (
    <div className="pds-accion">
      <div className="pds-accion-badges">
        <span className={`detalle-resp-badge ${nivelBadge.clase}`}>
          {nivelBadge.label}
        </span>
        {valorBadge && (
          <span className={`detalle-resp-badge ${valorBadge.clase}`}>
            {valorBadge.label}
          </span>
        )}
        {accion.bloque && (
          <span className="pds-bloque-badge">{accion.bloque}</span>
        )}
      </div>
      <p className="pds-accion-texto">{accion.accion}</p>
      {accion.descripcion && (
        <p className="pds-accion-desc">{accion.descripcion}</p>
      )}
      {accion.prioridad != null && (
        <div className="pds-prioridad">
          <span className="pds-prioridad-label">Prioridad</span>
          <div className="pds-prioridad-bar-track">
            <div
              className="pds-prioridad-bar-fill"
              style={{ width: `${Math.min(100, (accion.prioridad / 10) * 100)}%` }}
            />
          </div>
          <span className="pds-prioridad-valor">{accion.prioridad.toFixed(1)}</span>
        </div>
      )}
    </div>
  );
};

const PdsFase = ({ fase, usaFases }) => {
  const [expandida, setExpandida] = useState(true);

  return (
    <div className="pds-fase">
      {usaFases && (
        <button
          className="pds-fase-header"
          onClick={() => setExpandida(v => !v)}
          aria-expanded={expandida}
        >
          <div className="pds-fase-header-left">
            {fase.fase != null && (
              <span className="pds-fase-num">Fase {fase.fase}</span>
            )}
            <span className="pds-fase-nombre">{fase.nombre}</span>
          </div>
          <div className="pds-fase-header-right">
            <span className="bloque-count">{fase.acciones.length} acción(es)</span>
            <span className="pds-fase-chevron">{expandida ? '▲' : '▼'}</span>
          </div>
        </button>
      )}
      {expandida && (
        <div className="pds-acciones-lista">
          {fase.acciones.map((accion, idx) => (
            <PdsAccion key={accion.pregunta_id || idx} accion={accion} idx={idx} />
          ))}
        </div>
      )}
    </div>
  );
};

const PdsHeader = ({ pds }) => {
  const nivelInfo = getNivelInfo(pds.nivel);

  return (
    <div className="resultado-header pds-cabecera">
      <div>
        <p className="resultado-normativa">{pds.normativa_nombre}</p>
        <h1 className="resultado-titulo">Plan Director de Seguridad</h1>
        {pds.usa_fases_incibe && (
          <p className="pds-marco-label">Estructurado según el marco INCIBE de 5 fases</p>
        )}
      </div>
      <div className="pds-header-stats">
        <div className="puntuacion-detalle" style={{ width: 'fit-content' }}>
          <div className="puntuacion-item">
            <span className="puntuacion-valor">{pds.porcentaje}%</span>
            <span className="puntuacion-label">Cumplimiento</span>
          </div>
          <div className="puntuacion-divider" />
          <div className="puntuacion-item">
            <span className="puntuacion-valor">{pds.total_acciones}</span>
            <span className="puntuacion-label">Acciones</span>
          </div>
          <div className="puntuacion-divider" />
          <div className="puntuacion-item">
            <span className={`puntuacion-valor pds-nivel-valor ${nivelInfo.clase}`} style={{ color: nivelInfo.color }}>
              {pds.nivel}
            </span>
            <span className="puntuacion-label">Nivel</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const PlanDirector = () => {
  const { resultadoId } = useParams();
  const navigate        = useNavigate();
  const [pds, setPds]           = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError]       = useState(null);

  const fetchPds = () => {
    setCargando(true);
    setError(null);
    getPlanDirector(resultadoId)
      .then(setPds)
      .catch(err => {
        const status = err.response?.status;
        if (status === 404) {
          setError('Plan Director no encontrado. Es posible que la evaluación haya sido eliminada o no exista.');
        } else {
          setError('No se pudo generar el Plan Director. Inténtalo de nuevo más tarde.');
        }
      })
      .finally(() => setCargando(false));
  };

  useEffect(() => { fetchPds(); }, [resultadoId]);

  if (cargando) {
    return (
      <div className="page loading-page">
        <div className="spinner large" />
        <p>Generando tu Plan Director...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page error-page">
        <span className="error-icon large">⚠️</span>
        <p className="error-message">{error}</p>
        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          {error.includes('no encontrado') ? (
            <button className="btn-primary" onClick={() => navigate('/historial')}>
              Volver al historial
            </button>
          ) : (
            <>
              <button className="btn-secondary" onClick={() => navigate('/historial')}>
                Volver al historial
              </button>
              <button className="btn-primary" onClick={fetchPds}>
                Reintentar
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!pds) return null;

  if (pds.total_acciones === 0) {
    return (
      <div className="page resultado-page">
        <PdsHeader pds={pds} />
        <div className="success-banner" style={{ textAlign: 'center', padding: '2rem', marginTop: '1rem' }}>
          <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>✓</p>
          <p style={{ fontWeight: 600, marginBottom: '0.35rem' }}>Sin acciones de remediación pendientes</p>
          <p style={{ fontSize: '0.88rem' }}>
            Tu nivel de cumplimiento en esta normativa es alto. No se han detectado gaps que requieran acción inmediata.
          </p>
        </div>
        <div className="resultado-acciones" style={{ marginTop: '1.5rem' }}>
          <button className="btn-secondary" onClick={() => navigate('/historial')}>
            Volver al historial
          </button>
        </div>
      </div>
    );
  }

  const fasesConAcciones = pds.plan.filter(f => f.acciones?.length > 0);

  return (
    <div className="page pds-page">
      <div className="pds-back-row">
        <button className="btn-back" onClick={() => navigate(-1)}>← Volver</button>
      </div>

      <PdsHeader pds={pds} />

      {!pds.usa_fases_incibe && (
        <div className="pds-aviso-plano">
          Las acciones se muestran ordenadas por prioridad. El desglose por fases INCIBE no está disponible para esta normativa todavía.
        </div>
      )}

      <div className="pds-fases-container">
        {fasesConAcciones.map((fase, idx) => (
          <PdsFase
            key={fase.fase ?? idx}
            fase={fase}
            usaFases={pds.usa_fases_incibe}
          />
        ))}
      </div>

      <div className="resultado-acciones">
        <button className="btn-secondary" onClick={() => navigate('/historial')}>
          ← Historial
        </button>
        <button className="btn-primary" onClick={() => navigate(`/cuestionario/${pds.normativa}`)}>
          Repetir evaluación
        </button>
      </div>
    </div>
  );
};

export default PlanDirector;
