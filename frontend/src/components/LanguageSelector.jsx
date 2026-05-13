import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { value: 'es', label: 'ES' },
  { value: 'en', label: 'EN' },
  { value: 'de', label: 'DE' },
  { value: 'fr', label: 'FR' },
];

export default function LanguageSelector() {
  const { i18n } = useTranslation();
  const currentLang = i18n.language?.split('-')[0] || 'es';

  return (
    <select
      value={currentLang}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      className="bg-slate-700 text-white text-sm rounded px-2 py-1 border border-slate-600 cursor-pointer"
    >
      {LANGUAGES.map((lang) => (
        <option key={lang.value} value={lang.value}>
          {lang.label}
        </option>
      ))}
    </select>
  );
}
