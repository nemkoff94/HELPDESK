const nodemailer = require('nodemailer');
const templates = require('./emailTemplates');

// Настройки транспорта через env переменные. В проде задавайте реальные SMTP.
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

let transporter;
if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT, 10),
    secure: parseInt(SMTP_PORT, 10) === 465, // true for 465, false for other ports
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
} else {
  // Fallback: лог в консоль (для разработки)
  transporter = {
    sendMail: async (opts) => {
      console.log('--- Email (dev fallback) ---');
      console.log('From:', opts.from);
      console.log('To:', opts.to);
      console.log('Subject:', opts.subject);
      console.log('Text:', opts.text);
      console.log('HTML:', opts.html);
      console.log('---------------------------');
      return Promise.resolve();
    }
  };
}

const DEFAULT_FROM = process.env.EMAIL_FROM || 'noreply@obs-panel.ru';

async function sendEmail(to, subject, text, html) {
  if (!to) throw new Error('No recipient provided for email');
  const mailOptions = {
    from: DEFAULT_FROM,
    to,
    subject,
    text: text || undefined,
    html: html || undefined
  };
  return transporter.sendMail(mailOptions);
}

// helper: send email to client if preference allows; if no subject/html provided, use templates
async function sendClientEmail(db, clientId, notificationType, subject, text, html, templateData = {}) {
  return new Promise((resolve, reject) => {
    db.get('SELECT ce.email, ce.verified, ce.preferences FROM client_email ce WHERE ce.client_id = ?', [clientId], async (err, row) => {
      if (err) return reject(err);
      const recipient = row && row.email ? row.email : null;
      const verified = row && row.verified;
      const prefsRaw = row && row.preferences ? row.preferences : null;
      if (!recipient || !verified) return resolve(false);

      let prefs = {};
      try {
        prefs = prefsRaw ? JSON.parse(prefsRaw) : {};
      } catch (e) {
        prefs = {};
      }

      const eventPref = prefs[notificationType];
      // если не настроено явно, отправляем по умолчанию
      const shouldSend = eventPref ? !!eventPref.email : true;
      if (!shouldSend) return resolve(false);

      // If html not provided, try to build from templates
      try {
        let finalSubject = subject;
        let finalText = text;
        let finalHtml = html;
        if (!finalHtml) {
          // pick template by notificationType
          switch (notificationType) {
            case 'new_ticket':
              ({ subject: finalSubject, text: finalText, html: finalHtml } = templates.newTicketTemplate(templateData));
              break;
            case 'ticket_message':
              ({ subject: finalSubject, text: finalText, html: finalHtml } = templates.ticketMessageTemplate(templateData));
              break;
            case 'ticket_status':
              ({ subject: finalSubject, text: finalText, html: finalHtml } = templates.ticketStatusTemplate(templateData));
              break;
            case 'new_invoice':
              ({ subject: finalSubject, text: finalText, html: finalHtml } = templates.newInvoiceTemplate(templateData));
              break;
            case 'new_recommendation':
              ({ subject: finalSubject, text: finalText, html: finalHtml } = templates.newRecommendationTemplate(templateData));
              break;
            default:
              // leave provided subject/text/html
              break;
          }
        }

        await sendEmail(recipient, finalSubject, finalText, finalHtml);
        resolve(true);
      } catch (e) {
        console.error('Error sending client email:', e);
        reject(e);
      }
    });
  });
}

module.exports = {
  sendEmail,
  sendClientEmail
};
