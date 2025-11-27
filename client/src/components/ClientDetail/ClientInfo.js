import React from 'react';

const ClientInfo = ({ client, user, onEdit, onDelete, telegramConnected, onTelegramMessage }) => {
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
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            {client.project_name}
          </h1>
          {client.url && (
            <a
              href={client.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:underline"
            >
              {client.url}
            </a>
          )}
        </div>
        <span
          className={`px-3 py-1 rounded text-sm font-medium ${getStatusColor(
            client.status
          )}`}
        >
          {getStatusText(client.status)}
        </span>
      </div>

      <div className="border-t pt-4">
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
      </div>
    </div>
  );
};

export default ClientInfo;
