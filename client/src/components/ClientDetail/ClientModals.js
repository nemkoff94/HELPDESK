import React from 'react';
import ConfirmModal from '../ConfirmModal';

const ClientModals = ({
  showCreateLoginModal,
  showChangePasswordModal,
  showPasswordModal,
  showEditModal,
  showConfirmDeleteInvoice,
  showConfirmDeleteClient,
  showConfirmDeleteTicket,
  showCreateTaskModal,
  showTelegramMessageModal,
  
  newLoginEmail,
  newLoginPassword,
  changePasswordValue,
  passwordData,
  editFormData,
  invoiceToDelete,
  ticketToDelete,
  newTaskData,
  telegramMessage,
  sendingTelegram,
  
  onCreateLogin,
  onChangePassword,
  onClosePasswordModal,
  onGeneratePassword,
  onEditChange,
  onSaveEdit,
  onCancelEdit,
  onConfirmDeleteInvoice,
  onCancelDeleteInvoice,
  onConfirmDeleteClient,
  onCancelDeleteClient,
  onConfirmDeleteTicket,
  onCancelDeleteTicket,
  onCreateTask,
  onCancelCreateTask,
  onTaskDataChange,
  onSendTelegramMessage,
  onCancelTelegramMessage,
  onNewLoginEmailChange,
  onNewLoginPasswordChange,
  onChangePasswordValueChange,
  onCloseCreateLoginModal,
  onCloseChangePasswordModal,
  onCloseTelegramModal,
  onTelegramMessageChange,
}) => {
  return (
    <>
      {/* Модальное окно для создания логина */}
      {showCreateLoginModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Создать логин для клиента</h2>
            <form onSubmit={onCreateLogin}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={newLoginEmail}
                  onChange={(e) => onNewLoginEmailChange(e.target.value)}
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
                  onChange={(e) => onNewLoginPasswordChange(e.target.value)}
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
                  onClick={onCloseCreateLoginModal}
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
            <form onSubmit={onChangePassword}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Новый пароль <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={changePasswordValue}
                  onChange={(e) => onChangePasswordValueChange(e.target.value)}
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
                  onClick={onCloseChangePasswordModal}
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
              onClick={onClosePasswordModal}
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
            <form onSubmit={onSaveEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название проекта <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="project_name"
                  value={editFormData.project_name}
                  onChange={onEditChange}
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
                  onChange={onEditChange}
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
                  onChange={onEditChange}
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
                  onChange={onEditChange}
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
                    onChange={onEditChange}
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
                    onChange={onEditChange}
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
                  onChange={onEditChange}
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
                  onClick={onCancelEdit}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm deletion modals */}
      {showConfirmDeleteInvoice && (
        <ConfirmModal
          open={showConfirmDeleteInvoice}
          title="Удалить счет"
          message="Вы уверены, что хотите удалить этот счет? Это действие нельзя отменить."
          confirmText="Удалить"
          cancelText="Отмена"
          onConfirm={onConfirmDeleteInvoice}
          onCancel={onCancelDeleteInvoice}
        />
      )}

      {showConfirmDeleteClient && (
        <ConfirmModal
          open={showConfirmDeleteClient}
          title="Удалить клиента"
          message="Вы уверены, что хотите удалить этого клиента? Это действие удалит все тикеты, счета, задачи и комментарии, связанные с этим клиентом. Это действие нельзя отменить."
          confirmText="Удалить"
          cancelText="Отмена"
          onConfirm={onConfirmDeleteClient}
          onCancel={onCancelDeleteClient}
          isDangerous={true}
        />
      )}

      {showConfirmDeleteTicket && ticketToDelete && (
        <ConfirmModal
          open={showConfirmDeleteTicket}
          title="Удалить тикет"
          message={`Вы уверены, что хотите удалить тикет "${ticketToDelete.title}"? Это действие нельзя отменить.`}
          confirmText="Удалить"
          cancelText="Отмена"
          onConfirm={onConfirmDeleteTicket}
          onCancel={onCancelDeleteTicket}
          isDangerous={true}
        />
      )}

      {/* Модальное окно для создания задачи */}
      {showCreateTaskModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Создать задачу</h2>
            <form onSubmit={onCreateTask}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название задачи <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newTaskData.title}
                  onChange={(e) => onTaskDataChange('title', e.target.value)}
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
                  onChange={(e) => onTaskDataChange('description', e.target.value)}
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
                  onChange={(e) => onTaskDataChange('deadline', e.target.value)}
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
                  onClick={onCancelCreateTask}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно для отправки Telegram сообщения */}
      {showTelegramMessageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Отправить Telegram сообщение</h2>
            <form onSubmit={onSendTelegramMessage}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Сообщение <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={telegramMessage}
                  onChange={(e) => onTelegramMessageChange(e.target.value)}
                  required
                  rows="4"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  placeholder="Введите сообщение для отправки в Telegram"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={sendingTelegram}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {sendingTelegram ? 'Отправка...' : 'Отправить'}
                </button>
                <button
                  type="button"
                  onClick={onCloseTelegramModal}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default ClientModals;
