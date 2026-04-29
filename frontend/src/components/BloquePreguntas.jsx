/**
 * components/BloquePreguntas.jsx
 * Renderiza un bloque temático de preguntas con sus botones de respuesta
 * Cada pregunta muestra: texto, peso, y botones Sí / Parcial / No
 */

import React from 'react';

// Opciones de respuesta con su valor numérico y etiqueta
const OPCIONES = [
  { valor: 1,   etiqueta: 'Sí',      clase: 'btn-si' },
  { valor: 0.5, etiqueta: 'Parcial', clase: 'btn-parcial' },
  { valor: 0,   etiqueta: 'No',      clase: 'btn-no' }
];

const BloquePreguntas = ({ bloque, respuestas, onRespuesta }) => {
  return (
    <div className="bloque">
      {/* Cabecera del bloque */}
      <div className="bloque-header">
        <span className="bloque-icono">🔐</span>
        <h3 className="bloque-nombre">{bloque.nombre}</h3>
        <span className="bloque-count">{bloque.preguntas.length} preguntas</span>
      </div>

      {/* Lista de preguntas */}
      <div className="preguntas-lista">
        {bloque.preguntas.map((pregunta, idx) => {
          const respuestaActual = respuestas[pregunta.id];
          const respondida = respuestaActual !== undefined;

          return (
            <div
              key={pregunta.id}
              className={`pregunta ${respondida ? 'respondida' : ''}`}
            >
              <div className="pregunta-header">
                <span className="pregunta-numero">{idx + 1}</span>
                <p className="pregunta-texto">{pregunta.texto}</p>
                <span className="pregunta-peso" title={`Peso: ${pregunta.peso}`}>
                  {'★'.repeat(pregunta.peso)}
                </span>
              </div>

              {/* Botones de respuesta */}
              <div className="respuesta-botones">
                {OPCIONES.map(opcion => (
                  <button
                    key={opcion.valor}
                    className={`btn-respuesta ${opcion.clase} ${
                      respuestaActual === opcion.valor ? 'activo' : ''
                    }`}
                    onClick={() => onRespuesta(pregunta.id, opcion.valor)}
                    aria-pressed={respuestaActual === opcion.valor}
                  >
                    {opcion.etiqueta}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BloquePreguntas;
