const express = require('express');
const { authenticateToken, requireRole } = require('./auth');
const {
  notifyClientNewTicket,
  notifyClientTicketMessage,
  notifyClientTicketStatusChange,
  notifyAdminNewTicket,
  notifyAdminTicketMessage
} = require('../lib/telegramNotifications');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Ensure uploads/attachments directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads', 'attachments');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '';
    // transliterate Cyrillic to Latin and slugify filename to avoid non-ascii in URLs
    const nameWithoutExt = path.basename(file.originalname, ext);

    const transliterate = (str) => {
      const map = {
        А:'A', Б:'B', В:'V', Г:'G', Д:'D', Е:'E', Ё:'E', Ж:'Zh', З:'Z', И:'I', Й:'Y', К:'K', Л:'L', М:'M', Н:'N', О:'O', П:'P', Р:'R', С:'S', Т:'T', У:'U', Ф:'F', Х:'Kh', Ц:'Ts', Ч:'Ch', Ш:'Sh', Щ:'Shch', Ъ:'', Ы:'Y', Ь:'', Э:'E', Ю:'Yu', Я:'Ya',
        а:'a', б:'b', в:'v', г:'g', д:'d', е:'e', ё:'e', ж:'zh', з:'z', и:'i', й:'y', к:'k', л:'l', м:'m', н:'n', о:'o', п:'p', р:'r', с:'s', т:'t', у:'u', ф:'f', х:'kh', ц:'ts', ч:'ch', ш:'sh', щ:'shch', ъ:'', ы:'y', ь:'', э:'e', ю:'yu', я:'ya'
      };
      return str.split('').map(c => map[c] || c).join('');
    };

    const slugify = (str) => {
      return transliterate(str)
        .replace(/\s+/g, '-') // spaces to dashes
        .replace(/[^A-Za-z0-9._-]/g, '-') // remove unsafe chars
        .replace(/-+/g, '-') // collapse dashes
        .replace(/^-|-$/g, ''); // trim dashes
    };

    const safeName = slugify(nameWithoutExt);
    const finalName = `${safeName ? safeName + '_' : ''}${uuidv4()}${ext}`;
    cb(null, finalName);
  }
});

const upload = multer({ storage });

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

    // Получим вложения привязанные к самому тикету (не к комментариям)
    db.all('SELECT * FROM attachments WHERE ticket_id = ? AND comment_id IS NULL', [id], (err, attachments) => {
      if (err) {
        console.error('Ошибка при получении вложений тикета:', err);
        ticket.attachments = [];
      } else {
        ticket.attachments = attachments || [];
      }
      res.json(ticket);
    });
  });
});

