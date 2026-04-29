/**
 * pages/Resultado.jsx
 * Página de resultados de la autoevaluación
 * Muestra el porcentaje de cumplimiento con un indicador visual y nivel de madurez
 */

import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Función que determina el nivel de madurez según el porcentaje
const getNivel = (porcentaje) => {
  if (porcentaje >= 85) return { nivel: 'Alto',    color: '#22c55e', emoji: '🟢', clase: 'nivel-alto' };
  if (porcentaje >= 60) return { nivel: 'Medio',   color: '#f59e0b', emoji: '🟡', clase: 'nivel-medio' };
  if (porcentaje >= 30) return { nivel: 'Bajo',    color: '#ef4444', emoji: '🔴', clase: 'nivel-bajo' };
  return                       { nivel: 'Crítico', color: '#7f1d1d', emoji: '⚫', clase: 'nivel-critico' };
};

// Recomendaciones según el nivel de cumplimiento
const RECOMENDACIONES = {
  alto:    ['Mantener y mejorar los controles existentes', 'Buscar certificación formal', 'Realizar auditorías externas periódicas'],
  medio:   ['Priorizar los controles con mayor peso sin cumplir', 'Elaborar un plan de acción con plazos', 'Aumentar la formación del personal'],
  bajo:    ['Realizar un análisis de riesgos urgente', 'Implementar controles básicos de forma inmediata', 'Considerar asesoría externa especializada'],
  critico: ['Declarar situación de emergencia en seguridad', 'Contratar un CISO o consultoría externa', 'Suspender servicios críticos hasta implementar mínimos de seguridad']
};

const Resultado = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user }  = useAuth();

  const { resultado, normativaNombre, normativaId } = location.state || {};

  // Si no hay datos (acceso directo a la URL), redirigir al inicio
  useEffect(() => {
    if (!resultado) {
      navigate('/');
    }
  }, [resultado, navigate]);

  // Estado para la animación del contador de porcentaje
  const [porcentajeAnimado, setPorcentajeAnimado] = useState(0);

  // Animación progresiva del porcentaje al cargar la página
  useEffect(() => {
    if (!resultado) return;
    const target = resultado.porcentaje;
    const duration = 1500; // ms
    const steps = 60;
    const increment = target / steps;
    let current = 0;

    const interval = setInterval(() => {
      current += increment;
      if (current >= target) {
        setPorcentajeAnimado(target);
        clearInterval(interval);
      } else {
        setPorcentajeAnimado(Math.round(current));
      }
    }, duration / steps);

    return () => clearInterval(interval);
  }, [resultado]);

  if (!resultado) return null;

  const nivelInfo = getNivel(resultado.porcentaje);
  const nivelKey = nivelInfo.nivel.toLowerCase();
  const recomendaciones = RECOMENDACIONES[nivelKey] || RECOMENDACIONES.critico;

  return (
    <div className="page resultado-page">
      {/* Cabecera */}
      <div className="resultado-header">
        <h1 className="resultado-titulo">Informe de Cumplimiento</h1>
        <p className="resultado-normativa">{normativaNombre}</p>
      </div>

      {/* Indicador circular de porcentaje */}
      <div className="porcentaje-wrapper">
        <div className={`porcentaje-ring ${nivelInfo.clase}`}>
          <svg viewBox="0 0 200 200" className="ring-svg">
            {/* Fondo del anillo */}
            <circle cx="100" cy="100" r="80" fill="none" strokeWidth="16" className="ring-bg" />
            {/* Arco del progreso */}
            <circle
              cx="100" cy="100" r="80"
              fill="none" strokeWidth="16"
              stroke={nivelInfo.color}
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 80}`}
              strokeDashoffset={`${2 * Math.PI * 80 * (1 - resultado.porcentaje / 100)}`}
              transform="rotate(-90 100 100)"
              className="ring-progress"
            />
          </svg>
          <div className="porcentaje-inner">
            <span className="porcentaje-numero">{porcentajeAnimado}%</span>
            <span className="porcentaje-label">Cumplimiento</span>
          </div>
        </div>
      </div>

      {/* Nivel de madurez */}
      <div className={`nivel-badge ${nivelInfo.clase}`}>
        <span className="nivel-emoji">{nivelInfo.emoji}</span>
        <div>
          <p className="nivel-label">Nivel de madurez</p>
          <p className="nivel-nombre">{nivelInfo.nivel}</p>
        </div>
      </div>

      {/* Mensaje del sistema */}
      <div className="resultado-mensaje">
        <p>{resultado.mensaje}</p>
      </div>

      {/* Puntuación detallada */}
      <div className="puntuacion-detalle">
        <div className="puntuacion-item">
          <span className="puntuacion-valor">{resultado.puntuacion_total.toFixed(1)}</span>
          <span className="puntuacion-label">Puntos obtenidos</span>
        </div>
        <div className="puntuacion-divider" />
        <div className="puntuacion-item">
          <span className="puntuacion-valor">{resultado.puntuacion_maxima}</span>
          <span className="puntuacion-label">Puntos máximos</span>
        </div>
      </div>

      {/* Recomendaciones */}
      <div className="recomendaciones">
        <h2 className="recomendaciones-titulo">📋 Recomendaciones</h2>
        <ul className="recomendaciones-lista">
          {recomendaciones.map((rec, idx) => (
            <li key={idx} className="recomendacion-item">
              <span className="recomendacion-num">{idx + 1}</span>
              {rec}
            </li>
          ))}
        </ul>
      </div>

      {/* Acciones */}
      <div className="resultado-acciones">
        <button
          className="btn-secondary"
          onClick={() => navigate(`/cuestionario/${normativaId}`)}
        >
          🔄 Repetir evaluación
        </button>
        {user && resultado?.id && (
          <button
            className="btn-secondary"
            onClick={() => navigate(`/historial/${resultado.id}`)}
          >
            📋 Ver detalle
          </button>
        )}
        {user ? (
          <button className="btn-primary" onClick={() => navigate('/historial')}>
            📊 Mi historial
          </button>
        ) : (
          <button className="btn-primary" onClick={() => navigate('/')}>
            🏠 Inicio
          </button>
        )}
      </div>
    </div>
  );
};

export default Resultado;
