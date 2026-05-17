import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import RemediacionItem from '../components/RemediacionItem.jsx';

function coloresPorNivel(nivel) {
  if (nivel === 'ALTO')
    return { texto: 'text-green-400', borde: 'border-green-400', badge: 'bg-green-900 text-green-300' };
  if (nivel === 'MEDIO')
    return { texto: 'text-yellow-400', borde: 'border-yellow-400', badge: 'bg-yellow-900 text-yellow-300' };
  return { texto: 'text-red-400', borde: 'border-red-400', badge: 'bg-red-900 text-red-300' };
}

export default function Resultado() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  if (!state?.resultado) {
    navigate('/', { replace: true });
    return null;
  }

  const { resultado } = state;
  const colores = coloresPorNivel(resultado.nivel_cumplimiento);

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-white mb-8">{t('resultado.title')}</h1>

      <div className="bg-slate-800 rounded-xl p-8 border border-slate-700 mb-8 flex flex-col sm:flex-row items-center gap-8">
        <div
          className={`w-36 h-36 rounded-full border-8 ${colores.borde} flex items-center justify-center shrink-0`}
        >
          <span className={`text-4xl font-bold ${colores.texto}`}>
            {Math.round(resultado.puntuacion)}%
          </span>
        </div>
        <div>
          <div
            className={`inline-block text-sm font-bold px-3 py-1 rounded-full mb-3 ${colores.badge}`}
          >
            {t('resultado.level', { nivel: t('nivel.' + resultado.nivel_cumplimiento) })}
          </div>
          <p className="text-slate-400 text-sm">
            {t('resultado.questions_evaluated', { count: resultado.preguntas_evaluadas })}
          </p>
          {resultado.remediaciones.length === 0 && (
            <p className="text-green-400 text-sm mt-2 font-medium">
              {t('resultado.full_compliance')}
            </p>
          )}
        </div>
      </div>

      {resultado.remediaciones.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-white mb-4">
            {t('resultado.remediations', { count: resultado.remediaciones.length })}
          </h2>
          <div className="space-y-4">
            {resultado.remediaciones.map((item) => (
              <RemediacionItem key={item.pregunta_id} item={item} />
            ))}
          </div>
        </section>
      )}

      <button
        onClick={() => navigate('/')}
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
      >
        {t('resultado.back_home')}
      </button>
    </div>
  );
}
