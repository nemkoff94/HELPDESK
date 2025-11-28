import React, { useState, useEffect } from 'react';

const AdCampaignWidget = ({ clientId, api }) => {
  const [widget, setWidget] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchWidget = async () => {
      try {
        const response = await api.get(`/widgets/ad-campaign/${clientId}`);
        if (mounted) setWidget(response.data);
      } catch (error) {
        console.error('Ошибка при загрузке виджета:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    if (clientId) fetchWidget();

    return () => {
      mounted = false;
    };
  }, [clientId, api]);

  if (loading) {
    return (
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    );
  }

  if (!widget || !widget.enabled) {
    return null;
  }

  const getStatusInfo = () => {
    switch (widget.status) {
      case 'active':
        return {
          color: 'bg-green-100 border-green-200',
          lightColor: 'bg-green-50',
          statusText: 'Активна',
          pulse: true,
          lightColor2: '#10b981',
        };
      case 'paused':
        return {
          color: 'bg-yellow-100 border-yellow-200',
          lightColor: 'bg-yellow-50',
          statusText: 'На паузе',
          pulse: true,
          lightColor2: '#f59e0b',
        };
      case 'stopped':
        return {
          color: 'bg-gray-100 border-gray-200',
          lightColor: 'bg-gray-50',
          statusText: 'Остановлена',
          pulse: false,
          lightColor2: '#6b7280',
        };
      default:
        return {
          color: 'bg-gray-100 border-gray-200',
          lightColor: 'bg-gray-50',
          statusText: widget.status,
          pulse: false,
          lightColor2: '#6b7280',
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className={`rounded-lg border-2 p-4 ${statusInfo.color} ${statusInfo.lightColor}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-800 mb-3">Статус рекламных кампаний</h3>
          
          <div className="flex items-center gap-3 mb-3">
            {statusInfo.pulse && (
              <div className="relative w-4 h-4">
                <div
                  className="absolute inset-0 rounded-full animate-pulse"
                  style={{ backgroundColor: statusInfo.lightColor2 }}
                ></div>
              </div>
            )}
            {!statusInfo.pulse && (
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: statusInfo.lightColor2 }}
              ></div>
            )}
            <span className="font-medium text-gray-800">{statusInfo.statusText}</span>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Текущий бюджет:</span>
              <span className="font-medium">{widget.monthly_budget.toLocaleString('ru-RU')} ₽/месяц</span>
            </div>
            {widget.recommended_budget && (
              <div className="flex justify-between">
                <span className="text-gray-600">Рекомендованный бюджет:</span>
                <span className="font-medium">{widget.recommended_budget.toLocaleString('ru-RU')} ₽/месяц</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdCampaignWidget;
