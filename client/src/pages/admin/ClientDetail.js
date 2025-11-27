import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../hooks/useAuth';
import ClientInfo from '../../components/ClientDetail/ClientInfo';
import ClientAccess from '../../components/ClientDetail/ClientAccess';
import ClientModals from '../../components/ClientDetail/ClientModals';
import TicketsTab from '../../components/ClientDetail/TicketsTab';
import InvoicesTab from '../../components/ClientDetail/InvoicesTab';
import GenerateInvoiceTab from '../../components/ClientDetail/GenerateInvoiceTab';
import TasksTab from '../../components/ClientDetail/TasksTab';

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
  const [activeTab, setActiveTab] = useState('tickets');
  const [telegramConnected, setTelegramConnected] = useState(false);

  // Modal states
  const [showCreateLoginModal, setShowCreateLoginModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showConfirmDeleteInvoice, setShowConfirmDeleteInvoice] = useState(false);
  const [showConfirmDeleteClient, setShowConfirmDeleteClient] = useState(false);
  const [showConfirmDeleteTicket, setShowConfirmDeleteTicket] = useState(false);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [showTelegramMessageModal, setShowTelegramMessageModal] = useState(false);

  // Form data states
  const [newLoginEmail, setNewLoginEmail] = useState('');
  const [newLoginPassword, setNewLoginPassword] = useState('');
  const [changePasswordValue, setChangePasswordValue] = useState('');
  const [passwordData, setPasswordData] = useState(null);
  const [editFormData, setEditFormData] = useState({
    project_name: '',
    url: '',
    legal_name: '',
    legal_address: '',
    inn: '',
    ogrn: '',
    status: 'in_development',
  });
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
  const [ticketToDelete, setTicketToDelete] = useState(null);
  const [newTaskData, setNewTaskData] = useState({
    title: '',
    description: '',
    deadline: '',
  });
  const [generateInvoiceData, setGenerateInvoiceData] = useState({ amount: '', serviceName: '' });
  const [previewPdfBase64, setPreviewPdfBase64] = useState(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [telegramMessage, setTelegramMessage] = useState('');
  const [sendingTelegram, setSendingTelegram] = useState(false);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchData = async () => {
    try {
      const [clientRes, ticketsRes, invoicesRes, loginRes, tasksRes, telegramRes] = await Promise.all([
        api.get(`/clients/${id}`),
        api.get(`/tickets/client/${id}`),
        api.get(`/invoices/client/${id}`),
        api.get(`/clients/${id}/login`).catch(() => ({ data: null })),
        api.get(`/tasks/client/${id}`).catch(() => ({ data: [] })),
        api.get(`/telegram/client/${id}/status`).catch(() => ({ data: { connected: false } })),
      ]);
      setClient(clientRes.data);
      setTickets(ticketsRes.data);
      setInvoices(invoicesRes.data);
      setClientLogin(loginRes.data);
      setTasks(tasksRes.data || []);
      setTelegramConnected(telegramRes.data.connected || false);
    } catch (error) {
      console.error('Ошибка при загрузке данных:', error);
    } finally {
      setLoading(false);
    }
  };

  // Login handlers
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

  // Edit handlers
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

  // Invoice handlers
  const handleInvoiceStatusChange = async (invoiceId, newStatus) => {
    try {
      await api.put(`/invoices/${invoiceId}/status`, { status: newStatus });
      fetchData();
    } catch (error) {
      console.error('Ошибка при изменении статуса счета:', error);
    }
  };

  const handleDeleteInvoice = (invoiceId) => {
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

  // Task handlers
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

  const requestDeleteTicket = (ticket) => {
    setTicketToDelete(ticket);
    setShowConfirmDeleteTicket(true);
  };

  const confirmDeleteTicket = async () => {
    if (!ticketToDelete) return;
    try {
      await api.delete(`/tickets/${ticketToDelete.id}`);
      setShowConfirmDeleteTicket(false);
      setTicketToDelete(null);
      fetchData();
      alert('Тикет удалён');
    } catch (error) {
      setShowConfirmDeleteTicket(false);
      setTicketToDelete(null);
      alert(error.response?.data?.error || 'Ошибка при удалении тикета');
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

  // Generate invoice handlers
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

      setPreviewPdfBase64(null);
      fetchData();
      alert('Счет успешно создан');
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка при сохранении счета');
    }
  };

  // Telegram handlers
  const handleSendTelegramMessage = async (e) => {
    e.preventDefault();
    if (!telegramMessage.trim()) {
      alert('Сообщение не может быть пустым');
      return;
    }

    try {
      setSendingTelegram(true);
      await api.post(`/telegram/client/${id}/send-message`, {
        message: telegramMessage,
      });
      alert('Сообщение отправлено!');
      setShowTelegramMessageModal(false);
      setTelegramMessage('');
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка при отправке сообщения');
    } finally {
      setSendingTelegram(false);
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
      {/* Header with buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <button
          onClick={() => navigate(user?.role === 'admin' ? '/admin/clients' : '/specialist')}
          className="text-primary-600 hover:text-primary-700 flex items-center w-fit"
        >
          ← Назад к списку
        </button>
        {user?.role === 'admin' && (
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto flex-wrap">
            <button
              onClick={handleOpenEditModal}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 text-sm sm:text-base w-full sm:w-auto"
            >
              Редактировать
            </button>
            {telegramConnected && (
              <button
                onClick={() => setShowTelegramMessageModal(true)}
                className="bg-blue-400 text-white px-4 py-2 rounded-lg hover:bg-blue-500 text-sm sm:text-base w-full sm:w-auto"
                title="Отправить сообщение в Telegram"
              >
                💬 Telegram
              </button>
            )}
            <button
              onClick={() => navigate(`/admin/clients/${id}/widgets`)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm sm:text-base w-full sm:w-auto"
            >
              Управлять виджетами
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

      {/* Client Info */}
      <ClientInfo client={client} user={user} />

      {/* Client Access Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <ClientAccess
          clientLogin={clientLogin}
          user={user}
          onCreateLogin={() => setShowCreateLoginModal(true)}
          onChangePassword={() => setShowChangePasswordModal(true)}
          onGeneratePassword={handleGeneratePassword}
        />
      </div>

      {/* Tabs Section */}
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
            <TicketsTab
              tickets={tickets}
              user={user}
              navigate={navigate}
              onDeleteTicket={requestDeleteTicket}
            />
          )}

          {activeTab === 'invoices' && (
            <InvoicesTab
              invoices={invoices}
              user={user}
              id={id}
              navigate={navigate}
              onStatusChange={handleInvoiceStatusChange}
              onDeleteInvoice={handleDeleteInvoice}
            />
          )}

          {activeTab === 'generate_invoice' && (
            <GenerateInvoiceTab
              generateInvoiceData={generateInvoiceData}
              previewPdfBase64={previewPdfBase64}
              isGeneratingPreview={isGeneratingPreview}
              onInputChange={(field, value) => setGenerateInvoiceData({ ...generateInvoiceData, [field]: value })}
              onGeneratePreview={handleGenerateInvoicePreview}
              onSaveInvoice={handleSaveGeneratedInvoice}
              onCancelPreview={() => setPreviewPdfBase64(null)}
            />
          )}

          {activeTab === 'tasks' && (
            <TasksTab
              tasks={tasks}
              user={user}
              navigate={navigate}
              onDeleteTask={(task) => {
                setTicketToDelete(task);
                setShowConfirmDeleteTicket(true);
              }}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <ClientModals
        showCreateLoginModal={showCreateLoginModal}
        showChangePasswordModal={showChangePasswordModal}
        showPasswordModal={showPasswordModal}
        showEditModal={showEditModal}
        showConfirmDeleteInvoice={showConfirmDeleteInvoice}
        showConfirmDeleteClient={showConfirmDeleteClient}
        showConfirmDeleteTicket={showConfirmDeleteTicket}
        showCreateTaskModal={showCreateTaskModal}
        showTelegramMessageModal={showTelegramMessageModal}
        
        newLoginEmail={newLoginEmail}
        newLoginPassword={newLoginPassword}
        changePasswordValue={changePasswordValue}
        passwordData={passwordData}
        editFormData={editFormData}
        invoiceToDelete={invoiceToDelete}
        ticketToDelete={ticketToDelete}
        newTaskData={newTaskData}
        telegramMessage={telegramMessage}
        sendingTelegram={sendingTelegram}
        
        onCreateLogin={handleCreateLogin}
        onChangePassword={handleChangePassword}
        onClosePasswordModal={() => {
          setShowPasswordModal(false);
          setPasswordData(null);
        }}
        onGeneratePassword={handleGeneratePassword}
        onEditChange={handleEditChange}
        onSaveEdit={handleSaveEdit}
        onCancelEdit={() => setShowEditModal(false)}
        onConfirmDeleteInvoice={confirmDeleteInvoice}
        onCancelDeleteInvoice={() => {
          setShowConfirmDeleteInvoice(false);
          setInvoiceToDelete(null);
        }}
        onConfirmDeleteClient={handleDeleteClient}
        onCancelDeleteClient={() => setShowConfirmDeleteClient(false)}
        onConfirmDeleteTicket={confirmDeleteTicket}
        onCancelDeleteTicket={() => {
          setShowConfirmDeleteTicket(false);
          setTicketToDelete(null);
        }}
        onCreateTask={handleCreateTask}
        onCancelCreateTask={() => {
          setShowCreateTaskModal(false);
          setNewTaskData({ title: '', description: '', deadline: '' });
        }}
        onTaskDataChange={(field, value) => setNewTaskData({ ...newTaskData, [field]: value })}
        onSendTelegramMessage={handleSendTelegramMessage}
        onCancelTelegramMessage={() => {
          setShowTelegramMessageModal(false);
          setTelegramMessage('');
        }}
        onNewLoginEmailChange={setNewLoginEmail}
        onNewLoginPasswordChange={setNewLoginPassword}
        onChangePasswordValueChange={setChangePasswordValue}
        onCloseCreateLoginModal={() => {
          setShowCreateLoginModal(false);
          setNewLoginEmail('');
          setNewLoginPassword('');
        }}
        onCloseChangePasswordModal={() => {
          setShowChangePasswordModal(false);
          setChangePasswordValue('');
        }}
        onCloseTelegramModal={() => {
          setShowTelegramMessageModal(false);
          setTelegramMessage('');
        }}
        onTelegramMessageChange={setTelegramMessage}
      />
    </div>
  );
};

export default ClientDetail;
