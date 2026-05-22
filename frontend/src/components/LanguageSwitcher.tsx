import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher: React.FC<{ className?: string }> = ({ className }) => {
  const { i18n } = useTranslation();
  const current = i18n.resolvedLanguage || i18n.language;

  const setLang = (lng: 'nl' | 'en') => {
    if (lng !== current) {
      i18n.changeLanguage(lng);
    }
  };

  const base =
    'px-2 py-0.5 text-xs font-semibold rounded transition-colors duration-150';
  const active = 'bg-primary-600 text-white';
  const inactive =
    'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200';

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-md border border-gray-200 dark:border-gray-700 p-0.5 ${className || ''}`}
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        onClick={() => setLang('nl')}
        className={`${base} ${current === 'nl' ? active : inactive}`}
        aria-pressed={current === 'nl'}
      >
        NL
      </button>
      <button
        type="button"
        onClick={() => setLang('en')}
        className={`${base} ${current === 'en' ? active : inactive}`}
        aria-pressed={current === 'en'}
      >
        EN
      </button>
    </div>
  );
};

export default LanguageSwitcher;
