import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import NormativaCard from '../components/NormativaCard.jsx';
import { listarNormativas } from '../api.js';

export default function Home() {
  const { t } = useTranslation();
  const [normativas, setNormativas] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    listarNormativas()
      .then(setNormativas)
      .catch(() => setError(t('home.error_load')));
  }, [t]);

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-white mb-2">NormativaCheck</h1>
        <p className="text-slate-400 text-lg">{t('home.subtitle')}</p>
      </header>

      {error && (
        <p className="text-red-400 text-center mb-8">{error}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {normativas.map((n) => (
          <NormativaCard key={n.id} normativa={n} />
        ))}
      </div>
    </div>
  );
}
