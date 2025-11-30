const express = require('express');
const { authenticateToken } = require('./auth');

const router = express.Router();

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

module.exports = router;
