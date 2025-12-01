const { sendClientNotification, sendAdminNotification } = require('./telegramBot');
const { sendClientEmail } = require('./emailSender');
const templates = require('./emailTemplates');

/**
 * Форматирует и отправляет уведомление о новом тикете клиенту
 */
const notifyClientNewTicket = async (db, clientId, ticketId, ticketTitle) => {
  const message = `🎫 <b>Создан новый тикет</b>\n\n<b>${ticketTitle}</b>\n\nТикет #${ticketId} \n\nВы можете следить за обновлениями в панели https://obs-panel.ru`;
  try {
    await sendClientNotification(db, clientId, message);
  } catch (e) {
    console.error('Telegram send error (new ticket):', e);
  }

  // Email
  try {
    const tpl = templates.newTicketTemplate({ ticketTitle, ticketId });
    await sendClientEmail(db, clientId, 'new_ticket', tpl.subject, tpl.text, tpl.html, { ticketTitle, ticketId });
  } catch (e) {
    console.error('Email send error (new ticket):', e);
  }

  // Добавляем внутриплатформенное уведомление
  try {
    db.run(
      `INSERT INTO notifications (recipient_type, recipient_id, type, title, message, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['client', clientId, 'new_ticket', 'Создан новый тикет', ticketTitle, 'ticket', ticketId]
    );
  } catch (e) {
    console.error('DB insert notification (new ticket) error:', e);
  }
  return;
};

/**
 * Форматирует и отправляет уведомление о новом сообщении в тикете клиенту
 */
const notifyClientTicketMessage = async (db, clientId, ticketId, ticketTitle, senderName, message) => {
  const text = `💬 <b>Новое сообщение в тикете</b>\n\n<b>${ticketTitle}</b>\n\n<b>От:</b> ${senderName}\n<b>Сообщение:</b>\n${message.substring(0, 200)}${message.length > 200 ? '...' : ''}\n\nТикет #${ticketId}`;
  try {
    await sendClientNotification(db, clientId, text);
  } catch (e) {
    console.error('Telegram send error (ticket message):', e);
  }

  // Email
  try {
    const tpl = templates.ticketMessageTemplate({ ticketTitle, ticketId, senderName, message });
    await sendClientEmail(db, clientId, 'ticket_message', tpl.subject, tpl.text, tpl.html, { ticketTitle, ticketId, senderName, message });
  } catch (e) {
    console.error('Email send error (ticket message):', e);
  }

  try {
    db.run(
      `INSERT INTO notifications (recipient_type, recipient_id, type, title, message, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['client', clientId, 'ticket_message', `Новое сообщение в тикете: ${ticketTitle}`, `${senderName}: ${message.substring(0,200)}`, 'ticket', ticketId]
    );
  } catch (e) {
    console.error('DB insert notification (ticket message) error:', e);
  }
  return;
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
  try {
    await sendClientNotification(db, clientId, message);
  } catch (e) {
    console.error('Telegram send error (ticket status):', e);
  }

  // Email
  try {
    const tpl = templates.ticketStatusTemplate({ ticketTitle, ticketId, statusText });
    await sendClientEmail(db, clientId, 'ticket_status', tpl.subject, tpl.text, tpl.html, { ticketTitle, ticketId, statusText });
  } catch (e) {
    console.error('Email send error (ticket status):', e);
  }

  try {
    db.run(
      `INSERT INTO notifications (recipient_type, recipient_id, type, title, message, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['client', clientId, 'ticket_status', `Статус тикета: ${ticketTitle}`, `Новый статус: ${statusText}`, 'ticket', ticketId]
    );
  } catch (e) {
    console.error('DB insert notification (ticket status) error:', e);
  }
  return;
};

/**
 * Форматирует и отправляет уведомление о новом счете клиенту
 */
const notifyClientNewInvoice = async (db, clientId, invoiceId, amount, date) => {
  let invoiceRow = null;
  try {
    invoiceRow = await new Promise((res, rej) => {
      db.get('SELECT * FROM invoices WHERE id = ?', [invoiceId], (err, row) => {
        if (err) return rej(err);
        res(row);
      });
    });
  } catch (e) {
    console.error('Error fetching invoice row for notification:', e);
  }

  const formattedAmount = amount ? amount.toLocaleString('ru-RU') + ' ₽' : '';
  const formattedDate = date ? new Date(date).toLocaleDateString('ru-RU') : '';
  const comment = invoiceRow && invoiceRow.comment ? invoiceRow.comment : '';

  const message = `Здравствуйте.\n\nВам выставлен новый счет на сумму ${formattedAmount} от ${formattedDate}.\n\nКомментарий к счету: ${comment}.\n\nВы можете просмотреть выставленные счета и их статусы по ссылке https://obs-panel.ru`;
  try {
    const options = {};
    if (invoiceRow && invoiceRow.file_path) {
      options.documentPath = invoiceRow.file_path;
      // try to set filename if available
      try {
        const path = require('path');
        options.filename = path.basename(invoiceRow.file_path);
      } catch (e) {}
    }
    await sendClientNotification(db, clientId, message, options);
  } catch (e) {
    console.error('Telegram send error (new invoice):', e);
  }

  // Email
  try {
    const tpl = templates.newInvoiceTemplate({ invoiceId, amount, date, comment });
    await sendClientEmail(db, clientId, 'new_invoice', tpl.subject, tpl.text, tpl.html, { invoiceId, amount, date, comment });
  } catch (e) {
    console.error('Email send error (new invoice):', e);
  }

  try {
    db.run(
      `INSERT INTO notifications (recipient_type, recipient_id, type, title, message, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['client', clientId, 'new_invoice', 'Новый счет на оплату', `Сумма: ${formattedAmount}`, 'invoice', invoiceId]
    );
  } catch (e) {
    console.error('DB insert notification (new invoice) error:', e);
  }
  return;
};

/**
 * Уведомление о новой рекомендации
 */
const notifyClientNewRecommendation = async (db, clientId, recommendationId, title, description) => {
  const message = `💡 <b>Новая рекомендация</b>\n\n<b>${title}</b>\n\n${(description||'').substring(0,200)}\n\nПерейдите в панель, чтобы посмотреть подробности.`;
  try {
    await sendClientNotification(db, clientId, message);
  } catch (e) {
    console.error('Telegram send error (new recommendation):', e);
  }

  // Email
  try {
    const tpl = templates.newRecommendationTemplate({ title, description, recommendationId });
    await sendClientEmail(db, clientId, 'new_recommendation', tpl.subject, tpl.text, tpl.html, { title, description, recommendationId });
  } catch (e) {
    console.error('Email send error (new recommendation):', e);
  }

  try {
    db.run(
      `INSERT INTO notifications (recipient_type, recipient_id, type, title, message, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['client', clientId, 'new_recommendation', `Новая рекомендация: ${title}`, (description||'').substring(0,200), 'recommendation', recommendationId]
    );
  } catch (e) {
    console.error('DB insert notification (new recommendation) error:', e);
  }
  return;
};

/**
 * Форматирует и отправляет уведомление администратору о новом тикете
 */
const notifyAdminNewTicket = async (db, userId, clientName, ticketId, ticketTitle, ticketDescription) => {
  const message = `🎫 <b>Новый тикет от клиента</b>\n\n<b>Клиент:</b> ${clientName}\n<b>Название:</b> ${ticketTitle}\n\n<b>Описание:</b>\n${ticketDescription.substring(0, 200)}${ticketDescription.length > 200 ? '...' : ''}\n\nТикет #${ticketId}`;
  try {
    await sendAdminNotification(db, userId, message);
  } catch (e) {
    console.error('Telegram send error (admin new ticket):', e);
  }

  // Внутриплатформенное уведомление для администратора
  try {
    db.run(
      `INSERT INTO notifications (recipient_type, recipient_id, type, title, message, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['user', userId, 'new_ticket', `Новый тикет от ${clientName}`, ticketTitle, 'ticket', ticketId]
    );
  } catch (e) {
    console.error('DB insert notification (admin new ticket) error:', e);
  }

  return;
};

/**
 * Форматирует и отправляет уведомление администратору о новом сообщении в тикете
 */
const notifyAdminTicketMessage = async (db, userId, clientName, ticketId, ticketTitle, senderName, message) => {
  const text = `💬 <b>Новое сообщение в тикете от клиента</b>\n\n<b>Клиент:</b> ${clientName}\n<b>Тикет:</b> ${ticketTitle}\n<b>От:</b> ${senderName}\n\n<b>Сообщение:</b>\n${message.substring(0, 200)}${message.length > 200 ? '...' : ''}\n\nТикет #${ticketId}`;
  try {
    await sendAdminNotification(db, userId, text);
  } catch (e) {
    console.error('Telegram send error (admin ticket message):', e);
  }

  // Внутриплатформенное уведомление для администратора
  try {
    db.run(
      `INSERT INTO notifications (recipient_type, recipient_id, type, title, message, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['user', userId, 'ticket_message', `Новое сообщение в тикете: ${ticketTitle}`, `${senderName}: ${message.substring(0,200)}`, 'ticket', ticketId]
    );
  } catch (e) {
    console.error('DB insert notification (admin ticket message) error:', e);
  }

  return;
};

module.exports = {
  notifyClientNewTicket,
  notifyClientTicketMessage,
  notifyClientTicketStatusChange,
  notifyClientNewInvoice,
  notifyClientNewRecommendation,
  notifyAdminNewTicket,
  notifyAdminTicketMessage
};
