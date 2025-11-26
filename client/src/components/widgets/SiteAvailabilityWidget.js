import React, { useState, useEffect } from 'react';

const SiteAvailabilityWidget = ({ clientId, api }) => {
  const [widget, setWidget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    fetchWidget();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const fetchWidget = async () => {
    try {
      const response = await api.get(`/widgets/site-availability/${clientId}`);
      setWidget(response.data);
    } catch (error) {
      console.error('Ошибка при загрузке виджета:', error);
    } finally {
      setLoading(false);
    }
  };

  const canRunCheck = () => {
    if (!widget || !widget.last_check_time) return true;
    const last = new Date(widget.last_check_time);
    const diffMs = Date.now() - last.getTime();
    return diffMs >= 24 * 60 * 60 * 1000; // 24 hours
  };

  const handleRunCheck = async () => {
    if (!canRunCheck()) return;
    try {
      setIsChecking(true);
      await api.post(`/widgets/site-availability/${clientId}/check`);
      // refresh widget data after triggering check
      await fetchWidget();
    } catch (error) {
      console.error('Ошибка при запуске проверки:', error);
      alert(error.response?.data?.error || 'Ошибка при запуске проверки');
    } finally {
      setIsChecking(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    );
  }

  if (!widget || !widget.enabled) {
    return null;
  }

  const isSuccess = widget.last_check_status === 'success';

  return (
    <div className={`rounded-lg border-2 p-4 ${isSuccess ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
      <h3 className="font-semibold text-gray-800 mb-3">Доступность сайта</h3>

      <div className="mb-3">
        <p className="text-sm text-gray-600 mb-1">Сайт:</p>
        <a href={widget.site_url} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline break-all text-sm">
          {widget.site_url}
        </a>
      </div>

      {widget.last_check_time && (
        <div className="bg-white rounded p-3 mb-3">
          <div className="flex items-start gap-3">
            <div className={`mt-1 w-3 h-3 rounded-full flex-shrink-0 ${isSuccess ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <div className="flex-1">
              <p className={`text-sm font-medium ${isSuccess ? 'text-green-800' : 'text-red-800'}`}>
                {widget.last_check_message}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-3">
        {canRunCheck() ? (
          <button
            onClick={handleRunCheck}
            disabled={isChecking}
            className="bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700 disabled:opacity-60"
          >
            {isChecking ? 'Запуск...' : 'Запустить проверку'}
          </button>
        ) : (
          <div className="text-sm text-gray-600">
            Проверку можно запустить не чаще 1 раза в сутки. Последняя проверка: {new Date(widget.last_check_time).toLocaleString('ru-RU')}
          </div>
        )}
      </div>

      {!widget.last_check_time && (
        <div className="text-center py-4 text-gray-600 text-sm">
          Проверка будет проведена в 04:00 (по времени сервера)
        </div>
      )}
    </div>
  );
};

export default SiteAvailabilityWidget;

