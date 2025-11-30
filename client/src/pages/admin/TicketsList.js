import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import formatDate from '../../utils/formatDate';

const AdminTicketsList = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTickets = async () => {
    try {
      const res = await api.get('/tickets');
      setTickets(res.data || []);
    } catch (e) {
      console.error('Ошибка при загрузке тикетов:', e);
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Тикеты</h1>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="space-y-3">
          {tickets.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Тикетов пока нет</p>
          ) : (
            tickets.map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => navigate(`/admin/tickets/${ticket.id}`)}
                className={`border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors ${ticket.has_unread_response ? 'ring-1 ring-primary-200' : ''}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {ticket.has_unread_response && (
                        <span className="inline-block h-3 w-3 rounded-full bg-primary-600 animate-pulse" aria-hidden="true" />
                      )}
                      <h3 className="font-semibold text-gray-800">{ticket.title}</h3>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{ticket.description}</p>
                    <div className="text-xs text-gray-500 mt-2 flex gap-4">
                      <div>Клиент: {ticket.client_name || ticket.client_id}</div>
                      <div>Создано: {formatDate(ticket.created_at_utc || ticket.created_at)}</div>
                    </div>
                  </div>
                  <span
                    className={`ml-4 px-2 py-1 rounded text-xs font-medium ${getTicketStatusColor(
                      ticket.status
                    )}`}
                  >
                    {ticket.status}
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

export default AdminTicketsList;
