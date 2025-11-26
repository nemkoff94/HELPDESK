import React, { useState, useEffect } from 'react';
import ConfirmModal from '../../components/ConfirmModal';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../hooks/useAuth';

const ClientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [client, setClient] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [clientLogin, setClientLogin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [newTaskData, setNewTaskData] = useState({
    title: '',
    description: '',
    deadline: '',
  });
  const [showGenerateInvoiceModal, setShowGenerateInvoiceModal] = useState(false);
  const [generateInvoiceData, setGenerateInvoiceData] = useState({ amount: '', serviceName: '' });
  const [previewPdfBase64, setPreviewPdfBase64] = useState(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState(null);
  const [showCreateLoginModal, setShowCreateLoginModal] = useState(false);
  const [newLoginEmail, setNewLoginEmail] = useState('');
  const [newLoginPassword, setNewLoginPassword] = useState('');
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [changePasswordValue, setChangePasswordValue] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    project_name: '',
    url: '',
    legal_name: '',
    legal_address: '',
    inn: '',
    ogrn: '',
    status: 'in_development',
  });
  const [showConfirmDeleteInvoice, setShowConfirmDeleteInvoice] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
  const [showConfirmDeleteClient, setShowConfirmDeleteClient] = useState(false);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchData = async () => {
    try {
      const [clientRes, ticketsRes, invoicesRes, loginRes, tasksRes] = await Promise.all([
        api.get(`/clients/${id}`),
        api.get(`/tickets/client/${id}`),
        api.get(`/invoices/client/${id}`),
        api.get(`/clients/${id}/login`).catch(() => ({ data: null })),
        api.get(`/tasks/client/${id}`).catch(() => ({ data: [] })),
      ]);
      setClient(clientRes.data);
      setTickets(ticketsRes.data);
      setInvoices(invoicesRes.data);
      setClientLogin(loginRes.data);
      setTasks(tasksRes.data || []);
    } catch (error) {
      console.error('Ошибка при загрузке данных:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post(`/clients/${id}/login`, {
        email: newLoginEmail,
        password: newLoginPassword || undefined,
      });
      setPasswordData({
        email: response.data.email,
        password: response.data.password,
      });
      setShowCreateLoginModal(false);
      setShowPasswordModal(true);
      setNewLoginEmail('');
      setNewLoginPassword('');
      fetchData();
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка при создании логина');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    try {
      const response = await api.put(`/clients/${id}/password`, {
        newPassword: changePasswordValue,
      });
      setPasswordData({
        email: clientLogin.email,
        password: response.data.password,
      });
      setShowChangePasswordModal(false);
      setShowPasswordModal(true);
      setChangePasswordValue('');
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка при изменении пароля');
    }
  };

  const handleGeneratePassword = async () => {
    try {
      const response = await api.post(`/clients/${id}/generate-password`);
      setPasswordData({
        email: clientLogin.email,
        password: response.data.password,
      });
      setShowPasswordModal(true);
      fetchData();
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка при генерации пароля');
    }
  };

  const handleOpenGenerateInvoice = () => {
    setGenerateInvoiceData({ amount: '', serviceName: '' });
    setPreviewPdfBase64(null);
    setShowGenerateInvoiceModal(true);
  };

  const handleGenerateInvoicePreview = async (e) => {
    e.preventDefault();
    try {
      setIsGeneratingPreview(true);
      const response = await api.post('/invoices/generate-pdf', {
        client_id: id,
        amount: generateInvoiceData.amount,
        service_name: generateInvoiceData.serviceName,
      });
      setPreviewPdfBase64(response.data.pdf_base64);
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка при генерации счета');
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const handleSaveGeneratedInvoice = async () => {
    try {
      if (!previewPdfBase64) return alert('Сначала сгенерируйте счет для предпросмотра');

      const byteCharacters = atob(previewPdfBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });

      const formData = new FormData();
      formData.append('client_id', id);
      formData.append('amount', generateInvoiceData.amount);
      formData.append('date', new Date().toISOString().split('T')[0]);
      formData.append('comment', generateInvoiceData.serviceName);
      formData.append('file', blob, `invoice-${Date.now()}.pdf`);

      await api.post('/invoices', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setShowGenerateInvoiceModal(false);
      setPreviewPdfBase64(null);
      fetchData();
      alert('Счет успешно создан');
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка при сохранении счета');
    }
  };

  const handleOpenEditModal = () => {
    setEditFormData({
      project_name: client.project_name || '',
      url: client.url || '',
      legal_name: client.legal_name || '',
      legal_address: client.legal_address || '',
      inn: client.inn || '',
      ogrn: client.ogrn || '',
      status: client.status || 'in_development',
    });
    setShowEditModal(true);
  };

  const handleEditChange = (e) => {
    setEditFormData({
      ...editFormData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/clients/${id}`, editFormData);
      setShowEditModal(false);
      fetchData();
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка при обновлении клиента');
    }
  };

  const handleInvoiceStatusChange = async (invoiceId, newStatus) => {
    try {
      await api.put(`/invoices/${invoiceId}/status`, { status: newStatus });
      fetchData();
    } catch (error) {
      console.error('Ошибка при изменении статуса счета:', error);
    }
  };

  const handleDeleteInvoice = async (invoiceId) => {
    // open confirm modal instead of native confirm
    setInvoiceToDelete(invoiceId);
    setShowConfirmDeleteInvoice(true);
  };

  const confirmDeleteInvoice = async () => {
    if (!invoiceToDelete) return;
    try {
      await api.delete(`/invoices/${invoiceToDelete}`);
      setShowConfirmDeleteInvoice(false);
      setInvoiceToDelete(null);
      fetchData();
      alert('Счет удалён');
    } catch (error) {
      setShowConfirmDeleteInvoice(false);
      setInvoiceToDelete(null);
      alert(error.response?.data?.error || 'Ошибка при удалении счета');
    }
  };

  const handleDeleteClient = async () => {
    try {
      await api.delete(`/clients/${id}`);
      setShowConfirmDeleteClient(false);
      alert('Клиент успешно удален');
      navigate('/admin/clients');
    } catch (error) {
      setShowConfirmDeleteClient(false);
      alert(error.response?.data?.error || 'Ошибка при удалении клиента');
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

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      await api.post('/tasks', {
        client_id: id,
        title: newTaskData.title,
        description: newTaskData.description || null,
        deadline: newTaskData.deadline || null,
      });
      setShowCreateTaskModal(false);
      setNewTaskData({ title: '', description: '', deadline: '' });
      fetchData();
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка при создании задачи');
    }
  };

  const isTaskOverdue = (deadline, status) => {
    if (!deadline || status === 'completed') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadlineDate = new Date(deadline);
    deadlineDate.setHours(0, 0, 0, 0);
    return deadlineDate < today;
  };

  const getTaskStatusColor = (status) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTaskStatusText = (status) => {
    switch (status) {
      case 'new':
        return 'Новая';
      case 'in_progress':
        return 'В работе';
      case 'completed':
        return 'Завершена';
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

  if (!client) {
    return <div>Клиент не найден</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <button
          onClick={() => navigate(user?.role === 'admin' ? '/admin/clients' : '/specialist')}
          className="text-primary-600 hover:text-primary-700 flex items-center w-fit"
        >
          ← Назад к списку
        </button>
        {user?.role === 'admin' && (
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button
              onClick={handleOpenEditModal}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 text-sm sm:text-base w-full sm:w-auto"
            >
              Редактировать
            </button>
            <button
              onClick={() => navigate(`/admin/tickets/new?clientId=${id}`)}
              className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 text-sm sm:text-base w-full sm:w-auto"
            >
              + Создать тикет
            </button>
            <button
              onClick={() => navigate(`/admin/invoices/new/${id}`)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm sm:text-base w-full sm:w-auto"
            >
              + Создать счет
            </button>
            <button
              onClick={() => setShowConfirmDeleteClient(true)}
              className="text-red-600 hover:text-red-700 transition-colors text-lg"
              title="Удалить клиента"
            >
              🗑️
            </button>
          </div>
        )}
      </div>

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
          {/* Confirm deletion modal */}
          {showConfirmDeleteInvoice && (
            <ConfirmModal
              open={showConfirmDeleteInvoice}
              title="Удалить счет"
              message="Вы уверены, что хотите удалить этот счет? Это действие нельзя отменить."
              confirmText="Удалить"
              cancelText="Отмена"
              onConfirm={confirmDeleteInvoice}
              onCancel={() => { setShowConfirmDeleteInvoice(false); setInvoiceToDelete(null); }}
            />
          )}
          {/* Confirm client deletion modal */}
          {showConfirmDeleteClient && (
            <ConfirmModal
              open={showConfirmDeleteClient}
              title="Удалить клиента"
              message="Вы уверены, что хотите удалить этого клиента? Это действие удалит все тикеты, счета, задачи и комментарии, связанные с этим клиентом. Это действие нельзя отменить."
              confirmText="Удалить"
              cancelText="Отмена"
              onConfirm={handleDeleteClient}
              onCancel={() => setShowConfirmDeleteClient(false)}
              isDangerous={true}
            />
          )}
        </div>

        {/* Секция управления логином (только для администратора) */}
        {user?.role === 'admin' && (
          <div className="border-t pt-4 mt-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Доступ клиента</h3>
          {clientLogin ? (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div>
                  <p className="text-sm text-gray-600">Email:</p>
                  <p className="font-medium text-gray-800 break-all">{clientLogin.email}</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => setShowChangePasswordModal(true)}
                    className="bg-primary-600 text-white px-3 py-2 rounded text-sm hover:bg-primary-700 w-full sm:w-auto"
                  >
                    Изменить пароль
                  </button>
                  <button
                    onClick={handleGeneratePassword}
                    className="bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700 w-full sm:w-auto"
                  >
                    Сгенерировать пароль
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Создан: {new Date(clientLogin.created_at).toLocaleString('ru-RU')}
              </p>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-gray-700 mb-3">
                Логин для клиента не создан
              </p>
              <button
                onClick={() => setShowCreateLoginModal(true)}
                className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 text-sm w-full sm:w-auto"
              >
                Создать логин
              </button>
            </div>
          )}
          </div>
        )}
      </div>

      {/* Модальное окно для создания логина */}
      {showCreateLoginModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Создать логин для клиента</h2>
            <form onSubmit={handleCreateLogin}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={newLoginEmail}
                  onChange={(e) => setNewLoginEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="client@example.com"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Пароль (оставьте пустым для автогенерации)
                </label>
                <input
                  type="text"
                  value={newLoginPassword}
                  onChange={(e) => setNewLoginPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Оставьте пустым для автогенерации"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
                >
                  Создать
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateLoginModal(false);
                    setNewLoginEmail('');
                    setNewLoginPassword('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно для изменения пароля */}
      {showChangePasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Изменить пароль</h2>
            <form onSubmit={handleChangePassword}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Новый пароль <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={changePasswordValue}
                  onChange={(e) => setChangePasswordValue(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
                >
                  Изменить
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowChangePasswordModal(false);
                    setChangePasswordValue('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно для отображения пароля */}
      {showPasswordModal && passwordData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Данные для входа</h2>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="mb-3">
                <p className="text-sm text-gray-600 mb-1">Email:</p>
                <p className="font-mono font-medium text-gray-800">{passwordData.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Пароль:</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono font-medium text-gray-800 flex-1">{passwordData.password}</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(passwordData.password);
                      alert('Пароль скопирован в буфер обмена');
                    }}
                    className="bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-sm"
                  >
                    Копировать
                  </button>
                </div>
              </div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-800">
                ⚠️ Сохраните эти данные! Пароль больше не будет показан.
              </p>
            </div>
            <button
              onClick={() => {
                setShowPasswordModal(false);
                setPasswordData(null);
              }}
              className="w-full bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

      {/* Модальное окно для редактирования клиента */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 my-8">
            <h2 className="text-xl font-bold text-gray-800 mb-6">Редактировать клиента</h2>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название проекта <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="project_name"
                  value={editFormData.project_name}
                  onChange={handleEditChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL сайта
                </label>
                <input
                  type="url"
                  name="url"
                  value={editFormData.url}
                  onChange={handleEditChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="https://example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Юридическое наименование
                </label>
                <input
                  type="text"
                  name="legal_name"
                  value={editFormData.legal_name}
                  onChange={handleEditChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Юридический адрес
                </label>
                <input
                  type="text"
                  name="legal_address"
                  value={editFormData.legal_address}
                  onChange={handleEditChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ИНН
                  </label>
                  <input
                    type="text"
                    name="inn"
                    value={editFormData.inn}
                    onChange={handleEditChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ОГРН
                  </label>
                  <input
                    type="text"
                    name="ogrn"
                    value={editFormData.ogrn}
                    onChange={handleEditChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Статус проекта <span className="text-red-500">*</span>
                </label>
                <select
                  name="status"
                  value={editFormData.status}
                  onChange={handleEditChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="in_development">В разработке</option>
                  <option value="working">Работает</option>
                  <option value="needs_attention">Требует внимания</option>
                </select>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                >
                  Сохранить изменения
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b">
          <nav className="flex">
            <button
              onClick={() => setActiveTab('tickets')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'tickets'
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Тикеты ({tickets.length})
            </button>
            <button
              onClick={() => setActiveTab('invoices')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'invoices'
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Счета ({invoices.length})
            </button>
            <button
              onClick={() => setActiveTab('generate_invoice')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'generate_invoice'
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Генерировать счет (QR)
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'tasks'
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Задачи ({tasks.length})
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'tickets' && (
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
          )}

          {activeTab === 'invoices' && (
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
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                      {user?.role === 'admin' ? (
                        <select
                          value={invoice.status}
                          onChange={(e) => handleInvoiceStatusChange(invoice.id, e.target.value)}
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
                          onClick={() => handleDeleteInvoice(invoice.id)}
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
          )}

          {activeTab === 'generate_invoice' && (
            <div className="max-w-md">
              <form onSubmit={handleGenerateInvoicePreview} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Сумма (₽) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={generateInvoiceData.amount}
                    onChange={(e) => setGenerateInvoiceData({ ...generateInvoiceData, amount: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Наименование услуги <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={generateInvoiceData.serviceName}
                    onChange={(e) => setGenerateInvoiceData({ ...generateInvoiceData, serviceName: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Например: Поддержка сайта — декабрь 2025"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isGeneratingPreview}
                  className="w-full bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 disabled:bg-gray-400"
                >
                  {isGeneratingPreview ? 'Генерируется...' : 'Просмотреть счет'}
                </button>
              </form>

              {previewPdfBase64 && (
                <div className="mt-4 space-y-4">
                  <div className="h-96 border rounded-lg overflow-hidden">
                    <iframe
                      title="Invoice preview"
                      src={`data:application/pdf;base64,${previewPdfBase64}`}
                      className="w-full h-full"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveGeneratedInvoice}
                      className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                    >
                      Сохранить счет
                    </button>
                    <button
                      onClick={() => setPreviewPdfBase64(null)}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    >
                      Вернуться
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="space-y-3">
              {user?.role === 'admin' && (
                <div className="mb-4">
                  <button
                    onClick={() => setShowCreateTaskModal(true)}
                    className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 text-sm"
                  >
                    + Создать задачу
                  </button>
                </div>
              )}
              {tasks.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  Задач пока нет
                </p>
              ) : (
                tasks.map((task) => {
                  const overdue = isTaskOverdue(task.deadline, task.status);
                  return (
                    <div
                      key={task.id}
                      onClick={() => navigate(`/admin/tasks/${task.id}`)}
                      className={`border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                        overdue ? 'border-2 border-red-500 bg-red-50' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-800">
                              {task.title}
                            </h3>
                            {overdue && (
                              <span className="text-red-600 text-xs font-semibold">
                                ⚠️ ПРОСРОЧЕНА
                              </span>
                            )}
                          </div>
                          {task.description && (
                            <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                              {task.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>
                              Создана: {new Date(task.created_at).toLocaleDateString('ru-RU')}
                            </span>
                            {task.deadline && (
                              <span className={overdue ? 'text-red-600 font-semibold' : ''}>
                                Дедлайн: {new Date(task.deadline).toLocaleDateString('ru-RU')}
                              </span>
                            )}
                            {task.created_by_name && (
                              <span>Автор: {task.created_by_name}</span>
                            )}
                          </div>
                        </div>
                        <span
                          className={`ml-4 px-2 py-1 rounded text-xs font-medium ${getTaskStatusColor(
                            task.status
                          )}`}
                        >
                          {getTaskStatusText(task.status)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Модальное окно для создания задачи */}
      {showCreateTaskModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Создать задачу</h2>
            <form onSubmit={handleCreateTask}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название задачи <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newTaskData.title}
                  onChange={(e) => setNewTaskData({ ...newTaskData, title: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Введите название задачи"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Описание
                </label>
                <textarea
                  value={newTaskData.description}
                  onChange={(e) => setNewTaskData({ ...newTaskData, description: e.target.value })}
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  placeholder="Описание задачи (необязательно)"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Дедлайн
                </label>
                <input
                  type="date"
                  value={newTaskData.deadline}
                  onChange={(e) => setNewTaskData({ ...newTaskData, deadline: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
                >
                  Создать
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateTaskModal(false);
                    setNewTaskData({ title: '', description: '', deadline: '' });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientDetail;