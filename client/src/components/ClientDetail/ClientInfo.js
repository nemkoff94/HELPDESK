import React from 'react';

const ClientInfo = ({ client, user, onEdit, onDelete, telegramConnected, onTelegramMessage, ticketsCount = 0, invoicesCount = 0, tasksCount = 0 }) => {
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

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-4">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="h-14 w-14 rounded-full bg-gray-200 flex items-center justify-center text-xl font-semibold text-gray-700">
              {getInitials(client.project_name)}
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-1">
              {client.project_name}
            </h1>
            <div className="flex items-center gap-3 text-sm">
              {client.url && (
                <>
                  <a href={client.url} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M18 13v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M15 3h6v6" />
                      <path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M10 14L21 3" />
                    </svg>
                    <span className="truncate max-w-xs">{client.url}</span>
                  </a>
                  <button
                    onClick={() => copyToClipboard(client.url)}
                    className="text-gray-500 hover:text-gray-700"
                    title="Скопировать URL"
                    aria-label="Скопировать URL"
                  >
                    📋
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className={`px-3 py-1 rounded text-sm font-medium flex items-center gap-2 ${getStatusColor(client.status)}`} title={getStatusText(client.status)} role="status">
            {getStatusIcon(client.status)}
            <span>{getStatusText(client.status)}</span>
          </span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:justify-between gap-4 border-t pt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {client.legal_name && (
            <div>
              <span className="text-gray-600">Юридическое наименование:</span>
              <p className="font-medium">{client.legal_name}</p>
            </div>
          )}
          {client.legal_address && (
            <div>
              <span className="text-gray-600">Юридический адрес:</span>
              <p className="font-medium">{client.legal_address}</p>
            </div>
          )}
          {client.inn && (
            <div>
              <span className="text-gray-600">ИНН:</span>
              <p className="font-medium">{client.inn}</p>
            </div>
          )}
          {client.ogrn && (
            <div>
              <span className="text-gray-600">ОГРН:</span>
              <p className="font-medium">{client.ogrn}</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex gap-3">
            <div className="bg-white border rounded-lg px-5 py-4 text-center min-w-[120px]">
              <div className="text-2xl md:text-3xl font-semibold text-gray-800">{ticketsCount}</div>
              <div className="text-xs text-gray-500 mt-1">Тикетов</div>
            </div>
            <div className="bg-white border rounded-lg px-5 py-4 text-center min-w-[120px]">
              <div className="text-2xl md:text-3xl font-semibold text-gray-800">{invoicesCount}</div>
              <div className="text-xs text-gray-500 mt-1">Счётов</div>
            </div>
            <div className="bg-white border rounded-lg px-5 py-4 text-center min-w-[120px]">
              <div className="text-2xl md:text-3xl font-semibold text-gray-800">{tasksCount}</div>
              <div className="text-xs text-gray-500 mt-1">Задач</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function getInitials(name) {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function copyToClipboard(text) {
  if (!text) return;
  try {
    navigator.clipboard.writeText(text);
    // small visual feedback could be added here
  } catch (e) {
    console.error('Copy failed', e);
  }
}

function getStatusIcon(status) {
  switch (status) {
    case 'in_development':
      return '🛠️';
    case 'working':
      return '✅';
    case 'needs_attention':
      return '⚠️';
    default:
      return 'ℹ️';
  }
}

export default ClientInfo;
