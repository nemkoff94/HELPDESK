const express = require('express');
const { authenticateToken, requireRole } = require('./auth');
const {
  notifyClientNewTicket,
  notifyClientTicketMessage,
  notifyClientTicketStatusChange,
  notifyAdminNewTicket,
  notifyAdminTicketMessage
} = require('../lib/telegramNotifications');

const router = express.Router();

// Получить все тикеты
router.get('/', authenticateToken, (req, res) => {
  const userRole = req.user.role;
  const db = req.db;
  let query;
  let params = [];

  if (userRole === 'client') {
    query = `
      SELECT t.*, c.project_name as client_name
      FROM tickets t
      JOIN clients c ON t.client_id = c.id
      WHERE t.client_id = ?
      ORDER BY t.created_at DESC
    `;
    params = [req.user.id];
  } else {
    query = `
      SELECT t.*, c.project_name as client_name
      FROM tickets t
      JOIN clients c ON t.client_id = c.id
      ORDER BY 
        CASE WHEN t.status IN ('open', 'in_progress') THEN 0 ELSE 1 END,
        t.created_at DESC
    `;
  }

  db.all(query, params, (err, tickets) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка при получении тикетов' });
    }
    res.json(tickets);
  });
});

// Получить тикеты клиента
router.get('/client/:clientId', authenticateToken, (req, res) => {
  const { clientId } = req.params;
  const userRole = req.user.role;
  const db = req.db;

  if (userRole === 'client' && parseInt(clientId) !== req.user.id) {
    return res.status(403).json({ error: 'Недостаточно прав' });
  }

  db.all(
    'SELECT * FROM tickets WHERE client_id = ? ORDER BY created_at DESC',
    [clientId],
    (err, tickets) => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка при получении тикетов' });
      }
      res.json(tickets);
    }
  );
});

// Получить тикет по ID
router.get('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const db = req.db;

  db.get('SELECT * FROM tickets WHERE id = ?', [id], (err, ticket) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка при получении тикета' });
    }
    if (!ticket) {
      return res.status(404).json({ error: 'Тикет не найден' });
    }

    if (req.user.role === 'client' && ticket.client_id !== req.user.id) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    res.json(ticket);
  });
});

// Создать тикет
router.post('/', authenticateToken, async (req, res) => {
  const { client_id, title, description } = req.body;
  const userRole = req.user.role;
  const db = req.db;

  const actualClientId = userRole === 'client' ? req.user.id : client_id;

  if (!actualClientId || !title || !description) {
    return res.status(400).json({ error: 'Необходимо указать client_id, title и description' });
  }

  const createdBy = userRole !== 'client' ? req.user.id : null;

  db.run(
    `INSERT INTO tickets (client_id, title, description, created_by, status)
     VALUES (?, ?, ?, ?, 'open')`,
    [actualClientId, title, description, createdBy],
    async function(err) {
      if (err) {
        return res.status(500).json({ error: 'Ошибка при создании тикета' });
      }

      const ticketId = this.lastID;

      // Отправляем уведомление клиенту
      try {
        await notifyClientNewTicket(db, actualClientId, ticketId, title);
      } catch (error) {
        console.error('Ошибка при отправке уведомления клиенту:', error);
      }

      // Отправляем уведомление администраторам
      try {
        db.all(
          `SELECT u.id, u.email FROM users u WHERE u.role = 'admin'`,
          async (err, admins) => {
            if (!err && admins) {
              for (const admin of admins) {
                try {
                  db.get(
                    'SELECT project_name FROM clients WHERE id = ?',
                    [actualClientId],
                    async (err, client) => {
                      if (!err && client) {
                        await notifyAdminNewTicket(
                          db,
                          admin.id,
                          client.project_name,
                          ticketId,
                          title,
                          description
                        );
                      }
                    }
                  );
                } catch (error) {
                  console.error('Ошибка при отправке уведомления администратору:', error);
                }
              }
            }
          }
        );
      } catch (error) {
        console.error('Ошибка при получении администраторов:', error);
      }

      res.json({ id: ticketId, client_id: actualClientId, title, description, status: 'open' });
    }
  );
});

// Обновить тикет
router.put('/:id', authenticateToken, requireRole('admin', 'specialist'), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const db = req.db;

  // Получаем текущий тикет для информации
  db.get(
    'SELECT * FROM tickets WHERE id = ?',
    [id],
    async (err, ticket) => {
      if (err || !ticket) {
        return res.status(404).json({ error: 'Тикет не найден' });
      }

      db.run(
        'UPDATE tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, id],
        async function(err) {
          if (err) {
            return res.status(500).json({ error: 'Ошибка при обновлении тикета' });
          }

          // Отправляем уведомление клиенту об изменении статуса
          try {
            await notifyClientTicketStatusChange(db, ticket.client_id, id, ticket.title, status);
          } catch (error) {
            console.error('Ошибка при отправке уведомления об изменении статуса:', error);
          }

          res.json({ message: 'Тикет обновлен' });
        }
      );
    }
  );
});

