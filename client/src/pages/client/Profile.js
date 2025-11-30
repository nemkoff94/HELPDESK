import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../api';
import formatDate from '../../utils/formatDate';
import TelegramNotificationsWidget from '../../components/widgets/TelegramNotificationsWidget';

const Profile = () => {
  const { user } = useAuth();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [emailSettings, setEmailSettings] = useState({ email: '', verified: false, enabled: false, preferences: {} });
  const [emailInput, setEmailInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [showUnbindConfirm, setShowUnbindConfirm] = useState(false);

  useEffect(() => {
    const fetchClient = async () => {
      if (!user) return;
      try {
        const res = await api.get(`/clients/${user.id}`);
        setClient(res.data);
        // fetch email settings
        try {
          const r2 = await api.get('/notifications/email');
          setEmailSettings({
            email: r2.data.email || '',
            verified: !!r2.data.verified,
            enabled: !!r2.data.enabled,
            preferences: r2.data.preferences || {}
          });
          setEmailInput(r2.data.email || '');
        } catch (e) {
          // ignore
        }
      } catch (e) {
        setError('Не удалось загрузить данные профиля');
      } finally {
        setLoading(false);
      }
    };
    fetchClient();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-600">{error}</div>;
  }

  if (!client) {
    return <div className="text-gray-600">Профиль не найден</div>;
  }

  const getStatusText = (status) => {
    switch (status) {
      case 'in_development':
        return 'В разработке';
      case 'working':
        return 'В работе';
      case 'needs_attention':
        return 'Требует внимания';
      default:
        if (!status) return '—';
        return status.replace(/_/g, ' ');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Профиль</h1>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-gray-500">Название проекта</div>
          <div className="text-sm text-gray-800 font-medium">{client.project_name || '—'}</div>
        </div>

        <div>
          <div className="text-xs text-gray-500">Статус</div>
          <div className="text-sm text-gray-800 font-medium">{getStatusText(client.status)}</div>
        </div>

        <div>
          <div className="text-xs text-gray-500">URL</div>
          <div className="text-sm text-gray-800">{client.url || '—'}</div>
        </div>

        <div>
          <div className="text-xs text-gray-500">ИНН</div>
          <div className="text-sm text-gray-800">{client.inn || '—'}</div>
        </div>

        <div>
          <div className="text-xs text-gray-500">Юридическое имя</div>
          <div className="text-sm text-gray-800">{client.legal_name || '—'}</div>
        </div>

        <div>
          <div className="text-xs text-gray-500">ОГРН</div>
          <div className="text-sm text-gray-800">{client.ogrn || '—'}</div>
        </div>

        <div className="md:col-span-2">
          <div className="text-xs text-gray-500">Юридический адрес</div>
          <div className="text-sm text-gray-800">{client.legal_address || '—'}</div>
        </div>

        <div>
          <div className="text-xs text-gray-500">Создан</div>
          <div className="text-sm text-gray-800">{formatDate(client.created_at)}</div>
        </div>

        <div>
          <div className="text-xs text-gray-500">Обновлён</div>
          <div className="text-sm text-gray-800">{client.updated_at ? formatDate(client.updated_at) : '—'}</div>
        </div>
      </div>

      {/* Email Notifications - Settings */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Настройка Email уведомлений</h2>

        {/* If email is already verified and present — show compact view */}
        {emailSettings && emailSettings.verified && emailSettings.email ? (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500">Привязанный email</div>
              <div className="text-sm text-gray-800 font-medium">{emailSettings.email}</div>
              <div className="text-xs text-gray-500 mt-1">Статус: <span className="text-green-600">Подтверждён</span></div>
            </div>

            <div className="ml-4">
              {!showUnbindConfirm ? (
                <button onClick={() => setShowUnbindConfirm(true)} className="px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded text-sm">Отвязать</button>
              ) : (
                <div className="flex items-center space-x-2">
                  <button onClick={async () => {
                    try {
                      await api.post('/notifications/email/unbind');
                      setEmailSettings(s => ({ ...s, email: '', verified: false, enabled: false }));
                      setEmailInput('');
                      setShowUnbindConfirm(false);
                      alert('Email отвязан');
                    } catch (e) {
                      setShowUnbindConfirm(false);
                      alert('Не удалось отвязать email');
                    }
                  }} className="px-4 py-2 bg-red-600 text-white rounded text-sm">Подтвердить</button>
                  <button onClick={() => setShowUnbindConfirm(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded text-sm">Отмена</button>
                </div>
              )}
            </div>
          </div>
        ) : (
          // Not verified — show full input + helper + verify flow
          <div>
            <div className="text-xs text-gray-500">Email для уведомлений</div>
            <div className="flex items-center gap-3 mt-2">
              <input value={emailInput} onChange={(e) => setEmailInput(e.target.value)} className="border rounded px-3 py-2 text-sm w-full" placeholder="you@example.com" />
              <button onClick={async () => {
                if (!emailInput) return alert('Введите email');
                try {
                  await api.post('/notifications/email/request', { email: emailInput });
                  setEmailSettings(s => ({ ...s, email: emailInput, verified: false, enabled: true }));
                  alert('Код подтверждения отправлен на указанный email');
                } catch (e) {
                  alert('Не удалось отправить код подтверждения');
                }
              }} className="px-4 py-2 bg-primary-600 text-white rounded text-sm">Отправить код</button>
            </div>

            <div className="text-xs text-gray-500 mt-2">Статус: {emailSettings.verified ? <span className="text-green-600">Подтверждён</span> : <span className="text-yellow-600">Не подтверждён</span>}</div>

            {!emailSettings.verified && (
              <div className="mt-3 flex items-center gap-3">
                <input value={codeInput} onChange={(e) => setCodeInput(e.target.value)} placeholder="Введите код подтверждения" className="border rounded px-3 py-2 text-sm w-64" />
                <button onClick={async () => {
                  if (!codeInput) return alert('Введите код подтверждения');
                  try {
                    await api.post('/notifications/email/verify', { code: codeInput });
                    setEmailSettings(s => ({ ...s, verified: true }));
                    alert('Email подтверждён');
                  } catch (e) {
                    alert('Неверный код');
                  }
                }} className="px-4 py-2 bg-green-600 text-white rounded text-sm">Подтвердить</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Telegram Notifications Widget (after Email settings) */}
      <TelegramNotificationsWidget />

      {/* Email Notifications - Preferences */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Какие уведомления вы хотите получать</h2>
        <div className="mt-2 space-y-2">
          {['new_invoice','new_ticket','ticket_message','ticket_status','new_recommendation'].map((ev) => (
            <div key={ev} className="flex items-center justify-between bg-gray-50 p-3 rounded">
              <div className="text-sm text-gray-800">{ev === 'new_invoice' ? 'Новый счет' : ev === 'new_ticket' ? 'Новый тикет' : ev === 'ticket_message' ? 'Новый ответ в тикете' : ev === 'ticket_status' ? 'Изменение статуса тикета' : 'Новая рекомендация'}</div>
              <div className="flex items-center space-x-3">
                <label className="flex items-center space-x-2 text-sm"><input type="checkbox" checked={!!(emailSettings.preferences && emailSettings.preferences[ev] && emailSettings.preferences[ev].email)} disabled={!emailSettings.verified} onChange={(e) => {
                  const p = { ...(emailSettings.preferences || {}) };
                  p[ev] = p[ev] || { email: false, telegram: false };
                  p[ev].email = e.target.checked;
                  setEmailSettings(s => ({ ...s, preferences: p }));
                }} /> <span>Email</span></label>
                <label className="flex items-center space-x-2 text-sm"><input type="checkbox" checked={!!(emailSettings.preferences && emailSettings.preferences[ev] && emailSettings.preferences[ev].telegram)} onChange={(e) => {
                  const p = { ...(emailSettings.preferences || {}) };
                  p[ev] = p[ev] || { email: false, telegram: false };
                  p[ev].telegram = e.target.checked;
                  setEmailSettings(s => ({ ...s, preferences: p }));
                }} /> <span>Telegram</span></label>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <button onClick={async () => {
            setSavingPrefs(true);
            try {
              await api.put('/notifications/preferences', { preferences: emailSettings.preferences || {}, enabled: !!emailSettings.enabled });
              alert('Настройки сохранены');
            } catch (e) {
              alert('Ошибка при сохранении настроек');
            } finally { setSavingPrefs(false); }
          }} className="px-4 py-2 bg-primary-600 text-white rounded text-sm">Сохранить настройки</button>
        </div>
      </div>
    </div>
  );
};

export default Profile;
