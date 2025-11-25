import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../hooks/useAuth';

const InvoicesList = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [debt, setDebt] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchData = async () => {
    try {
      const [invoicesRes, debtRes] = await Promise.all([
        api.get(`/invoices/client/${user.id}`),
        api.get(`/invoices/debt/${user.id}`),
      ]);
      setInvoices(invoicesRes.data);
      setDebt(debtRes.data.total_debt);
    } catch (error) {
      console.error('Ошибка при загрузке данных:', error);
    } finally {
      setLoading(false);
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
        <button
          onClick={() => navigate('/client')}
          className="text-primary-600 hover:text-primary-700 flex items-center"
        >
          ← Назад
        </button>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Мои счета</h1>
        {debt > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-600 mb-1">Задолженность</p>
            <p className="text-2xl font-bold text-red-600">
              {debt.toLocaleString('ru-RU')} ₽
            </p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="space-y-3">
          {invoices.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Счетов пока нет</p>
          ) : (
            invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="border rounded-lg p-4 flex justify-between items-center"
              >
                <div>
                  <p className="font-semibold">
                    {new Date(invoice.date).toLocaleDateString('ru-RU')}
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
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      invoice.status === 'paid'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {invoice.status === 'paid' ? 'Оплачен' : 'Не оплачен'}
                  </span>
                  {invoice.file_path && (
                    <a
                      href={`http://localhost:5001${invoice.file_path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:text-primary-700 text-sm"
                    >
                      Скачать
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default InvoicesList;

