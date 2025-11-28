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
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);

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
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(user?.role === 'admin' ? '/admin/clients' : '/specialist')}
            className="text-primary-600 hover:text-primary-700 flex items-center w-fit"
          >
            ← Назад к списку
          </button>
        </div>

        {user?.role === 'admin' && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => navigate(`/admin/tickets/new?clientId=${id}`)}
              className="bg-primary-700 text-white px-4 py-2 rounded-lg hover:bg-primary-800 focus:outline-none focus:ring-2 focus:ring-primary-300 text-sm sm:text-base w-full sm:w-auto flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Создать тикет</span>
            </button>

            <button
              onClick={() => navigate(`/admin/invoices/new/${id}`)}
              className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-300 text-sm sm:text-base w-full sm:w-auto flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M21 10v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M17 3v4M7 14h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Создать счёт</span>
            </button>

            <div className="relative">
              <button
                onClick={() => setShowActionsDropdown(!showActionsDropdown)}
                className="bg-gray-100 text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-200 text-sm flex items-center gap-2"
                aria-haspopup="true"
                aria-expanded={showActionsDropdown}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M12 6v.01M12 12v.01M12 18v.01" />
                </svg>
                Действия
              </button>

              {showActionsDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white border rounded shadow-lg z-40">
                  <button onClick={handleOpenEditModal} className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M3 21v-3.75L14.06 6.19a2 2 0 0 1 2.83 0l1.92 1.92a2 2 0 0 1 0 2.83L7.75 22H3z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Редактировать
                  </button>
                  <button onClick={() => { navigate(`/admin/clients/${id}/widgets`); setShowActionsDropdown(false); }} className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M4 7h4v4H4zM10 7h4v4h-4zM16 7h4v4h-4zM4 13h4v4H4zM10 13h4v4h-4zM16 13h4v4h-4z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Управлять виджетами
                  </button>
                  {telegramConnected && (
                    <button onClick={() => { setShowTelegramMessageModal(true); setShowActionsDropdown(false); }} className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Отправить Telegram
                    </button>
                  )}
                  <button onClick={() => { setShowConfirmDeleteClient(true); setShowActionsDropdown(false); }} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-red-600 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M3 6h18M8 6v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6M10 6V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Удалить клиента
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Client Info */}
      <ClientInfo
        client={client}
        user={user}
        ticketsCount={tickets.length}
        invoicesCount={invoices.length}
        tasksCount={tasks.length}
        telegramConnected={telegramConnected}
      />

      {/* Client Access Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <ClientAccess
          clientLogin={clientLogin}
          user={user}
          onCreateLogin={() => setShowCreateLoginModal(true)}
          onChangePassword={() => setShowChangePasswordModal(true)}
          onGeneratePassword={handleGeneratePassword}
          telegramConnected={telegramConnected}
          onOpenTelegram={() => setShowTelegramMessageModal(true)}
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
