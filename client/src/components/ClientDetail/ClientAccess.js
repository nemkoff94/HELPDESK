import React from 'react';
import formatDate from '../../utils/formatDate';

const ClientAccess = ({ clientLogin, user, onCreateLogin, onChangePassword, onGeneratePassword, telegramConnected, onOpenTelegram }) => {
  if (user?.role !== 'admin') {
    return null;
  }

  return (
    <div className="border-t pt-4 mt-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-3">Доступ клиента</h3>
      {clientLogin ? (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div>
              <p className="text-sm text-gray-600">Email:</p>
              <p className="font-medium text-gray-800 break-all">{clientLogin.email}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <button
                onClick={onChangePassword}
                className="bg-primary-600 text-white px-3 py-2 rounded text-sm hover:bg-primary-700 w-full sm:w-auto"
              >
                Изменить пароль
              </button>
              <button
                onClick={onGeneratePassword}
                className="bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700 w-full sm:w-auto"
              >
                Сгенерировать пароль
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between mt-3 gap-3">
            <p className="text-xs text-gray-500">Создан: {formatDate(clientLogin.created_at)}</p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${telegramConnected ? 'bg-green-500' : 'bg-gray-400'}`} aria-hidden></span>
                <span className="text-sm text-gray-700">{telegramConnected ? 'Telegram подключён' : 'Telegram не подключён'}</span>
              </div>
              {telegramConnected && (
                <button onClick={onOpenTelegram} className="text-sm text-primary-600 hover:underline">Отправить сообщение</button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-gray-700 mb-3">
            Логин для клиента не создан
          </p>
          <button
            onClick={onCreateLogin}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 text-sm w-full sm:w-auto"
          >
            Создать логин
          </button>
        </div>
      )}
    </div>
  );
};

export default ClientAccess;
