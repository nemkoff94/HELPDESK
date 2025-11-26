import React, { useState, useEffect } from 'react';

const RenewalCalendarWidget = ({ clientId, api }) => {
  const [widget, setWidget] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWidget();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const fetchWidget = async () => {
    try {
      const response = await api.get(`/widgets/renewal-calendar/${clientId}`);
      setWidget(response.data);
    } catch (error) {
      console.error('Ошибка при загрузке виджета:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysUntil = (dateString) => {
    if (!dateString) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(dateString);
    targetDate.setHours(0, 0, 0, 0);
    const diff = targetDate - today;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const getDateColor = (dateString) => {
    if (!dateString) return 'text-gray-600 bg-gray-50';
    const daysUntil = getDaysUntil(dateString);
    if (daysUntil < 0) return 'text-red-700 bg-red-50 font-semibold';
    if (daysUntil < 60) return 'text-yellow-700 bg-yellow-50 font-semibold';
    return 'text-gray-600 bg-gray-50';
  };

  const formatDateDisplay = (dateString) => {
    if (!dateString) return 'Не установлена';
    const date = new Date(dateString);
    const daysUntil = getDaysUntil(dateString);
    
    if (daysUntil < 0) {
      return `${date.toLocaleDateString('ru-RU')} (просрочено на ${Math.abs(daysUntil)} дн.)`;
    } else if (daysUntil === 0) {
      return `${date.toLocaleDateString('ru-RU')} (сегодня!)`;
    } else {
      return `${date.toLocaleDateString('ru-RU')} (через ${daysUntil} дн.)`;
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

  return (
    <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
      <h3 className="font-semibold text-gray-800 mb-4">Календарь обязательных обновлений</h3>
      
      <div className="space-y-3">
        {/* Обновление домена */}
        <div className="bg-white rounded p-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Продление домена:</span>
            <span className={`text-sm px-3 py-1 rounded ${getDateColor(widget.domain_renewal_date)}`}>
              {formatDateDisplay(widget.domain_renewal_date)}
            </span>
          </div>
        </div>

        {/* Обновление хостинга */}
        <div className="bg-white rounded p-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Продление хостинга:</span>
            <span className={`text-sm px-3 py-1 rounded ${getDateColor(widget.hosting_renewal_date)}`}>
              {formatDateDisplay(widget.hosting_renewal_date)}
            </span>
          </div>
        </div>

        {/* Обновление SSL */}
        <div className="bg-white rounded p-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Продление SSL:</span>
            {widget.ssl_auto_renewal ? (
              <span className="text-sm px-3 py-1 rounded bg-green-50 text-green-700 font-semibold">
                Обновляется автоматически ✓
              </span>
            ) : (
              <span className={`text-sm px-3 py-1 rounded ${getDateColor(widget.ssl_renewal_date)}`}>
                {formatDateDisplay(widget.ssl_renewal_date)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
        <strong>Легенда:</strong> Жёлтый - менее 60 дней, Красный - просрочено
      </div>
    </div>
  );
};

export default RenewalCalendarWidget;
