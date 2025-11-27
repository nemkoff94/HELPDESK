const { sendClientNotification, sendAdminNotification } = require('./telegramBot');

/**
 * Форматирует и отправляет уведомление о новом тикете клиенту
 */
const notifyClientNewTicket = async (db, clientId, ticketId, ticketTitle) => {
  const message = `🎫 <b>Создан новый тикет</b>\n\n<b>${ticketTitle}</b>\n\nТикет #${ticketId} \n\nВы можете следить за обновлениями в панели https://obs-panel.ru`;
  return await sendClientNotification(db, clientId, message);
};

/**
 * Форматирует и отправляет уведомление о новом сообщении в тикете клиенту
 */
const notifyClientTicketMessage = async (db, clientId, ticketId, ticketTitle, senderName, message) => {
  const text = `💬 <b>Новое сообщение в тикете</b>\n\n<b>${ticketTitle}</b>\n\n<b>От:</b> ${senderName}\n<b>Сообщение:</b>\n${message.substring(0, 200)}${message.length > 200 ? '...' : ''}\n\nТикет #${ticketId}`;
  return await sendClientNotification(db, clientId, text);
};

/**
 * Форматирует и отправляет уведомление об изменении статуса тикета клиенту
 */
const notifyClientTicketStatusChange = async (db, clientId, ticketId, ticketTitle, newStatus) => {
  const statusText = {
    'open': 'Открыт',
    'in_progress': 'В работе',
    'resolved': 'Решен',
    'closed': 'Закрыт'
  }[newStatus] || newStatus;

  const message = `📋 <b>Изменение статуса тикета</b>\n\n<b>${ticketTitle}</b>\n\n<b>Новый статус:</b> ${statusText}\n\nТикет #${ticketId}`;
  return await sendClientNotification(db, clientId, message);
};

/**
 * Форматирует и отправляет уведомление о новом счете клиенту
 */
const notifyClientNewInvoice = async (db, clientId, invoiceId, amount, date) => {
  const message = `💰 <b>Новый счет на оплату</b>\n\n<b>Сумма:</b> ${amount.toLocaleString('ru-RU')} ₽\n<b>Дата:</b> ${new Date(date).toLocaleDateString('ru-RU')}\n\nСчет #${invoiceId} \n\nВы можете просмотреть и скачать по ссылке https://obs-panel.ru`;
  return await sendClientNotification(db, clientId, message);
};

/**
 * Форматирует и отправляет уведомление администратору о новом тикете
 */
const notifyAdminNewTicket = async (db, userId, clientName, ticketId, ticketTitle, ticketDescription) => {
  const message = `🎫 <b>Новый тикет от клиента</b>\n\n<b>Клиент:</b> ${clientName}\n<b>Название:</b> ${ticketTitle}\n\n<b>Описание:</b>\n${ticketDescription.substring(0, 200)}${ticketDescription.length > 200 ? '...' : ''}\n\nТикет #${ticketId}`;
  return await sendAdminNotification(db, userId, message);
};

/**
 * Форматирует и отправляет уведомление администратору о новом сообщении в тикете
 */
const notifyAdminTicketMessage = async (db, userId, clientName, ticketId, ticketTitle, senderName, message) => {
  const text = `💬 <b>Новое сообщение в тикете от клиента</b>\n\n<b>Клиент:</b> ${clientName}\n<b>Тикет:</b> ${ticketTitle}\n<b>От:</b> ${senderName}\n\n<b>Сообщение:</b>\n${message.substring(0, 200)}${message.length > 200 ? '...' : ''}\n\nТикет #${ticketId}`;
  return await sendAdminNotification(db, userId, text);
};

module.exports = {
  notifyClientNewTicket,
  notifyClientTicketMessage,
  notifyClientTicketStatusChange,
  notifyClientNewInvoice,
  notifyAdminNewTicket,
  notifyAdminTicketMessage
};
