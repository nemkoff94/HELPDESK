import React, { useEffect, useState } from 'react';

const CONSENT_KEY = 'cookie_consent_v1';

const CookieBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONSENT_KEY);
      if (!stored) {
        // show banner after small delay so it doesn't flash immediately
        const t = setTimeout(() => setVisible(true), 400);
        return () => clearTimeout(t);
      }
    } catch (e) {
      // if localStorage is unavailable, still show banner
      const t = setTimeout(() => setVisible(true), 400);
      return () => clearTimeout(t);
    }
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(CONSENT_KEY, 'accepted');
    } catch (e) {
      // ignore
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-4 bottom-6 z-50">
      <div className="max-w-3xl mx-auto bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg shadow-md px-4 py-3 flex items-center justify-between gap-4">
        <div className="text-sm text-gray-700">
          Мы используем файлы cookie для улучшения работы сайта и анализа трафика. Продолжая пользоваться сайтом, вы принимаете их использование.
        </div>

        <div className="flex items-center">
          <button
            onClick={accept}
            className="inline-flex items-center px-3 py-1.5 bg-primary-600 text-white text-sm font-medium rounded hover:bg-primary-700"
          >
            Принять
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieBanner;
