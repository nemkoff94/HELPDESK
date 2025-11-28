import React, { useState, useEffect } from 'react';
import formatDate from '../../utils/formatDate';
const RenewalCalendarWidget = ({ clientId, api }) => {
  const [widget, setWidget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newCustomName, setNewCustomName] = useState('');
  const [newCustomDate, setNewCustomDate] = useState('');
  const [isAddingCustom, setIsAddingCustom] = useState(false);

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

  const addCustomUpdate = async () => {
    if (!newCustomName || !newCustomDate) return;
    try {
      setIsAddingCustom(true);
      await api.post(`/widgets/renewal-calendar/${clientId}/custom-update`, {
        title: newCustomName,
        date: newCustomDate,
      });
      setNewCustomName('');
      setNewCustomDate('');
      await fetchWidget();
    } catch (error) {
      console.error('Ошибка при добавлении кастомного обновления:', error);
      alert(error.response?.data?.error || 'Ошибка при добавлении кастомного обновления');
    } finally {
      setIsAddingCustom(false);
    }
  };

  const formatDateDisplay = (dateString) => {
    if (!dateString) return 'Не установлена';
    // Display only the date, but append a short relative suffix in parentheses
    const daysUntil = getDaysUntil(dateString);
    const dateOnly = formatDate(dateString, { year: 'numeric', month: '2-digit', day: '2-digit' });
    let suffix = '';
    if (daysUntil === null) {
      suffix = '';
    } else if (daysUntil < 0) {
      suffix = ` (просрочено на ${Math.abs(daysUntil)} дн.)`;
    } else if (daysUntil === 0) {
      suffix = ` (сегодня!)`;
    } else {
      suffix = ` (через ${daysUntil} дн.)`;
    }
    return `${dateOnly}${suffix}`;
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

      {/* Custom updates list (created by admin per client) */}
      {widget.custom_updates && widget.custom_updates.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Кастомные обновления</h4>
          <div className="space-y-2">
            {widget.custom_updates.map((cu) => (
              <div key={cu.id} className="bg-white rounded p-3 flex justify-between items-center">
                <div>
                  <div className="font-medium text-sm">{cu.title}</div>
                  <div className="text-xs text-gray-500">{formatDateDisplay(cu.date)}</div>
                </div>
                <div className={`text-sm px-3 py-1 rounded ${getDateColor(cu.date)}`}>
                  {getDaysUntil(cu.date) !== null ? (getDaysUntil(cu.date) < 0 ? 'Просрочено' : `${getDaysUntil(cu.date)} дн.`) : '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin: create custom update for this client */}
      {widget.can_create_custom_update && (
        <div className="mt-4 bg-white rounded p-3">
          <h4 className="text-sm font-medium mb-2">Добавить кастомное обновление</h4>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              placeholder="Название"
              value={newCustomName}
              onChange={(e) => setNewCustomName(e.target.value)}
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={newCustomDate}
              onChange={(e) => setNewCustomDate(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm"
            />
            <button
              onClick={addCustomUpdate}
              disabled={!newCustomName || !newCustomDate || isAddingCustom}
              className="bg-primary-600 text-white px-4 py-2 rounded disabled:opacity-60"
            >
              {isAddingCustom ? 'Добавление...' : 'Добавить'}
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
        <strong>Подсказка:</strong> Жёлтый - менее 60 дней, Красный - просрочено
      </div>
    </div>
  );
};

export default RenewalCalendarWidget;
