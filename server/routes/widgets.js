const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const { authenticateToken, requireRole } = require('./auth');

const router = express.Router();

// ========== AD CAMPAIGN WIDGET ==========

router.get('/ad-campaign/:clientId', authenticateToken, (req, res) => {
  const { clientId } = req.params;
  const userRole = req.user.role;
  const db = req.db;

  if (userRole === 'client' && parseInt(clientId) !== req.user.id) {
    return res.status(403).json({ error: 'Недостаточно прав' });
  }

  db.get(
    'SELECT * FROM ad_campaign_widgets WHERE client_id = ?',
    [clientId],
    (err, widget) => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка при получении виджета' });
      }
      res.json(widget || null);
    }
  );
});

router.post('/ad-campaign/:clientId', authenticateToken, requireRole('admin'), (req, res) => {
  const { clientId } = req.params;
  const { enabled, monthly_budget, recommended_budget, status } = req.body;
  const db = req.db;

  if (monthly_budget === undefined || monthly_budget === null) {
    return res.status(400).json({ error: 'Необходимо указать monthly_budget' });
  }

  db.get(
    'SELECT * FROM ad_campaign_widgets WHERE client_id = ?',
    [clientId],
    (err, existingWidget) => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка сервера' });
      }

      if (existingWidget) {
        db.run(
          `UPDATE ad_campaign_widgets 
           SET enabled = ?, monthly_budget = ?, recommended_budget = ?, status = ?, updated_at = CURRENT_TIMESTAMP
           WHERE client_id = ?`,
          [enabled !== undefined ? enabled : existingWidget.enabled, monthly_budget, recommended_budget || null, status || existingWidget.status, clientId],
          function(err) {
            if (err) {
              return res.status(500).json({ error: 'Ошибка при обновлении виджета' });
            }
            res.json({ message: 'Виджет обновлен' });
          }
        );
      } else {
        db.run(
          `INSERT INTO ad_campaign_widgets (client_id, enabled, monthly_budget, recommended_budget, status)
           VALUES (?, ?, ?, ?, ?)`,
          [clientId, enabled !== undefined ? enabled : 1, monthly_budget, recommended_budget || null, status || 'active'],
          function(err) {
            if (err) {
              return res.status(500).json({ error: 'Ошибка при создании виджета' });
            }
            res.json({ id: this.lastID, message: 'Виджет создан' });
          }
        );
      }
    }
  );
});

// ========== RENEWAL CALENDAR WIDGET ==========

router.get('/renewal-calendar/:clientId', authenticateToken, (req, res) => {
  const { clientId } = req.params;
  const userRole = req.user.role;
  const db = req.db;

  if (userRole === 'client' && parseInt(clientId) !== req.user.id) {
    return res.status(403).json({ error: 'Недостаточно прав' });
  }

  db.get(
    'SELECT * FROM renewal_calendar_widgets WHERE client_id = ?',
    [clientId],
    (err, widget) => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка при получении виджета' });
      }
      if (!widget) return res.json(null);

      db.all(
        'SELECT id, title, date, created_at FROM renewal_custom_updates WHERE widget_id = ? ORDER BY date ASC',
        [widget.id],
        (err, customUpdates) => {
          if (err) {
            return res.status(500).json({ error: 'Ошибка при получении кастомных обновлений' });
          }

          const canCreate = req.user.role === 'admin';

          res.json({
            ...widget,
            custom_updates: customUpdates || [],
            can_create_custom_update: canCreate
          });
        }
      );
    }
  );
});

