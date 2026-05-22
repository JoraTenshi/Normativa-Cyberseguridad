import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNormativas } from '../services/api';

const Home = () => {
  const navigate = useNavigate();

  const [normativas, setNormativas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const cargarNormativas = async () => {
      try {
        const data = await getNormativas();
        setNormativas(data);
      } catch (err) {
        setError('No se pudo conectar con el servidor. ¿Está el backend en ejecución?');
      } finally {
        setCargando(false);
      }
    };
    cargarNormativas();
  }, []);

  const seleccionarNormativa = (id) => {
    navigate(`/cuestionario/${id}`);
  };

  return (
    <div className="page home-page">
      <header className="hero">
        <h1 className="hero-title">
          Autoevaluación de Ciberseguridad
        </h1>
        <p className="hero-subtitle">
          Evalúa el nivel de cumplimiento de tu organización respecto a las principales normativas
          de seguridad de la información. Obtén un informe de madurez en minutos.
        </p>
      </header>

      <section className="como-funciona">
        <h2 className="section-title">¿Cómo funciona?</h2>
        <div className="pasos-grid">
          {[
            { num: '01', titulo: 'Selecciona', desc: 'Elige la normativa que quieres evaluar y contesta el cuestionario.' },
            { num: '02', titulo: 'Responde', desc: 'Contesta "Sí", "Parcial" o "No" a cada pregunta.' },
            { num: '03', titulo: 'Obtén tu nota', desc: 'Comprueba tu porcentaje de cumplimiento y descarga tu Plan Director de Seguridad.' }
          ].map(paso => (
            <div key={paso.num} className="paso">
              <div className="paso-num">{paso.num}</div>
              <h4 className="paso-titulo">{paso.titulo}</h4>
              <p className="paso-desc">{paso.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="normativas-section">
        <h2 className="section-title">Selecciona una normativa para comenzar</h2>

        {cargando && (
          <div className="loading-state">
            <div className="spinner" />
            <p>Cargando normativas disponibles...</p>
          </div>
        )}

        {error && (
          <div className="error-state">
            <span className="error-icon">⚠️</span>
            <p>{error}</p>
          </div>
        )}

        {!cargando && !error && (
          <div className="normativas-grid">
            {normativas.map((normativa) => (
              <button
                key={normativa.id}
                className="normativa-card"
                onClick={() => seleccionarNormativa(normativa.id)}
              >
                <div className="normativa-card-content">
                  <h3 className="normativa-card-nombre">{normativa.nombre}</h3>
                  <p className="normativa-card-desc">{normativa.descripcion}</p>
                </div>
                <div className="normativa-card-arrow">→</div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Home;
