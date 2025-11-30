const express = require('express');
const { authenticateToken } = require('./auth');

const router = express.Router();
const { sendEmail } = require('../lib/emailSender');

// Получить уведомления для текущего пользователя (client -> client notifications, staff -> user notifications)
router.get('/', authenticateToken, (req, res) => {
  const db = req.db;
  const userRole = req.user.role;
  const recipientType = userRole === 'client' ? 'client' : 'user';
  const recipientId = req.user.id;

  db.all(
    `SELECT id, type, title, message, reference_type, reference_id, read, created_at
     FROM notifications
     WHERE recipient_type = ? AND recipient_id = ?
     ORDER BY created_at DESC
     LIMIT 100`,
    [recipientType, recipientId],
    (err, rows) => {
      if (err) {
        console.error('Ошибка при получении уведомлений:', err);
        return res.status(500).json({ error: 'Ошибка при получении уведомлений' });
      }
      res.json(rows || []);
    }
  );
});

// Пометить уведомление как прочитанное
router.put('/:id/read', authenticateToken, (req, res) => {
  const db = req.db;
  const { id } = req.params;
  const userRole = req.user.role;
  const recipientType = userRole === 'client' ? 'client' : 'user';
  const recipientId = req.user.id;

  db.run(
    `UPDATE notifications SET read = 1 WHERE id = ? AND recipient_type = ? AND recipient_id = ?`,
    [id, recipientType, recipientId],
    function(err) {
      if (err) {
        console.error('Ошибка при пометке уведомления как прочитанного:', err);
        return res.status(500).json({ error: 'Ошибка при обновлении уведомления' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Уведомление не найдено' });
      }
      res.json({ message: 'Помечено как прочитанное' });
    }
  );
});

// Пометить все уведомления пользователя как прочитанные
router.put('/read-all', authenticateToken, (req, res) => {
  const db = req.db;
  const userRole = req.user.role;
  const recipientType = userRole === 'client' ? 'client' : 'user';
  const recipientId = req.user.id;

  db.run(
    `UPDATE notifications SET read = 1 WHERE recipient_type = ? AND recipient_id = ?`,
    [recipientType, recipientId],
    function(err) {
      if (err) {
        console.error('Ошибка при пометке всех уведомлений как прочитанных:', err);
        return res.status(500).json({ error: 'Ошибка при обновлении уведомлений' });
      }
      res.json({ message: 'Все уведомления помечены как прочитанные' });
    }
  );
});

// ----- Email notification setup for clients -----

// Получить email настройки клиента
router.get('/email', authenticateToken, (req, res) => {
  if (req.user.role !== 'client') return res.status(403).json({ error: 'Недостаточно прав' });
  const db = req.db;
  const clientId = req.user.id;

  db.get('SELECT email, verified, enabled, preferences FROM client_email WHERE client_id = ?', [clientId], (err, row) => {
    if (err) return res.status(500).json({ error: 'Ошибка при получении настроек' });
    if (!row) return res.json({ email: null, verified: false, enabled: false, preferences: null });
    let prefs = null;
    try { prefs = row.preferences ? JSON.parse(row.preferences) : null; } catch (e) { prefs = null; }
    res.json({ email: row.email, verified: !!row.verified, enabled: !!row.enabled, preferences: prefs });
  });
});

// Запрос подтверждения на email (отправляет код)
router.post('/email/request', authenticateToken, async (req, res) => {
  if (req.user.role !== 'client') return res.status(403).json({ error: 'Недостаточно прав' });
  const db = req.db;
  const clientId = req.user.id;
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Не указан email' });

  const code = Math.floor(100000 + Math.random() * 900000).toString();

  db.get('SELECT * FROM client_email WHERE client_id = ?', [clientId], (err, existing) => {
    if (err) return res.status(500).json({ error: 'Ошибка сервера' });
    const now = new Date().toISOString();
    if (existing) {
      db.run('UPDATE client_email SET email = ?, verification_code = ?, verified = 0, enabled = 1, updated_at = ? WHERE client_id = ?', [email, code, now, clientId], function(uErr) {
        if (uErr) return res.status(500).json({ error: 'Ошибка при обновлении' });
        // send email
        sendEmail(email, 'Код подтверждения email', `Ваш код подтверждения: ${code}`)
          .then(() => res.json({ message: 'Код отправлен' }))
          .catch((e) => {
            console.error('Email send error:', e);
            res.status(500).json({ error: 'Не удалось отправить email' });
          });
      });
    } else {
      db.run('INSERT INTO client_email (client_id, email, verification_code, verified, enabled, created_at, updated_at) VALUES (?, ?, ?, 0, 1, ?, ?)', [clientId, email, code, now, now], function(iErr) {
        if (iErr) return res.status(500).json({ error: 'Ошибка при сохранении' });
        sendEmail(email, 'Код подтверждения email', `Ваш код подтверждения: ${code}`)
          .then(() => res.json({ message: 'Код отправлен' }))
          .catch((e) => {
            console.error('Email send error:', e);
            res.status(500).json({ error: 'Не удалось отправить email' });
          });
      });
    }
  });
});

// Подтвердить код
router.post('/email/verify', authenticateToken, (req, res) => {
  if (req.user.role !== 'client') return res.status(403).json({ error: 'Недостаточно прав' });
  const db = req.db;
  const clientId = req.user.id;
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Код не указан' });

  db.get('SELECT verification_code FROM client_email WHERE client_id = ?', [clientId], (err, row) => {
    if (err) return res.status(500).json({ error: 'Ошибка сервера' });
    if (!row || !row.verification_code) return res.status(400).json({ error: 'Код не запрошен' });
    if (row.verification_code !== code.toString()) return res.status(400).json({ error: 'Неверный код' });

    db.run('UPDATE client_email SET verified = 1, verification_code = NULL, updated_at = CURRENT_TIMESTAMP WHERE client_id = ?', [clientId], function(uErr) {
      if (uErr) return res.status(500).json({ error: 'Ошибка при обновлении' });
      res.json({ message: 'Email подтверждён' });
    });
  });
});

// Отвязать email (удалить привязку)
router.post('/email/unbind', authenticateToken, (req, res) => {
  if (req.user.role !== 'client') return res.status(403).json({ error: 'Недостаточно прав' });
  const db = req.db;
  const clientId = req.user.id;

  db.get('SELECT id FROM client_email WHERE client_id = ?', [clientId], (err, row) => {
    if (err) return res.status(500).json({ error: 'Ошибка сервера' });
    if (!row) return res.status(404).json({ error: 'Email не найден' });

    db.run('UPDATE client_email SET email = NULL, verified = 0, verification_code = NULL, enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE client_id = ?', [clientId], function(uErr) {
      if (uErr) return res.status(500).json({ error: 'Ошибка при отвязке email' });
      res.json({ message: 'Email успешно отвязан' });
    });
  });
});

// Обновить предпочтения уведомлений (preferences как объект)
router.put('/preferences', authenticateToken, (req, res) => {
  if (req.user.role !== 'client') return res.status(403).json({ error: 'Недостаточно прав' });
  const db = req.db;
  const clientId = req.user.id;
  const { preferences, enabled } = req.body;
  if (!preferences || typeof preferences !== 'object') return res.status(400).json({ error: 'Неправильный формат preferences' });

  const prefsStr = JSON.stringify(preferences);

  db.get('SELECT id FROM client_email WHERE client_id = ?', [clientId], (err, row) => {
    if (err) return res.status(500).json({ error: 'Ошибка сервера' });
    if (!row) {
      const now = new Date().toISOString();
      db.run('INSERT INTO client_email (client_id, preferences, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [clientId, prefsStr, enabled ? 1 : 0, now, now], function(iErr) {
        if (iErr) return res.status(500).json({ error: 'Ошибка при сохранении' });
        res.json({ message: 'Настройки сохранены' });
      });
    } else {
      db.run('UPDATE client_email SET preferences = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE client_id = ?', [prefsStr, enabled ? 1 : 0, clientId], function(uErr) {
        if (uErr) return res.status(500).json({ error: 'Ошибка при обновлении' });
        res.json({ message: 'Настройки обновлены' });
      });
    }
  });
});

module.exports = router;

