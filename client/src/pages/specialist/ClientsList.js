import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';

const SpecialistClientsList = () => {
  const [clients, setClients] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [clientsRes, ticketsRes] = await Promise.all([
        api.get('/clients'),
        api.get('/tickets'),
      ]);
      setClients(clientsRes.data);
      setTickets(ticketsRes.data);
    } catch (error) {
      console.error('Ошибка при загрузке данных:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTicketStatusColor = (status) => {
    switch (status) {
      case 'open':
        return 'bg-red-100 text-red-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTicketStatusText = (status) => {
    switch (status) {
      case 'open':
        return 'Открыт';
      case 'in_progress':
        return 'В работе';
      case 'resolved':
        return 'Решен';
      case 'closed':
        return 'Закрыт';
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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Клиенты и тикеты</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {clients.map((client) => {
          const clientTickets = tickets.filter((t) => t.client_id === client.id);
          return (
            <div
              key={client.id}
              className="bg-white rounded-lg shadow-md p-6"
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-lg font-semibold text-gray-800">
                  {client.project_name}
                </h3>
                <button
                  onClick={() => navigate(`/specialist/clients/${client.id}`)}
                  className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                >
                  Подробнее →
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Тикетов: {clientTickets.length}
              </p>
              <div className="space-y-2">
                {clientTickets.slice(0, 3).map((ticket) => (
                  <div
                    key={ticket.id}
                    onClick={() => navigate(`/specialist/tickets/${ticket.id}`)}
                    className="border rounded-lg p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <p className="font-medium text-sm text-gray-800 mb-1">
                      {ticket.title}
                    </p>
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${getTicketStatusColor(
                        ticket.status
                      )}`}
                    >
                      {getTicketStatusText(ticket.status)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Все тикеты</h2>
        <div className="space-y-3">
          {tickets.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Тикетов пока нет</p>
          ) : (
            tickets.map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => navigate(`/specialist/tickets/${ticket.id}`)}
                className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 mb-1">
                      {ticket.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">
                      Клиент: {ticket.client_name}
                    </p>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {ticket.description}
                    </p>
                  </div>
                  <span
                    className={`ml-4 px-2 py-1 rounded text-xs font-medium ${getTicketStatusColor(
                      ticket.status
                    )}`}
                  >
                    {getTicketStatusText(ticket.status)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SpecialistClientsList;

