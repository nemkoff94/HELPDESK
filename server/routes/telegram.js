const express = require('express');
const { authenticateToken, requireRole } = require('./auth');
const {
  generateConnectionToken,
  generateQRCode,
  sendClientNotification,
  sendAdminNotification
} = require('../lib/telegramBot');

const router = express.Router();

const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'your_bot_username';
const APP_URL = process.env.APP_URL || 'http://localhost:5001';

// ========== CLIENT TELEGRAM ROUTES ==========

/**
 * Генерирует токен подключения и QR код для клиента
 */
router.post('/telegram/client/generate-link', authenticateToken, async (req, res) => {
  const db = req.db;
  const clientId = req.user.id;

  try {
    // Проверяем, существует ли запись для этого клиента
    const existing = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM client_telegram WHERE client_id = ?',
        [clientId],
        (err, row) => {
          if (err) reject(err);
          resolve(row);
        }
      );
    });

    let connectionToken = existing?.connection_token;

    // Если записи нет, создаем новую
    if (!existing) {
      connectionToken = generateConnectionToken();
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO client_telegram (client_id, connection_token, enabled)
           VALUES (?, ?, 0)`,
          [clientId, connectionToken],
          (err) => {
            if (err) reject(err);
            resolve();
          }
        );
      });
    }

    // Генерируем ссылку и QR код
    const deepLink = `https://t.me/${BOT_USERNAME}?start=${connectionToken}`;
    const qrCode = await generateQRCode(deepLink);

    res.json({
      deepLink,
      qrCode,
      botUsername: BOT_USERNAME
    });
  } catch (error) {
    console.error('Ошибка при генерации ссылки:', error);
    res.status(500).json({ error: 'Ошибка при генерации ссылки' });
  }
});

/**
 * Получает статус Telegram подключения клиента
 */
router.get('/telegram/client/status', authenticateToken, (req, res) => {
  const db = req.db;
  const clientId = req.user.id;

  db.get(
    'SELECT id, enabled, telegram_username FROM client_telegram WHERE client_id = ?',
    [clientId],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка сервера' });
      }

      if (!row) {
        return res.json({
          connected: false,
          enabled: false
        });
      }

      res.json({
        connected: row.enabled === 1,
        enabled: row.enabled === 1,
        username: row.telegram_username
      });
    }
  );
});

/**
 * Отключает Telegram уведомления для клиента
 */
router.post('/telegram/client/disconnect', authenticateToken, (req, res) => {
  const db = req.db;
  const clientId = req.user.id;

  db.run(
    'UPDATE client_telegram SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE client_id = ?',
    [clientId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Ошибка при отключении' });
      }

      res.json({ message: 'Уведомления отключены' });
    }
  );
});

// ========== ADMIN/SPECIALIST TELEGRAM ROUTES ==========

/**
 * Генерирует токен подключения и QR код для администратора/специалиста
 */
router.post('/telegram/user/generate-link', authenticateToken, async (req, res) => {
  const db = req.db;
  const userId = req.user.id;

  try {
    // Проверяем, существует ли запись для этого пользователя
    const existing = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM user_telegram WHERE user_id = ?',
        [userId],
        (err, row) => {
          if (err) reject(err);
          resolve(row);
        }
      );
    });

    let connectionToken = existing?.connection_token;

    // Если записи нет, создаем новую
    if (!existing) {
      connectionToken = generateConnectionToken();
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO user_telegram (user_id, connection_token, enabled)
           VALUES (?, ?, 0)`,
          [userId, connectionToken],
          (err) => {
            if (err) reject(err);
            resolve();
          }
        );
      });
    }

    // Генерируем ссылку и QR код
    const deepLink = `https://t.me/${BOT_USERNAME}?start=${connectionToken}`;
    const qrCode = await generateQRCode(deepLink);

    res.json({
      deepLink,
      qrCode,
      botUsername: BOT_USERNAME
    });
  } catch (error) {
    console.error('Ошибка при генерации ссылки:', error);
    res.status(500).json({ error: 'Ошибка при генерации ссылки' });
  }
});

/**
 * Получает статус Telegram подключения администратора/специалиста
 */
router.get('/telegram/user/status', authenticateToken, (req, res) => {
  const db = req.db;
  const userId = req.user.id;

  db.get(
    'SELECT id, enabled, telegram_username FROM user_telegram WHERE user_id = ?',
    [userId],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка сервера' });
      }

      if (!row) {
        return res.json({
          connected: false,
          enabled: false
        });
      }

      res.json({
        connected: row.enabled === 1,
        enabled: row.enabled === 1,
        username: row.telegram_username
      });
    }
  );
});

/**
 * Отключает Telegram уведомления для администратора/специалиста
 */
router.post('/telegram/user/disconnect', authenticateToken, (req, res) => {
  const db = req.db;
  const userId = req.user.id;

  db.run(
    'UPDATE user_telegram SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
    [userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Ошибка при отключении' });
      }

      res.json({ message: 'Уведомления отключены' });
    }
  );
});

// ========== ADMIN ROUTES ==========

/**
 * Получает статус Telegram подключения клиента (для администратора)
 */
router.get('/telegram/client/:clientId/status', authenticateToken, requireRole('admin'), (req, res) => {
  const db = req.db;
  const { clientId } = req.params;

  db.get(
    'SELECT id, enabled, telegram_username FROM client_telegram WHERE client_id = ?',
    [clientId],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка сервера' });
      }

      if (!row) {
        return res.json({
          connected: false,
          enabled: false
        });
      }

      res.json({
        connected: row.enabled === 1,
        enabled: row.enabled === 1,
        username: row.telegram_username
      });
    }
  );
});

/**
 * Отправляет кастомное уведомление клиенту в Telegram
 */
router.post('/telegram/client/:clientId/send-message', authenticateToken, requireRole('admin'), async (req, res) => {
  const db = req.db;
  const { clientId } = req.params;
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Сообщение не может быть пустым' });
  }

  try {
    const result = await sendClientNotification(db, clientId, message);

    if (!result.success) {
      if (result.reason === 'not_connected') {
        return res.status(400).json({ error: 'Клиент не подключил Telegram' });
      }
      return res.status(500).json({ error: 'Ошибка при отправке' });
    }

    res.json({ message: 'Уведомление отправлено' });
  } catch (error) {
    console.error('Ошибка при отправке сообщения:', error);
    res.status(500).json({ error: 'Ошибка при отправке' });
  }
});

module.exports = router;
