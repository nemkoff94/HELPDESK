import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../api';
import formatDate from '../../utils/formatDate';

const Profile = () => {
  const { user } = useAuth();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchClient = async () => {
      if (!user) return;
      try {
        const res = await api.get(`/clients/${user.id}`);
        setClient(res.data);
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
        // Попробуем показать читаемый вариант: заменить _ на пробел и capitalise
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
    </div>
  );
};

export default Profile;
