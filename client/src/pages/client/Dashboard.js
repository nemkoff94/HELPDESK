import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../hooks/useAuth';
import AdCampaignWidget from '../../components/widgets/AdCampaignWidget';
import RenewalCalendarWidget from '../../components/widgets/RenewalCalendarWidget';
import RecommendationsWidget from '../../components/widgets/RecommendationsWidget';
import SiteAvailabilityWidget from '../../components/widgets/SiteAvailabilityWidget';
import TelegramNotificationsWidget from '../../components/widgets/TelegramNotificationsWidget';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [client, setClient] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [services, setServices] = useState([]);
  const [debt, setDebt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState(null);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showConfirmOrder, setShowConfirmOrder] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchData = async () => {
    try {
      const [clientRes, ticketsRes, invoicesRes, debtRes, servicesRes] = await Promise.all([
        api.get(`/clients/${user.id}`),
        api.get(`/tickets/client/${user.id}`),
        api.get(`/invoices/client/${user.id}`),
        api.get(`/invoices/debt/${user.id}`),
        api.get('/services'),
      ]);
      setClient(clientRes.data);
      setTickets(ticketsRes.data);
      setInvoices(invoicesRes.data);
      setDebt(debtRes.data.total_debt);
      setServices(servicesRes.data);
    } catch (error) {
      console.error('Ошибка при загрузке данных:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOrderService = async () => {
    if (!selectedService) return;
    try {
      await api.post(`/services/${selectedService.id}/order`);
      setShowConfirmOrder(false);
      setShowServiceModal(false);
      setSelectedService(null);
      alert('Услуга успешно заказана! Для вас создан новый тикет.');
      fetchData();
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка при заказе услуги');
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
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">
          {client?.project_name}
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600 mb-1">Статус проекта</p>
            <span
              className={`inline-block px-3 py-1 rounded text-sm font-medium ${getStatusColor(
                client?.status
              )}`}
            >
              {getStatusText(client?.status)}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Открытых тикетов</p>
            <p className="text-2xl font-bold text-gray-800">
              {tickets.filter((t) => ['open', 'in_progress'].includes(t.status)).length}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Задолженность</p>
            <p className="text-2xl font-bold text-red-600">
              {debt.toLocaleString('ru-RU')} ₽
            </p>
          </div>
        </div>
      </div>

      {/* Виджеты */}
      <TelegramNotificationsWidget />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <AdCampaignWidget clientId={user?.id} api={api} />
        </div>
        <div>
          <RenewalCalendarWidget clientId={user?.id} api={api} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <RecommendationsWidget clientId={user?.id} api={api} />
        </div>
        <div>
          <SiteAvailabilityWidget clientId={user?.id} api={api} />
        </div>
      </div>

      {services.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Доступные услуги</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((service) => (
              <div
                key={service.id}
                className="border rounded-lg p-4 hover:shadow-lg transition-shadow"
              >
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  {service.name}
                </h3>
                {service.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {service.description}
                  </p>
                )}
                <div className="flex items-end justify-between">
                  <div className="text-2xl font-bold text-primary-600">
                    {service.price.toLocaleString('ru-RU')} ₽
                  </div>
                  <button
                    onClick={() => {
                      setSelectedService(service);
                      setShowServiceModal(true);
                    }}
                    className="bg-primary-600 text-white px-3 py-2 rounded hover:bg-primary-700 text-sm"
                  >
                    Подробнее
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">Тикеты</h2>
            <button
              onClick={() => navigate('/client/tickets/new')}
              className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 text-sm"
            >
              + Новый тикет
            </button>
          </div>
          <div className="space-y-3">
            {tickets.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Тикетов пока нет</p>
            ) : (
              tickets.slice(0, 5).map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={() => navigate(`/client/tickets/${ticket.id}`)}
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
            {tickets.length > 5 && (
              <button
                onClick={() => navigate('/client/tickets/all')}
                className="w-full text-primary-600 hover:text-primary-700 text-sm font-medium"
              >
                Показать все тикеты →
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Счета</h2>
          <div className="space-y-3">
            {invoices.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Счетов пока нет</p>
            ) : (
              invoices.slice(0, 5).map((invoice) => (
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
            {invoices.length > 5 && (
              <button
                onClick={() => navigate('/client/invoices/all')}
                className="w-full text-primary-600 hover:text-primary-700 text-sm font-medium"
              >
                Показать все счета →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Модальное окно для просмотра услуги */}
      {showServiceModal && selectedService && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              {selectedService.name}
            </h2>
            {selectedService.description && (
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">Описание:</p>
                <p className="text-gray-800">{selectedService.description}</p>
              </div>
            )}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-600 mb-1">Стоимость:</p>
              <p className="text-3xl font-bold text-primary-600">
                {selectedService.price.toLocaleString('ru-RU')} ₽
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmOrder(true)}
                className="flex-1 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 font-medium"
              >
                Заказать
              </button>
              <button
                onClick={() => {
                  setShowServiceModal(false);
                  setSelectedService(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно подтверждения заказа */}
      {showConfirmOrder && selectedService && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Подтверждение заказа</h2>
            <p className="text-gray-700 mb-4">
              Вы уверены, что хотите заказать услугу "<strong>{selectedService.name}</strong>" стоимостью <strong>{selectedService.price.toLocaleString('ru-RU')} ₽</strong>?
            </p>
            <p className="text-sm text-gray-600 mb-6">
              Для вас будет создан новый тикет с этой услугой.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleOrderService}
                className="flex-1 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 font-medium"
              >
                Заказать
              </button>
              <button
                onClick={() => {
                  setShowConfirmOrder(false);
                  setShowServiceModal(false);
                  setSelectedService(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