router.post('/renewal-calendar/:clientId', authenticateToken, requireRole('admin'), (req, res) => {
  const { clientId } = req.params;
  const { enabled, domain_renewal_date, hosting_renewal_date, ssl_renewal_date, ssl_auto_renewal } = req.body;
  const db = req.db;

  db.get(
    'SELECT * FROM renewal_calendar_widgets WHERE client_id = ?',
    [clientId],
    (err, existingWidget) => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка сервера' });
      }

      if (existingWidget) {
        db.run(
          `UPDATE renewal_calendar_widgets 
           SET enabled = ?, domain_renewal_date = ?, hosting_renewal_date = ?, ssl_renewal_date = ?, ssl_auto_renewal = ?, updated_at = CURRENT_TIMESTAMP
           WHERE client_id = ?`,
          [
            enabled !== undefined ? enabled : existingWidget.enabled,
            domain_renewal_date || null,
            hosting_renewal_date || null,
            ssl_renewal_date || null,
            ssl_auto_renewal !== undefined ? ssl_auto_renewal : existingWidget.ssl_auto_renewal,
            clientId
          ],
          function(err) {
            if (err) {
              return res.status(500).json({ error: 'Ошибка при обновлении виджета' });
            }
            res.json({ message: 'Виджет обновлен' });
          }
        );
      } else {
        db.run(
          `INSERT INTO renewal_calendar_widgets (client_id, enabled, domain_renewal_date, hosting_renewal_date, ssl_renewal_date, ssl_auto_renewal)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [clientId, enabled !== undefined ? enabled : 0, domain_renewal_date || null, hosting_renewal_date || null, ssl_renewal_date || null, ssl_auto_renewal !== undefined ? ssl_auto_renewal : 0],
          function(err) {
            if (err) {
              return res.status(500).json({ error: 'Ошибка при создании виджета' });
            }
            res.json({ id: this.lastID, message: 'Виджет создан' });
          }
        );
      }
    }
  );
});

router.post('/renewal-calendar/:clientId/custom-update', authenticateToken, requireRole('admin'), (req, res) => {
  const { clientId } = req.params;
  const { title, date } = req.body;
  const db = req.db;

  if (!title || !date) {
    return res.status(400).json({ error: 'Необходимо указать title и date' });
  }

  db.get('SELECT * FROM renewal_calendar_widgets WHERE client_id = ?', [clientId], (err, widget) => {
    if (err) return res.status(500).json({ error: 'Ошибка сервера' });
    if (!widget) return res.status(404).json({ error: 'Виджет календаря не найден' });

    db.run(
      `INSERT INTO renewal_custom_updates (widget_id, title, date) VALUES (?, ?, ?)`,
      [widget.id, title, date],
      function(err) {
        if (err) return res.status(500).json({ error: 'Ошибка при добавлении кастомного обновления' });
        res.json({ id: this.lastID, message: 'Кастомное обновление добавлено' });
      }
    );
  });
});

// ========== RECOMMENDATIONS WIDGET ==========

router.get('/recommendations/:clientId', authenticateToken, (req, res) => {
  const { clientId } = req.params;
  const userRole = req.user.role;
  const db = req.db;

  if (userRole === 'client' && parseInt(clientId) !== req.user.id) {
    return res.status(403).json({ error: 'Недостаточно прав' });
  }

  db.get(
    'SELECT * FROM recommendations_widgets WHERE client_id = ?',
    [clientId],
    (err, widget) => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка при получении виджета' });
      }
      if (!widget) {
        return res.json(null);
      }

      db.all(
        'SELECT * FROM recommendations WHERE widget_id = ? ORDER BY created_at DESC',
        [widget.id],
        (err, recommendations) => {
          if (err) {
            return res.status(500).json({ error: 'Ошибка при получении рекомендаций' });
          }
          res.json({
            ...widget,
            recommendations: recommendations || []
          });
        }
      );
    }
  );
});

router.post('/recommendations/:clientId', authenticateToken, requireRole('admin'), (req, res) => {
  const { clientId } = req.params;
  const { enabled } = req.body;
  const db = req.db;

  db.get(
    'SELECT * FROM recommendations_widgets WHERE client_id = ?',
    [clientId],
    (err, existingWidget) => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка сервера' });
      }

      if (existingWidget) {
        db.run(
          `UPDATE recommendations_widgets 
           SET enabled = ?, updated_at = CURRENT_TIMESTAMP
           WHERE client_id = ?`,
          [enabled !== undefined ? enabled : existingWidget.enabled, clientId],
          function(err) {
            if (err) {
              return res.status(500).json({ error: 'Ошибка при обновлении виджета' });
            }
            res.json({ message: 'Виджет обновлен' });
          }
        );
      } else {
        db.run(
          `INSERT INTO recommendations_widgets (client_id, enabled)
           VALUES (?, ?)`,
          [clientId, enabled !== undefined ? enabled : 0],
          function(err) {
            if (err) {
              return res.status(500).json({ error: 'Ошибка при создании виджета' });
            }
            res.json({ id: this.lastID, message: 'Виджет создан' });
          }
        );
      }
    }
  );
});

router.post('/recommendations/:clientId/add', authenticateToken, requireRole('admin'), (req, res) => {
  const { clientId } = req.params;
  const { title, description, cost } = req.body;
  const db = req.db;

  if (!title) {
    return res.status(400).json({ error: 'Необходимо указать title' });
  }

  db.get(
    'SELECT * FROM recommendations_widgets WHERE client_id = ?',
    [clientId],
    (err, widget) => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка сервера' });
      }

      if (!widget) {
        return res.status(404).json({ error: 'Виджет рекомендаций не найден' });
      }

      db.run(
        `INSERT INTO recommendations (widget_id, title, description, cost)
         VALUES (?, ?, ?, ?)`,
        [widget.id, title, description || null, cost || null],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Ошибка при добавлении рекомендации' });
          }
          const recommendationId = this.lastID;
          // Уведомим клиента внутри приложения и через Telegram (не ждём результат)
          try {
            const { notifyClientNewRecommendation } = require('../lib/telegramNotifications');
            notifyClientNewRecommendation(db, clientId, recommendationId, title, description || '').catch(err => console.error('notifyClientNewRecommendation error:', err));
          } catch (e) {
            console.error('Ошибка при отправке уведомления о новой рекомендации:', e);
          }

          res.json({ id: recommendationId, message: 'Рекомендация добавлена' });
        }
      );
    }
  );
});

router.delete('/recommendations/:recommendationId', authenticateToken, requireRole('admin'), (req, res) => {
  const { recommendationId } = req.params;
  const db = req.db;

  db.run(
    'DELETE FROM recommendations WHERE id = ?',
    [recommendationId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Ошибка при удалении рекомендации' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Рекомендация не найдена' });
      }
      res.json({ message: 'Рекомендация удалена' });
    }
  );
});

router.post('/recommendations/:recommendationId/accept', authenticateToken, (req, res) => {
  const { recommendationId } = req.params;
  const userRole = req.user.role;
  const db = req.db;

  if (userRole !== 'client') {
    return res.status(403).json({ error: 'Только клиенты могут принимать рекомендации' });
  }

  const clientId = req.user.id;

  db.get(
    `SELECT r.*, rw.client_id FROM recommendations r
     JOIN recommendations_widgets rw ON r.widget_id = rw.id
     WHERE r.id = ?`,
    [recommendationId],
    (err, recommendation) => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка сервера' });
      }

      if (!recommendation) {
        return res.status(404).json({ error: 'Рекомендация не найдена' });
      }

      if (recommendation.client_id !== clientId) {
        return res.status(403).json({ error: 'Недостаточно прав' });
      }

      db.run(
        `INSERT INTO tickets (client_id, title, description, status)
         VALUES (?, ?, ?, 'open')`,
        [clientId, recommendation.title, recommendation.description || ''],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Ошибка при создании тикета' });
          }
          const ticketId = this.lastID;

          db.run('DELETE FROM recommendations WHERE id = ?', [recommendationId], function(delErr) {
            if (delErr) {
              console.error('Ошибка при удалении рекомендации после принятия:', delErr);
              return res.json({ id: ticketId, message: 'Рекомендация принята, создан новый тикет (ошибка при удалении рекомендации)' });
            }

            res.json({ id: ticketId, message: 'Рекомендация принята, создан новый тикет' });
          });
        }
      );
    }
  );
});

// ========== SITE AVAILABILITY WIDGET ==========

/**
 * Функция для проверки доступности сайта
 */
const checkSiteAvailability = async (url, clientId) => {
  try {
    return await new Promise((resolve) => {
      const urlObj = new URL(url);
      const protocol = urlObj.protocol === 'https:' ? https : http;

      const req = protocol.get(url, { timeout: 15000 }, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          const timestamp = new Date().toISOString();
          const screenshotsDir = path.join(__dirname, '..', 'uploads', 'screenshots');
          
          if (!fs.existsSync(screenshotsDir)) {
            fs.mkdirSync(screenshotsDir, { recursive: true });
          }

          const filename = `screenshot-client-${clientId}-${Date.now()}.html`;
          const filepath = path.join(screenshotsDir, filename);
          const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <title>Site Check - ${url}</title>
              <style>
                body { font-family: Arial; margin: 20px; }
                .success { color: green; }
              </style>
            </head>
            <body>
              <h1 class="success">✓ Сайт доступен</h1>
              <p>URL: ${url}</p>
              <p>Проверка: ${new Date(timestamp).toLocaleString('ru-RU')}</p>
              <p>HTTP статус: ${res.statusCode}</p>
            </body>
            </html>
          `;
          
          fs.writeFileSync(filepath, htmlContent);

          resolve({
            success: true,
            filename: filename,
            filepath: `/uploads/screenshots/${filename}`,
            timestamp: timestamp,
            statusCode: res.statusCode
          });
        } else {
          resolve({
            success: false,
            error: `HTTP ${res.statusCode}`,
            timestamp: new Date().toISOString(),
            statusCode: res.statusCode
          });
        }
      });

      req.on('error', (err) => {
        resolve({
          success: false,
          error: err.message,
          timestamp: new Date().toISOString()
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          error: 'Timeout: сайт не ответил в течение 15 секунд',
          timestamp: new Date().toISOString()
        });
      });
    });
  } catch (err) {
    return {
      success: false,
      error: err.message,
      timestamp: new Date().toISOString()
    };
  }
};

