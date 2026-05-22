import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

// Bump this key to re-show the popup for a future release/beta.
const SEEN_KEY = 'jh_welcome_beta_v1';
const CONTACT_EMAIL = 'contact @ kaniken.nl';
const CONTACT_PHONE_DISPLAY = '+31 6 33013211';
const CONTACT_PHONE_TEL = '+31633013211';

const WelcomeModal: React.FC = () => {
  // Always render the popup in Dutch, regardless of the app's language toggle.
  const { i18n } = useTranslation();
  const t = i18n.getFixedT('nl');

  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(SEEN_KEY) !== '1';
    } catch {
      return true;
    }
  });

  const dismiss = () => {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* ignore storage errors */
    }
    setOpen(false);
  };

  if (!open) return null;

  const features = t('welcome.features', { returnObjects: true }) as string[];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={dismiss}
          aria-label="Sluiten"
          className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Header */}
        <div className="flex flex-col items-center px-6 pt-8 pb-4 text-center">
          <img
            src="/favicon.png"
            alt="Jotihunt GOG"
            className="w-20 h-20 rounded-2xl shadow-md mb-4"
          />
          <h2 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 leading-tight">
            {t('welcome.title')}
          </h2>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
            {t('welcome.intro')}
          </p>
        </div>

        {/* Features */}
        <div className="px-6">
          <ul className="space-y-2">
            {features.map((feature, i) => (
              <li
                key={i}
                className="flex items-start text-sm text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2"
              >
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Mobile install */}
        <div className="px-6 mt-4">
          <div className="rounded-lg border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/20 px-4 py-3">
            <p className="text-sm font-semibold text-primary-800 dark:text-primary-200">
              {t('welcome.mobileTitle')}
            </p>
            <p className="mt-1 text-sm text-primary-700 dark:text-primary-300">
              {t('welcome.mobileText')}
            </p>
            <a
              href="/jotihunt-app.apk"
              download="jotihunt-release-v9.apk"
              className="mt-3 inline-flex items-center justify-center w-full rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2 transition-colors"
            >
              {t('welcome.downloadApp')}
            </a>
          </div>
        </div>

        {/* Beta note + contact */}
        <div className="px-6 mt-4 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('welcome.betaNote')}
          </p>
          <p className="mt-3 text-sm font-medium text-gray-900 dark:text-gray-100">
            {t('welcome.contactTitle')}
          </p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary-600 dark:text-primary-400 hover:underline">
              {CONTACT_EMAIL}
            </a>
            <span className="mx-2 text-gray-300 dark:text-gray-600">·</span>
            <a href={`tel:${CONTACT_PHONE_TEL}`} className="text-primary-600 dark:text-primary-400 hover:underline">
              {CONTACT_PHONE_DISPLAY}
            </a>
          </p>
        </div>

        {/* CTA */}
        <div className="px-6 pt-5 pb-4">
          <button
            onClick={dismiss}
            className="w-full btn btn-primary text-base py-3"
          >
            {t('welcome.cta')}
          </button>
        </div>

        <p className="pb-5 text-center text-xs text-gray-400 dark:text-gray-500">
          {t('welcome.poweredBy')}
        </p>
      </div>
    </div>
  );
};

export default WelcomeModal;
