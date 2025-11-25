import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';

const ClientsList = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const response = await api.get('/clients');
      setClients(response.data);
    } catch (error) {
      console.error('Ошибка при загрузке клиентов:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'in_development':
        return 'bg-blue-100 text-blue-800';
      case 'working':
        return 'bg-green-100 text-green-800';
      case 'needs_attention':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'in_development':
        return 'В разработке';
      case 'working':
        return 'Работает';
      case 'needs_attention':
        return 'Требует внимания';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Клиенты</h1>
        <button
          onClick={() => navigate('/admin/clients/new')}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          + Добавить клиента
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {clients.map((client) => (
          <div
            key={client.id}
            onClick={() => navigate(`/admin/clients/${client.id}`)}
            className={`bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow border-l-4 ${
              client.open_tickets_count > 0
                ? 'border-red-500'
                : 'border-transparent'
            }`}
          >
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-lg font-semibold text-gray-800">
                {client.project_name}
              </h3>
              {client.open_tickets_count > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {client.open_tickets_count}
                </span>
              )}
            </div>
            {client.url && (
              <p className="text-sm text-gray-600 mb-2 truncate">
                <a
                  href={client.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-primary-600 hover:underline"
                >
                  {client.url}
                </a>
              </p>
            )}
            <div className="flex items-center justify-between mt-4">
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                  client.status
                )}`}
              >
                {getStatusText(client.status)}
              </span>
              {client.open_tickets_count > 0 && (
                <span className="text-sm text-red-600 font-medium">
                  Открытых тикетов: {client.open_tickets_count}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {clients.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">Клиенты не найдены</p>
        </div>
      )}
    </div>
  );
};

export default ClientsList;