router.get('/site-availability/:clientId', authenticateToken, (req, res) => {
  const { clientId } = req.params;
  const userRole = req.user.role;
  const db = req.db;

  if (userRole === 'client' && parseInt(clientId) !== req.user.id) {
    return res.status(403).json({ error: 'Недостаточно прав' });
  }

  db.get(
    'SELECT * FROM site_availability_widgets WHERE client_id = ?',
    [clientId],
    (err, widget) => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка при получении виджета' });
      }
      res.json(widget || null);
    }
  );
});

router.post('/site-availability/:clientId', authenticateToken, requireRole('admin'), (req, res) => {
  const { clientId } = req.params;
  const { enabled, site_url } = req.body;
  const db = req.db;

  if (enabled && !site_url) {
    return res.status(400).json({ error: 'Необходимо указать site_url' });
  }

  db.get(
    'SELECT * FROM site_availability_widgets WHERE client_id = ?',
    [clientId],
    (err, existingWidget) => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка сервера' });
      }

      if (existingWidget) {
        db.run(
          `UPDATE site_availability_widgets 
           SET enabled = ?, site_url = ?, updated_at = CURRENT_TIMESTAMP
           WHERE client_id = ?`,
          [enabled !== undefined ? enabled : existingWidget.enabled, site_url || null, clientId],
          function(err) {
            if (err) {
              return res.status(500).json({ error: 'Ошибка при обновлении виджета' });
            }
            res.json({ message: 'Виджет обновлен' });
          }
        );
      } else {
        db.run(
          `INSERT INTO site_availability_widgets (client_id, enabled, site_url)
           VALUES (?, ?, ?)`,
          [clientId, enabled !== undefined ? enabled : 0, site_url || null],
          function(err) {
            if (err) {
              return res.status(500).json({ error: 'Ошибка при создании виджета' });
            }
            res.json({ id: this.lastID, message: 'Виджет создан' });
          }
        );
      }
    }
  );
});

