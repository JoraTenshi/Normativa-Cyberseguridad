import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import BloquePreguntas from '../components/BloquePreguntas.jsx';
import { obtenerPreguntas, evaluar } from '../api.js';

export default function Cuestionario() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [cuestionario, setCuestionario] = useState(null);
  const [respuestas, setRespuestas] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    obtenerPreguntas(id)
      .then(setCuestionario)
      .catch(() => setError(t('cuestionario.error_load')));
  }, [id, t]);

  const totalPreguntas =
    cuestionario?.bloques.reduce((acc, b) => acc + b.preguntas.length, 0) ?? 0;
  const todasRespondidas =
    totalPreguntas > 0 && Object.keys(respuestas).length === totalPreguntas;

  function handleRespuesta(preguntaId, valor) {
    setRespuestas((prev) => ({ ...prev, [preguntaId]: valor }));
  }

  async function handleEnviar() {
    setEnviando(true);
    try {
      const respuestasArray = Object.entries(respuestas).map(([pregunta_id, valor]) => ({
        pregunta_id,
        valor,
      }));
      const resultado = await evaluar(id, respuestasArray);
      navigate(`/resultado/${id}`, { state: { resultado } });
    } catch {
      setError(t('cuestionario.error_send'));
      setEnviando(false);
    }
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={() => navigate('/')} className="text-blue-400 hover:text-blue-300">
          {t('cuestionario.back_home')}
        </button>
      </div>
    );
  }

  if (!cuestionario) {
    return <div className="p-8 text-center text-slate-400">{t('cuestionario.loading')}</div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate('/')}
          className="text-slate-400 hover:text-white text-sm transition-colors"
        >
          {t('cuestionario.back')}
        </button>
        <h1 className="text-2xl font-bold text-white">{cuestionario.nombre}</h1>
      </div>

      {cuestionario.bloques.map((bloque) => (
        <BloquePreguntas
          key={bloque.id}
          bloque={bloque}
          respuestas={respuestas}
          onRespuesta={handleRespuesta}
        />
      ))}

      <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700 py-4 mt-8">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-sm">
            {t('cuestionario.progress', {
              answered: Object.keys(respuestas).length,
              total: totalPreguntas,
            })}
          </span>
          <button
            onClick={handleEnviar}
            disabled={!todasRespondidas || enviando}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold px-8 py-3 rounded-lg transition-colors"
          >
            {enviando ? t('cuestionario.submitting') : t('cuestionario.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
