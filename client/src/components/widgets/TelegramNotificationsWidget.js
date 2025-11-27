import React, { useState, useEffect } from 'react';
import api from '../../api';
import { useAuth } from '../../hooks/useAuth';

const TelegramNotificationsWidget = () => {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [deepLink, setDeepLink] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const endpoint = user?.role === 'client' 
        ? '/telegram/client/status'
        : '/telegram/user/status';
      
      const response = await api.get(endpoint);
      setConnected(response.data.connected);
      setUsername(response.data.username || '');
      setError('');
    } catch (error) {
      console.error('Ошибка при загрузке статуса:', error);
      setError('Ошибка при загрузке статуса');
    } finally {
      setLoading(false);
    }
  };

  const generateLink = async () => {
    try {
      setLoading(true);
      const endpoint = user?.role === 'client'
        ? '/telegram/client/generate-link'
        : '/telegram/user/generate-link';
      
      const response = await api.post(endpoint);
      setDeepLink(response.data.deepLink);
      setQrCode(response.data.qrCode);
      setShowQR(true);
      setError('');
    } catch (error) {
      console.error('Ошибка при генерации ссылки:', error);
      setError('Ошибка при генерации ссылки');
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async () => {
    try {
      const endpoint = user?.role === 'client'
        ? '/telegram/client/disconnect'
        : '/telegram/user/disconnect';
      
      await api.post(endpoint);
      setConnected(false);
      setUsername('');
      setError('');
    } catch (error) {
      console.error('Ошибка при отключении:', error);
      setError('Ошибка при отключении');
    }
  };

  if (loading && !connected && !showQR) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <svg className="w-6 h-6 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
        </svg>
        <h3 className="text-lg font-semibold text-gray-900">Telegram уведомления</h3>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {!connected ? (
        <div>
          <p className="text-gray-600 mb-4">
            Получайте уведомления о новых тикетах, сообщениях и счетах прямо в Telegram.
          </p>

          {!showQR ? (
            <button
              onClick={generateLink}
              disabled={loading}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded transition"
            >
              {loading ? 'Загрузка...' : 'Включить Telegram уведомления'}
            </button>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-50 p-6 rounded border border-gray-200">
                <p className="text-sm text-gray-600 mb-3">Отсканируйте QR код или перейдите по ссылке:</p>
                
                {qrCode && (
                  <div className="text-center mb-4">
                    <img 
                      src={qrCode} 
                      alt="QR Code" 
                      className="mx-auto w-48 h-48 border border-gray-300 rounded"
                    />
                  </div>
                )}

                <a
                  href={deepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full bg-blue-500 hover:bg-blue-600 text-white text-center font-semibold py-2 px-4 rounded transition mb-2"
                >
                  Открыть в Telegram
                </a>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(deepLink);
                    alert('Ссылка скопирована в буфер обмена');
                  }}
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded transition"
                >
                  Копировать ссылку
                </button>
              </div>

              <p className="text-xs text-gray-500 text-center">
                После перехода в Telegram нажмите кнопку "Включить уведомления" (команда /start)
              </p>

              <button
                onClick={() => setShowQR(false)}
                className="w-full text-gray-600 hover:text-gray-800 py-2"
              >
                Вернуться
              </button>
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="font-semibold text-green-800">Уведомления подключены</p>
            </div>
            {username && (
              <p className="text-sm text-gray-600">
                Telegram: @{username}
              </p>
            )}
          </div>

          <button
            onClick={disconnect}
            className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded transition"
          >
            Отключить уведомления
          </button>
        </div>
      )}
    </div>
  );
};

export default TelegramNotificationsWidget;