router.post('/site-availability/:clientId/check', authenticateToken, async (req, res) => {
  const { clientId } = req.params;
  const userRole = req.user.role;
  const db = req.db;

  if (userRole === 'client' && parseInt(clientId) !== req.user.id) {
    return res.status(403).json({ error: 'Недостаточно прав' });
  }

  db.get('SELECT * FROM site_availability_widgets WHERE client_id = ?', [clientId], async (err, widget) => {
    if (err) return res.status(500).json({ error: 'Ошибка сервера' });
    if (!widget) return res.status(404).json({ error: 'Виджет доступности не найден' });
    if (!widget.enabled) return res.status(400).json({ error: 'Виджет отключен' });
    if (!widget.site_url) return res.status(400).json({ error: 'Не указан URL сайта' });

    if (widget.last_check_time) {
      const last = new Date(widget.last_check_time).getTime();
      const diff = Date.now() - last;
      if (diff < 24 * 60 * 60 * 1000) {
        return res.status(429).json({ error: 'Проверку можно запускать не чаще 1 раза в сутки' });
      }
    }

    try {
      const result = await checkSiteAvailability(widget.site_url, widget.client_id);

      if (widget.last_screenshot_path) {
        const oldPath = path.join(__dirname, '..', widget.last_screenshot_path.startsWith('/') ? widget.last_screenshot_path.slice(1) : widget.last_screenshot_path);
        fs.unlink(oldPath, (err) => { if (err) console.warn('Не удалось удалить старый скриншот:', err); });
      }

      if (result.success) {
        db.run(
          `UPDATE site_availability_widgets 
           SET last_check_time = ?, last_check_status = ?, last_check_message = ?, last_screenshot_path = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [
            result.timestamp,
            'success',
            `Последняя проверка в ${new Date(result.timestamp).toLocaleString('ru-RU')} прошла успешно`,
            result.filepath,
            widget.id
          ],
          (err) => {
            if (err) console.error('Ошибка при обновлении виджета после ручной проверки:', err);
            return res.json({ success: true, message: 'Проверка выполнена', result });
          }
        );
      } else {
        db.run(
          `UPDATE site_availability_widgets 
           SET last_check_time = ?, last_check_status = ?, last_check_message = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [
            result.timestamp,
            'error',
            `Сайт был недоступен в ${new Date(result.timestamp).toLocaleString('ru-RU')}. Ошибка: ${result.error}`,
            widget.id
          ],
          (err) => {
            if (err) console.error('Ошибка при обновлении виджета после ручной проверки:', err);
            return res.status(200).json({ success: false, message: 'Проверка выполнена с ошибкой', result });
          }
        );
      }
    } catch (err) {
      console.error('Ошибка при ручной проверке сайта:', err);
      res.status(500).json({ error: 'Ошибка при проверке сайта' });
    }
  });
});