// Создать тикет
router.post('/', authenticateToken, upload.array('attachments'), async (req, res) => {
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

      // Сохраняем вложения (если есть)
      try {
        if (req.files && req.files.length) {
          for (const file of req.files) {
            const relPath = path.posix.join('/uploads/attachments', file.filename);
            const uploaderUserId = userRole !== 'client' ? req.user.id : null;
            const uploaderClientId = userRole === 'client' ? req.user.id : null;
            db.run(
              `INSERT INTO attachments (ticket_id, comment_id, uploader_user_id, uploader_client_id, filename, original_name, mime_type, size, path) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
              [ticketId, uploaderUserId, uploaderClientId, file.filename, file.originalname, file.mimetype, file.size, relPath],
              (err) => {
                if (err) console.error('Ошибка сохранения вложения:', err);
              }
            );
          }
        }
      } catch (e) {
        console.error('Ошибка при сохранении вложений:', e);
      }

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

    // Сначала найдем все вложения, связанные с тикетом (включая вложения к комментариям),
    // удалим файлы с диска и записи из таблицы attachments.
    db.all('SELECT * FROM attachments WHERE ticket_id = ?', [id], (err, attachments) => {
      if (err) {
        console.error('Ошибка при получении вложений для удаления:', err);
      } else if (attachments && attachments.length) {
        for (const attachment of attachments) {
          if (attachment.path) {
            const filePath = path.join(__dirname, attachment.path.startsWith('/') ? attachment.path.slice(1) : attachment.path);
            try {
              if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
              }
            } catch (e) {
              console.warn('Не удалось удалить файл вложения:', filePath, e);
            }
          }
        }

        db.run('DELETE FROM attachments WHERE ticket_id = ?', [id], (err) => {
          if (err) console.error('Ошибка при удалении записей вложений:', err);
        });
      }

      // Удаляем комментарии тикета
      db.run('DELETE FROM ticket_comments WHERE ticket_id = ?', [id], (err) => {
        if (err) console.error('Error deleting ticket comments:', err);

        // Удаляем сервисные заказы, связанные с тикетом
        db.run('DELETE FROM service_orders WHERE ticket_id = ?', [id], (err) => {
          if (err) console.error('Error deleting service_orders:', err);

          // Наконец удаляем сам тикет
          db.run('DELETE FROM tickets WHERE id = ?', [id], function(err) {
            if (err) {
              return res.status(500).json({ error: 'Ошибка при удалении тикета' });
            }

            if (this.changes === 0) {
              return res.status(404).json({ error: 'Тикет не найден' });
            }

            res.json({ message: 'Тикет и связанные вложения удалены' });
          });
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

      // Получаем все вложения для комментариев этого тикета за один запрос
      db.all('SELECT * FROM attachments WHERE ticket_id = ? AND comment_id IS NOT NULL', [id], (err, atts) => {
        if (err) {
          console.error('Ошибка при получении вложений для комментариев:', err);
          return res.json(comments);
        }

        const attachmentsMap = {};
        for (const a of atts) {
          if (!attachmentsMap[a.comment_id]) attachmentsMap[a.comment_id] = [];
          attachmentsMap[a.comment_id].push(a);
        }

        for (const com of comments) {
          com.attachments = attachmentsMap[com.id] || [];
        }

        res.json(comments);
      });
    });
  });
});

// Добавить комментарий к тикету
router.post('/:id/comments', authenticateToken, upload.array('attachments'), async (req, res) => {
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

        const commentId = this.lastID;

        // Сохраняем вложения (если есть) и привязываем к комментарию
        try {
          if (req.files && req.files.length) {
            for (const file of req.files) {
              const relPath = path.posix.join('/uploads/attachments', file.filename);
              const uploaderUserId = req.user.role !== 'client' ? req.user.id : null;
              const uploaderClientId = req.user.role === 'client' ? req.user.id : null;
              db.run(
                `INSERT INTO attachments (ticket_id, comment_id, uploader_user_id, uploader_client_id, filename, original_name, mime_type, size, path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, commentId, uploaderUserId, uploaderClientId, file.filename, file.originalname, file.mimetype, file.size, relPath],
                (err) => {
                  if (err) console.error('Ошибка сохранения вложения комментария:', err);
                }
              );
            }
          }
        } catch (e) {
          console.error('Ошибка при сохранении вложений комментария:', e);
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

        res.json({ id: commentId, message: 'Комментарий добавлен' });
      }
    );
  });
});

module.exports = router;

// Удаление вложения (ручное) - только для админа
router.delete('/attachments/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const db = req.db;

  db.get('SELECT * FROM attachments WHERE id = ?', [id], (err, attachment) => {
    if (err) return res.status(500).json({ error: 'Ошибка сервера' });
    if (!attachment) return res.status(404).json({ error: 'Вложение не найдено' });

    // Удаляем файл с диска (если есть)
    if (attachment.path) {
      const filePath = path.join(__dirname, attachment.path.startsWith('/') ? attachment.path.slice(1) : attachment.path);
      fs.unlink(filePath, (err) => {
        if (err) console.warn('Не удалось удалить файл вложения:', filePath, err);
      });
    }

    // Добавляем комментарий в тикет о ручном удалении вложения
    const msg = 'Вложение удалено администратором';
    if (attachment.ticket_id) {
      db.run(
        `INSERT INTO ticket_comments (ticket_id, user_id, client_id, message) VALUES (?, ?, NULL, ?)`,
        [attachment.ticket_id, req.user.id, msg],
        (err) => {
          if (err) console.error('Ошибка при добавлении комментария об удалении вложения:', err);
        }
      );
    }

    // Удаляем запись из БД
    db.run('DELETE FROM attachments WHERE id = ?', [id], function(err) {
      if (err) return res.status(500).json({ error: 'Ошибка при удалении записи вложения' });
      res.json({ message: 'Вложение удалено' });
    });
  });
});

