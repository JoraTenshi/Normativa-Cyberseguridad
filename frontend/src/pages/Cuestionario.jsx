/**
 * pages/Cuestionario.jsx
 * Página del cuestionario dinámico
 * Carga las preguntas de la normativa seleccionada y gestiona el estado de las respuestas
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getNormativa, enviarResultado } from '../services/api';
import BloquePreguntas from '../components/BloquePreguntas';
import ProgressBar from '../components/ProgressBar';

const Cuestionario = () => {
  const { normativaId } = useParams(); // ID de la normativa desde la URL
  const navigate = useNavigate();

  // ─── Estado ─────────────────────────────────────────────────────────────────
  const [normativa, setNormativa] = useState(null);      // Datos completos de la normativa
  const [respuestas, setRespuestas] = useState({});      // { pregunta_id: valor }
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  // ─── Carga de la normativa ──────────────────────────────────────────────────
  useEffect(() => {
    const cargar = async () => {
      try {
        const data = await getNormativa(normativaId);
        setNormativa(data);
      } catch (err) {
        setError('No se pudo cargar la normativa. Verifica que el backend esté activo.');
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, [normativaId]);

  // ─── Cálculo del progreso ───────────────────────────────────────────────────
  // Total de preguntas en toda la normativa
  const totalPreguntas = useMemo(() => {
    if (!normativa) return 0;
    return normativa.bloques.reduce((acc, bloque) => acc + bloque.preguntas.length, 0);
  }, [normativa]);

  // Total de preguntas contestadas
  const preguntasContestadas = Object.keys(respuestas).length;

  // ─── Manejador de respuesta ─────────────────────────────────────────────────
  const handleRespuesta = (preguntaId, valor) => {
    setRespuestas(prev => ({
      ...prev,
      [preguntaId]: valor
    }));
  };

  // ─── Envío del cuestionario ─────────────────────────────────────────────────
  const handleEnviar = async () => {
    // Verificar que todas las preguntas han sido contestadas
    if (preguntasContestadas < totalPreguntas) {
      const faltantes = totalPreguntas - preguntasContestadas;
      alert(`Aún faltan ${faltantes} pregunta(s) por contestar.`);
      return;
    }

    try {
      setEnviando(true);
      setError(null);

      // Convertimos el objeto de respuestas a array para el backend
      const respuestasArray = Object.entries(respuestas).map(([pregunta_id, valor]) => ({
        pregunta_id,
        valor
      }));

      const resultado = await enviarResultado(normativaId, respuestasArray);

      // Navegamos a la página de resultados pasando los datos por estado
      navigate('/resultado', {
        state: {
          resultado,
          normativaNombre: normativa.nombre,
          normativaId
        }
      });

    } catch (err) {
      setError('Error al enviar las respuestas. Por favor, inténtalo de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  // ─── Renderizado ────────────────────────────────────────────────────────────
  if (cargando) {
    return (
      <div className="page loading-page">
        <div className="spinner large" />
        <p>Cargando cuestionario...</p>
      </div>
    );
  }

  if (error && !normativa) {
    return (
      <div className="page error-page">
        <span className="error-icon large">⚠️</span>
        <p className="error-message">{error}</p>
        <button className="btn-primary" onClick={() => navigate('/')}>Volver al inicio</button>
      </div>
    );
  }

  return (
    <div className="page cuestionario-page">
      {/* Cabecera del cuestionario */}
      <div className="cuestionario-header">
        <button className="btn-back" onClick={() => navigate('/')}>← Volver</button>
        <div className="cuestionario-info">
          <h1 className="cuestionario-titulo">{normativa.nombre}</h1>
          <p className="cuestionario-desc">{normativa.descripcion}</p>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="progress-wrapper">
        <ProgressBar
          contestadas={preguntasContestadas}
          total={totalPreguntas}
        />
      </div>

      {/* Bloques de preguntas */}
      <div className="bloques-container">
        {normativa.bloques.map((bloque) => (
          <BloquePreguntas
            key={bloque.id}
            bloque={bloque}
            respuestas={respuestas}
            onRespuesta={handleRespuesta}
          />
        ))}
      </div>

      {/* Error de envío */}
      {error && (
        <div className="error-banner">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* Botón de envío */}
      <div className="cuestionario-footer">
        <div className="footer-info">
          <span className="footer-count">
            {preguntasContestadas}/{totalPreguntas} preguntas respondidas
          </span>
          {preguntasContestadas < totalPreguntas && (
            <span className="footer-aviso">
              Debes responder todas las preguntas para continuar
            </span>
          )}
        </div>
        <button
          className={`btn-primary btn-enviar ${preguntasContestadas < totalPreguntas ? 'disabled' : ''}`}
          onClick={handleEnviar}
          disabled={enviando || preguntasContestadas < totalPreguntas}
        >
          {enviando ? (
            <><span className="spinner small" /> Calculando...</>
          ) : (
            '📊 Ver mi resultado'
          )}
        </button>
      </div>
    </div>
  );
};

export default Cuestionario;
