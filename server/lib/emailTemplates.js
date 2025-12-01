const APP_NAME = 'Обсидиан';
const APP_URL = 'https://obs-panel.ru';

const baseStyles = `
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial; background:#f7fafc; color:#1f2937; }
  .container { max-width:600px; margin:24px auto; background:white; border-radius:8px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.06); }
  .header { background:#2563eb; color:white; padding:18px; font-size:18px; }
  .content { padding:20px; font-size:15px; line-height:1.5; }
  .footer { padding:14px 20px; font-size:13px; color:#6b7280; background:#f8fafc; }
  .btn { display:inline-block; padding:10px 14px; background:#2563eb; color:white; border-radius:6px; text-decoration:none; }
`;

function wrapHtml(title, bodyHtml) {
  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <style>${baseStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header">${APP_NAME}</div>
        <div class="content">
          <h2 style="margin-top:0">${title}</h2>
          ${bodyHtml}
        </div>
        <div class="footer">
          Это уведомление от <strong>${APP_NAME}</strong>. Просмотреть панель: <a href="${APP_URL}">${APP_URL}</a>.<br/>
          Пожалуйста, не отвечайте на это письмо — оно отправлено с адреса только для уведомлений.
        </div>
      </div>
    </body>
  </html>`;
}

function newTicketTemplate({ ticketTitle, ticketId }) {
  const subject = `Создан новый тикет: ${ticketTitle}`;
  const text = `Создан новый тикет: ${ticketTitle}\nТикет #${ticketId}\nПерейдите в панель: ${APP_URL}`;
  const html = wrapHtml(subject, `
    <p>Здравствуйте!</p>
    <p>Благодарим — создан новый тикет: <strong>${ticketTitle}</strong>.</p>
    <p>Номер тикета: <strong>#${ticketId}</strong></p>
    <p><a class="btn" href="${APP_URL}/client/tickets/${ticketId}">Открыть тикет</a></p>
  `);
  return { subject, text, html };
}

function ticketMessageTemplate({ ticketTitle, ticketId, senderName, message }) {
  const subject = `Новое сообщение в тикете: ${ticketTitle}`;
  const text = `Новое сообщение в тикете ${ticketTitle}\nОт: ${senderName}\n${message}\nТикет #${ticketId}`;
  const html = wrapHtml(subject, `
    <p>Здравствуйте!</p>
    <p>В тикете <strong>${ticketTitle}</strong> появилось новое сообщение от <strong>${senderName}</strong>:</p>
    <blockquote style="background:#f3f4f6;padding:10px;border-left:4px solid #e5e7eb">${escapeHtml(message)}</blockquote>
    <p><a class="btn" href="${APP_URL}/client/tickets/${ticketId}">Перейти к тикету</a></p>
  `);
  return { subject, text, html };
}

function ticketStatusTemplate({ ticketTitle, ticketId, statusText }) {
  const subject = `Статус тикета обновлён: ${ticketTitle}`;
  const text = `Тикет: ${ticketTitle}\nНовый статус: ${statusText}\nТикет #${ticketId}`;
  const html = wrapHtml(subject, `
    <p>Здравствуйте!</p>
    <p>Статус тикета <strong>${ticketTitle}</strong> изменён на <strong>${statusText}</strong>.</p>
    <p><a class="btn" href="${APP_URL}/client/tickets/${ticketId}">Посмотреть тикет</a></p>
  `);
  return { subject, text, html };
}

function newInvoiceTemplate({ invoiceId, amount, date, comment }) {
  const subject = `Вам выставлен новый счет от Обсидиан.`;
  const formattedDate = date ? new Date(date).toLocaleDateString('ru-RU') : '';
  const amountStr = amount ? amount.toLocaleString('ru-RU') + ' ₽' : '';
  const safeComment = escapeHtml(comment || '—');

  const text = `Здравствуйте. Вам выставлен новый счет на сумму ${amountStr} от ${formattedDate}. Комментарий к счету: ${comment || 'нет'}. Счет находится во вложениях к письму.\n\nВы также можете посмотреть список выставленных счетов и их статусы в панели управления: ${APP_URL}/client/invoices`;

  const html = wrapHtml(subject, `
    <p>Здравствуйте.</p>
    <p>Вам выставлен новый счет на сумму <strong>${amountStr}</strong> от <strong>${formattedDate}</strong>.</p>
    <p><strong>Комментарий к счету:</strong> ${safeComment}</p>
    <p>Счет находится во вложениях к письму.</p>
    <p>Вы также можете посмотреть список выставленных счетов и их статусы в панели управления.</p>
    <p><a class="btn" href="${APP_URL}/client/invoices">Перейти</a></p>
  `);
  return { subject, text, html };
}

function newRecommendationTemplate({ title, description, recommendationId }) {
  const subject = `Новая рекомендация: ${title}`;
  const text = `Новая рекомендация: ${title}\n${(description||'').substring(0,200)}`;
  const html = wrapHtml(subject, `
    <p>Здравствуйте!</p>
    <p>Добавлена новая рекомендация: <strong>${title}</strong></p>
    <p>${escapeHtml((description||'').substring(0,400))}</p>
    <p><a class="btn" href="${APP_URL}/client/recommendations/${recommendationId}">Посмотреть рекомендацию</a></p>
  `);
  return { subject, text, html };
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

module.exports = {
  newTicketTemplate,
  ticketMessageTemplate,
  ticketStatusTemplate,
  newInvoiceTemplate,
  newRecommendationTemplate
};