// Удалить тикет
router.delete('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const db = req.db;

  db.get('SELECT * FROM tickets WHERE id = ?', [id], (err, ticket) => {
    if (err) return res.status(500).json({ error: 'Ошибка сервера' });
    if (!ticket) return res.status(404).json({ error: 'Тикет не найден' });

    db.run('DELETE FROM ticket_comments WHERE ticket_id = ?', [id], (err) => {
      if (err) console.error('Error deleting ticket comments:', err);

      db.run('DELETE FROM service_orders WHERE ticket_id = ?', [id], (err) => {
        if (err) console.error('Error deleting service_orders:', err);

        db.run('DELETE FROM tickets WHERE id = ?', [id], function(err) {
          if (err) {
            return res.status(500).json({ error: 'Ошибка при удалении тикета' });
          }

          if (this.changes === 0) {
            return res.status(404).json({ error: 'Тикет не найден' });
          }

          res.json({ message: 'Тикет удален' });
        });
      });
    });
  });
});

// ========== TICKET COMMENTS ==========

// Получить комментарии к тикету
router.get('/:id/comments', authenticateToken, (req, res) => {
  const { id } = req.params;
  const db = req.db;

  db.get('SELECT * FROM tickets WHERE id = ?', [id], (err, ticket) => {
    if (err || !ticket) {
      return res.status(404).json({ error: 'Тикет не найден' });
    }

    if (req.user.role === 'client' && ticket.client_id !== req.user.id) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    const query = `
      SELECT 
        tc.*,
        u.name as user_name,
        u.role as user_role,
        c.project_name as client_name
      FROM ticket_comments tc
      LEFT JOIN users u ON tc.user_id = u.id
      LEFT JOIN clients c ON tc.client_id = c.id
      WHERE tc.ticket_id = ?
      ORDER BY tc.created_at ASC
    `;

    db.all(query, [id], (err, comments) => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка при получении комментариев' });
      }
      res.json(comments);
    });
  });
});

// Добавить комментарий к тикету
router.post('/:id/comments', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { message } = req.body;
  const db = req.db;

  db.get('SELECT * FROM tickets WHERE id = ?', [id], async (err, ticket) => {
    if (err || !ticket) {
      return res.status(404).json({ error: 'Тикет не найден' });
    }

    if (req.user.role === 'client' && ticket.client_id !== req.user.id) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    const userId = req.user.role !== 'client' ? req.user.id : null;
    const clientId = req.user.role === 'client' ? req.user.id : null;

    db.run(
      `INSERT INTO ticket_comments (ticket_id, user_id, client_id, message)
       VALUES (?, ?, ?, ?)`,
      [id, userId, clientId, message],
      async function(err) {
        if (err) {
          return res.status(500).json({ error: 'Ошибка при создании комментария' });
        }

        // Отправляем уведомления
        try {
          if (req.user.role === 'client') {
            // Клиент отправляет сообщение - уведомляем администраторов
            db.all(
              `SELECT u.id, u.email FROM users u WHERE u.role = 'admin'`,
              async (err, admins) => {
                if (!err && admins) {
                  for (const admin of admins) {
                    try {
                      db.get(
                        'SELECT project_name FROM clients WHERE id = ?',
                        [ticket.client_id],
                        async (err, client) => {
                          if (!err && client) {
                            await notifyAdminTicketMessage(
                              db,
                              admin.id,
                              client.project_name,
                              id,
                              ticket.title,
                              client.project_name,
                              message
                            );
                          }
                        }
                      );
                    } catch (error) {
                      console.error('Ошибка при отправке уведомления администратору:', error);
                    }
                  }
                }
              }
            );
          } else {
            // Администратор отправляет сообщение - уведомляем клиента
            try {
              await notifyClientTicketMessage(
                db,
                ticket.client_id,
                id,
                ticket.title,
                req.user.name,
                message
              );
            } catch (error) {
              console.error('Ошибка при отправке уведомления клиенту:', error);
            }
          }
        } catch (error) {
          console.error('Ошибка при отправке уведомлений:', error);
        }

        res.json({ id: this.lastID, message: 'Комментарий добавлен' });
      }
    );
  });
});

module.exports = router;
