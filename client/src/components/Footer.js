import React from 'react';

const Footer = () => {
  return (
    <footer role="contentinfo" className="bg-gray-900 text-gray-200 w-full">
      <div className="max-w-7xl mx-auto px-6 py-8 lg:py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          <div>
            <div className="text-2xl font-semibold text-white">Обсидиан</div>
            <p className="mt-3 text-sm text-gray-300 max-w-xs">Студия веб-разработки — современное решение для бизнеса и поддержки пользователей.</p>
            <p className="mt-4 text-xs text-gray-400">Сайт: <a className="text-indigo-300 hover:text-indigo-200 underline" href="https://obsidianweb.ru" target="_blank" rel="noopener noreferrer">obsidianweb.ru</a></p>
          </div>

          <div>
            <div className="font-semibold text-white">Юридическая информация</div>
            <div className="mt-3 text-sm text-gray-300">
              <div>ИП Немкова София Сергеевна</div>
              <div className="mt-1">ОГРНИП 324400000011133</div>
              <div>ИНН 401110194908</div>
            </div>
          </div>

          <div>
            <div className="font-semibold text-white">Контакты</div>
            <div className="mt-3 text-sm text-gray-300 space-y-1">
              <div><a className="hover:text-white underline" href="tel:+79533392119" aria-label="Позвонить">+7 953 339 2119</a></div>
              <div>г. Обнинск, пр. Маркса 62</div>
              <div><a className="hover:text-white underline" href="mailto:zabota@obsidianweb.ru" aria-label="Написать письмо">zabota@obsidianweb.ru</a></div>

              <div className="mt-6 flex gap-3">
                <a
                  href="https://wa.me/79533392119"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Открыть WhatsApp"
                  className="inline-flex items-center gap-2 px-3 py-2 bg-white text-gray-900 rounded-md text-sm font-medium transition transform hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="12" fill="#25D366" />
                    <path d="M17.472 14.382c-.297-.149-1.758-.866-2.03-.967-.273-.101-.472-.151-.672.151-.198.301-.766.966-.94 1.163-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.657-2.06-.175-.298-.02-.46.127-.61.13-.13.297-.336.446-.518.148-.182.198-.314.298-.514.1-.198.05-.371-.025-.52-.075-.148-.672-1.625-.922-2.222-.242-.579-.487-.5-.674-.51-.173-.01-.37-.01-.569-.01-.198 0-.51.074-.778.37-.268.297-1.018 1.05-1.018 2.562 0 1.512 1.037 2.965 1.183 3.176.146.211 2.016 3.104 4.882 4.346 1.365.58 2.28.711 3.073.724.494.008 1.164-.063 1.673-.574.509-.51.797-1.18.885-1.375.089-.198.089-.369.062-.511-.026-.142-.095-.226-.193-.298-.098-.073-.328-.208-.626-.357z" fill="#fff"/>
                  </svg>
                  WhatsApp
                </a>

                <a
                  href="https://t.me/obsidian_web"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Открыть Telegram"
                  className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium transition transform hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M22 2l-7 20-4-8-8-4 19-8z" />
                  </svg>
                  Telegram
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-gray-800 pt-6 text-center text-sm text-gray-400">
          <div>Система поддержки разработана в студии Обсидиан.</div>
          <div className="mt-2">© {new Date().getFullYear()} Обсидиан</div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
