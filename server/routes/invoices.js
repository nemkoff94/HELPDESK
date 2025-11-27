const express = require('express');
const path = require('path');
const fs = require('fs');
const { authenticateToken, requireRole, upload } = require('./auth');
const { generateInvoicePdfBuffer } = require('../pdfGenerator');
const { notifyClientNewInvoice } = require('../lib/telegramNotifications');

const router = express.Router();

// Получить все счета
router.get('/', authenticateToken, (req, res) => {
  const userRole = req.user.role;
  const db = req.db;
  let query;
  let params = [];

  if (userRole === 'client') {
    query = `
      SELECT i.*, c.project_name
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      WHERE i.client_id = ?
      ORDER BY i.date DESC
    `;
    params = [req.user.id];
  } else {
    query = `
      SELECT i.*, c.project_name
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      ORDER BY i.date DESC
    `;
  }

  db.all(query, params, (err, invoices) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка при получении счетов' });
    }
    res.json(invoices);
  });
});

// Получить счета клиента
router.get('/client/:clientId', authenticateToken, (req, res) => {
  const { clientId } = req.params;
  const userRole = req.user.role;
  const db = req.db;

  if (userRole === 'client' && parseInt(clientId) !== req.user.id) {
    return res.status(403).json({ error: 'Недостаточно прав' });
  }

  db.all(
    'SELECT * FROM invoices WHERE client_id = ? ORDER BY date DESC',
    [clientId],
    (err, invoices) => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка при получении счетов' });
      }
      res.json(invoices);
    }
  );
});

// Генерация PDF счета
router.post('/generate-pdf', authenticateToken, requireRole('admin'), async (req, res) => {
  const { client_id, amount, service_name } = req.body;
  const db = req.db;

  if (!client_id || !amount || !service_name) {
    return res.status(400).json({ error: 'Необходимо указать client_id, amount и service_name' });
  }

  db.get('SELECT * FROM clients WHERE id = ?', [client_id], async (err, client) => {
    if (err) return res.status(500).json({ error: 'Ошибка сервера' });
    if (!client) return res.status(404).json({ error: 'Клиент не найден' });

    try {
      const recipient = 'НЕМКОВА СОФИЯ СЕРГЕЕВНА (ИП)';
      const recipientInn = '401110194908';
      const account = '40802810001480000058';
      const bankName = 'АО "АЛЬФА-БАНК"';
      const bic = '044525593';
      const corrAccount = '30101810200000000593';
      const legalAddress = 'Калужская область, г. Малоярославец';

      const payerName = client.legal_name || client.project_name || '';
      const payerAddress = client.legal_address || '';
      const payerInn = client.inn || '';
      const payerOgrn = client.ogrn || '';

      const invoiceDate = new Date().toISOString().split('T')[0];
      const invoiceNumber = `QR-${Date.now()}`;

      const pdfBuffer = await generateInvoicePdfBuffer({
        recipient,
        recipientInn,
        bankName,
        bic,
        corrAccount,
        account,
        amount,
        serviceName: service_name,
        invoiceDate,
        invoiceNumber,
        legalAddress,
        payerName,
        payerInn,
        payerAddress,
        payerOgrn
      });

      const base64 = pdfBuffer.toString('base64');
      res.json({ pdf_base64: base64, filename: `invoice-${invoiceNumber}.pdf` });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Ошибка при генерации PDF' });
    }
  });
});

// Создать счет
router.post('/', authenticateToken, requireRole('admin'), upload.single('file'), async (req, res) => {
  const { client_id, amount, date, comment } = req.body;
  const filePath = req.file ? `/uploads/invoices/${req.file.filename}` : null;
  const db = req.db;

  db.run(
    `INSERT INTO invoices (client_id, amount, date, comment, file_path, status)
     VALUES (?, ?, ?, ?, ?, 'unpaid')`,
    [client_id, amount, date, comment || null, filePath],
    async function(err) {
      if (err) {
        return res.status(500).json({ error: 'Ошибка при создании счета' });
      }

      const invoiceId = this.lastID;

      // Отправляем уведомление клиенту
      try {
        await notifyClientNewInvoice(db, client_id, invoiceId, amount, date);
      } catch (error) {
        console.error('Ошибка при отправке уведомления о счете:', error);
      }

      res.json({
        id: invoiceId,
        client_id,
        amount,
        date,
        comment,
        file_path: filePath,
        status: 'unpaid'
      });
    }
  );
});

// Обновить статус счета
router.put('/:id/status', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const db = req.db;

  db.run(
    'UPDATE invoices SET status = ? WHERE id = ?',
    [status, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Ошибка при обновлении счета' });
      }
      res.json({ message: 'Статус счета обновлен' });
    }
  );
});

// Удалить счет
router.delete('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const db = req.db;

  db.get('SELECT * FROM invoices WHERE id = ?', [id], (err, invoice) => {
    if (err) return res.status(500).json({ error: 'Ошибка сервера' });
    if (!invoice) return res.status(404).json({ error: 'Счет не найден' });

    db.run('DELETE FROM invoices WHERE id = ?', [id], function(deleteErr) {
      if (deleteErr) return res.status(500).json({ error: 'Ошибка при удалении счета' });

      if (invoice.file_path) {
        const rel = invoice.file_path.startsWith('/') ? invoice.file_path.slice(1) : invoice.file_path;
        const fullPath = path.join(__dirname, '..', rel);
        fs.unlink(fullPath, (fsErr) => {
          if (fsErr) {
            console.warn('Failed to unlink invoice file:', fullPath, fsErr);
          }
          return res.json({ message: 'Счет удален' });
        });
      } else {
        return res.json({ message: 'Счет удален' });
      }
    });
  });
});

// Получить сумму задолженности
router.get('/debt/:clientId', authenticateToken, (req, res) => {
  const { clientId } = req.params;
  const userRole = req.user.role;
  const db = req.db;

  if (userRole === 'client' && parseInt(clientId) !== req.user.id) {
    return res.status(403).json({ error: 'Недостаточно прав' });
  }

  db.get(
    `SELECT COALESCE(SUM(amount), 0) as total_debt
     FROM invoices
     WHERE client_id = ? AND status = 'unpaid'`,
    [clientId],
    (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка при расчете задолженности' });
      }
      res.json({ total_debt: result.total_debt });
    }
  );
});

module.exports = router;
