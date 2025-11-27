import React from 'react';

const TicketsTab = ({ tickets, user, navigate, onDeleteTicket }) => {
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

  return (
    <div className="space-y-3">
      {tickets.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          Тикетов пока нет
        </p>
      ) : (
        tickets.map((ticket) => (
          <div
            key={ticket.id}
            onClick={() => navigate(user?.role === 'admin' ? `/admin/tickets/${ticket.id}` : `/specialist/tickets/${ticket.id}`)}
            className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800 mb-1">
                  {ticket.title}
                </h3>
                <p className="text-sm text-gray-600 line-clamp-2">
                  {ticket.description}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  {new Date(ticket.created_at).toLocaleString('ru-RU')}
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span
                  className={`ml-4 px-2 py-1 rounded text-xs font-medium ${getTicketStatusColor(
                    ticket.status
                  )}`}
                >
                  {getTicketStatusText(ticket.status)}
                </span>
                {user?.role === 'admin' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteTicket(ticket);
                    }}
                    className="text-red-600 hover:text-red-800 font-medium text-sm"
                    title="Удалить тикет"
                  >
                    Удалить
                  </button>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default TicketsTab;
