import React from 'react';
import formatDate from '../../utils/formatDate';

const InvoicesTab = ({ invoices, user, id, navigate, onStatusChange, onDeleteInvoice }) => {
  return (
    <div className="space-y-3">
      {user?.role === 'admin' && (
        <div className="mb-4">
          <button
            onClick={() => navigate(`/admin/invoices/new/${id}`)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm"
          >
            + Создать счет
          </button>
        </div>
      )}
      {invoices.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          Счетов пока нет
        </p>
      ) : (
        invoices.map((invoice) => (
          <div
            key={invoice.id}
            className="border rounded-lg p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4"
          >
            <div className="flex-1">
              <p className="font-semibold">
                {formatDate(invoice.date, { year: 'numeric', month: '2-digit', day: '2-digit' })}
              </p>
              <p className="text-sm text-gray-600">
                {invoice.amount.toLocaleString('ru-RU')} ₽
              </p>
              {invoice.comment && (
                <p className="text-sm text-gray-500 mt-1">
                  {invoice.comment}
                </p>
              )}
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              {user?.role === 'admin' ? (
                <select
                  value={invoice.status}
                  onChange={(e) => onStatusChange(invoice.id, e.target.value)}
                  className={`px-2 py-1 rounded text-xs font-medium border flex-1 sm:flex-none ${
                    invoice.status === 'paid'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  <option value="unpaid">Не оплачен</option>
                  <option value="paid">Оплачен</option>
                </select>
              ) : (
                <span
                  className={`px-2 py-1 rounded text-xs font-medium text-center ${
                    invoice.status === 'paid'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {invoice.status === 'paid' ? 'Оплачен' : 'Не оплачен'}
                </span>
              )}
              {invoice.file_path && (
                <a
                  href={`http://localhost:5001${invoice.file_path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:text-primary-700 text-sm px-2 py-1 border border-primary-600 rounded text-center"
                >
                  Скачать
                </a>
              )}
              {user?.role === 'admin' && (
                <button
                  onClick={() => onDeleteInvoice(invoice.id)}
                  className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 flex-1 sm:flex-none"
                >
                  Удалить
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default InvoicesTab;
