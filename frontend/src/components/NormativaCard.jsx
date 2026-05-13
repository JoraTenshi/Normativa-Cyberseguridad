import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function NormativaCard({ normativa }) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <button
      onClick={() => navigate(`/cuestionario/${normativa.id}`)}
      className="bg-slate-800 rounded-xl p-6 text-left w-full hover:bg-slate-700 transition-colors border border-slate-700 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <div className="flex justify-between items-start mb-3">
        <h2 className="text-lg font-semibold text-white leading-tight">{normativa.nombre}</h2>
        <span className="ml-2 shrink-0 text-xs font-medium bg-blue-600 text-white px-2 py-1 rounded-full">
          {normativa.version}
        </span>
      </div>
      <p className="text-slate-400 text-sm mb-4 leading-relaxed">{normativa.descripcion}</p>
      <p className="text-blue-400 text-sm font-medium">
        {t('card.questions', { count: normativa.total_preguntas })}
      </p>
    </button>
  );
}