// Инициализировать виджеты для всех клиентов
router.post('/init', authenticateToken, requireRole('admin'), (req, res) => {
  const db = req.db;
  db.all('SELECT id, url FROM clients', [], (err, clients) => {
    if (err) return res.status(500).json({ error: 'Ошибка при чтении клиентов' });

    clients.forEach(client => {
      const clientId = client.id;

      db.get('SELECT id FROM ad_campaign_widgets WHERE client_id = ?', [clientId], (err, row) => {
        if (!row) {
          db.run(`INSERT INTO ad_campaign_widgets (client_id, enabled, monthly_budget, recommended_budget, status) VALUES (?, 1, 0, 0, 'active')`, [clientId]);
        }
      });

      db.get('SELECT id FROM renewal_calendar_widgets WHERE client_id = ?', [clientId], (err, row) => {
        if (!row) {
          db.run(`INSERT INTO renewal_calendar_widgets (client_id, enabled, domain_renewal_date, hosting_renewal_date, ssl_renewal_date, ssl_auto_renewal) VALUES (?, 1, NULL, NULL, NULL, 0)`, [clientId]);
        }
      });

      db.get('SELECT id FROM recommendations_widgets WHERE client_id = ?', [clientId], (err, row) => {
        if (!row) {
          db.run(`INSERT INTO recommendations_widgets (client_id, enabled) VALUES (?, 1)`, [clientId], function(err) {
            if (err) console.error('Ошибка при создании recommendations_widgets:', err);
          });
        }
      });

      db.get('SELECT id FROM site_availability_widgets WHERE client_id = ?', [clientId], (err, row) => {
        if (!row) {
          db.run(`INSERT INTO site_availability_widgets (client_id, enabled, site_url, last_check_time, last_check_status) VALUES (?, 1, ?, CURRENT_TIMESTAMP, 'unknown')`, [clientId, client.url || null]);
        }
      });
    });

    res.json({ message: 'Инициализация виджетов запущена' });
  });
});

module.exports = {
  router,
  checkSiteAvailability
};
