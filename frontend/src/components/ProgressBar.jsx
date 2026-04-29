/**
 * components/ProgressBar.jsx
 * Barra de progreso del cuestionario
 * Muestra cuántas preguntas se han contestado sobre el total
 */

import React from 'react';

const ProgressBar = ({ contestadas, total }) => {
  const porcentaje = total > 0 ? Math.round((contestadas / total) * 100) : 0;

  return (
    <div className="progress-container">
      <div className="progress-info">
        <span className="progress-label">Progreso del cuestionario</span>
        <span className="progress-count">{contestadas} / {total} preguntas</span>
      </div>
      <div className="progress-bar-track">
        <div
          className="progress-bar-fill"
          style={{ width: `${porcentaje}%` }}
          role="progressbar"
          aria-valuenow={porcentaje}
          aria-valuemin="0"
          aria-valuemax="100"
        />
      </div>
      <span className="progress-percent">{porcentaje}% completado</span>
    </div>
  );
};

export default ProgressBar;
