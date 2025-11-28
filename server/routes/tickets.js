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

// Helper: format DB datetime string into Moscow-localized string (ru-RU)
const formatToMoscow = (dbDateStr) => {
  if (!dbDateStr) return null;
  try {
    // Expecting format like 'YYYY-MM-DD HH:MM:SS' from SQLite; treat as UTC
    const asIso = dbDateStr.replace(' ', 'T') + 'Z';
    const d = new Date(asIso);
    const formatter = new Intl.DateTimeFormat('ru-RU', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
      timeZone: 'Europe/Moscow'
    });
    return formatter.format(d);
  } catch (e) {
    return dbDateStr;
  }
};

// Helper: convert DB datetime string to ISO UTC (assumes DB string is UTC or should be treated as such)
const toISOUTC = (dbDateStr) => {
  if (!dbDateStr) return null;
  try {
    const asIso = dbDateStr.replace(' ', 'T') + 'Z';
    return new Date(asIso).toISOString();
  } catch (e) {
    return null;
  }
};

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

// Получить все тикеты (для клиента — только его, для админа — все)
router.get('/', authenticateToken, (req, res) => {
  const userRole = req.user.role;
  const db = req.db;

  // В запрос добавляем данные о последнем комментарии и кто его написал, а также время последнего прочтения конкретным пользователем/клиентом
  let baseQuery = `
    SELECT
      t.*,
      c.project_name as client_name,
      (SELECT MAX(created_at) FROM ticket_comments tc WHERE tc.ticket_id = t.id) AS last_comment_at,
      (SELECT tc.user_id FROM ticket_comments tc WHERE tc.ticket_id = t.id ORDER BY tc.created_at DESC LIMIT 1) AS last_comment_user_id,
      (SELECT tc.client_id FROM ticket_comments tc WHERE tc.ticket_id = t.id ORDER BY tc.created_at DESC LIMIT 1) AS last_comment_client_id,
      (SELECT tr.last_read_at FROM ticket_reads tr WHERE tr.ticket_id = t.id AND (
        (tr.user_id IS NOT NULL AND tr.user_id = ?) OR (tr.client_id IS NOT NULL AND tr.client_id = ?)
      ) LIMIT 1) AS last_read_at
    FROM tickets t
    JOIN clients c ON t.client_id = c.id
  `;

  const params = [req.user.id, req.user.id];

  if (userRole === 'client') {
    baseQuery += ` WHERE t.client_id = ?`;
    params.push(req.user.id);
  }

  db.all(baseQuery, params, (err, tickets) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка при получении тикетов' });
    }

    // Вычисляем флаг непрочитанного ответа для текущего читателя
    const processed = tickets.map((ticket) => {
      const lastCommentAt = ticket.last_comment_at;
      const lastCommentUserId = ticket.last_comment_user_id; // not null => staff wrote last
      const lastCommentClientId = ticket.last_comment_client_id; // not null => client wrote last
      const lastReadAt = ticket.last_read_at; // may be null

      let has_unread_response = false;
      if (userRole === 'client') {
        // unread if last comment by staff and after client's last read
        if (lastCommentAt && lastCommentUserId != null) {
          if (!lastReadAt || new Date(lastCommentAt) > new Date(lastReadAt)) {
            has_unread_response = true;
          }
        }
      } else {
        // admin/specialist: unread if last comment by client and after user's last read
        if (lastCommentAt && lastCommentClientId != null) {
          if (!lastReadAt || new Date(lastCommentAt) > new Date(lastReadAt)) {
            has_unread_response = true;
          }
        }
      }

      return {
        ...ticket,
        has_unread_response,
      };
    });

    // Сортируем: сначала непрочитанные, затем открытые/в работе, затем по дате
    processed.sort((a, b) => {
      if (a.has_unread_response && !b.has_unread_response) return -1;
      if (!a.has_unread_response && b.has_unread_response) return 1;
      const aPriority = ['open', 'in_progress'].includes(a.status) ? 0 : 1;
      const bPriority = ['open', 'in_progress'].includes(b.status) ? 0 : 1;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return new Date(b.created_at) - new Date(a.created_at);
    });

    // Добавим ISO/UTC-поля и (совместимо) msk-поля
    const formatted = processed.map((t) => ({
      ...t,
      created_at_utc: toISOUTC(t.created_at),
      updated_at_utc: t.updated_at ? toISOUTC(t.updated_at) : null,
      last_comment_at_utc: t.last_comment_at ? toISOUTC(t.last_comment_at) : null,
      last_read_at_utc: t.last_read_at ? toISOUTC(t.last_read_at) : null,
      created_at_msk: formatToMoscow(t.created_at),
      updated_at_msk: t.updated_at ? formatToMoscow(t.updated_at) : null,
      last_comment_at_msk: t.last_comment_at ? formatToMoscow(t.last_comment_at) : null,
      last_read_at_msk: t.last_read_at ? formatToMoscow(t.last_read_at) : null,
    }));

    res.json(formatted);
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

  // Получаем тикеты клиента и поля для определения непрочитанных ответов
  const query = `
    SELECT
      t.*,
      (SELECT MAX(created_at) FROM ticket_comments tc WHERE tc.ticket_id = t.id) AS last_comment_at,
      (SELECT tc.user_id FROM ticket_comments tc WHERE tc.ticket_id = t.id ORDER BY tc.created_at DESC LIMIT 1) AS last_comment_user_id,
      (SELECT tr.last_read_at FROM ticket_reads tr WHERE tr.ticket_id = t.id AND tr.client_id = ? LIMIT 1) AS last_read_at
    FROM tickets t
    WHERE t.client_id = ?
    ORDER BY t.created_at DESC
  `;

  db.all(query, [clientId, clientId], (err, tickets) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка при получении тикетов' });
    }

    const processed = tickets.map((ticket) => {
      const lastCommentAt = ticket.last_comment_at;
      const lastCommentUserId = ticket.last_comment_user_id; // staff id if last comment by staff
      const lastReadAt = ticket.last_read_at;

      let has_unread_response = false;
      if (lastCommentAt && lastCommentUserId != null) {
        if (!lastReadAt || new Date(lastCommentAt) > new Date(lastReadAt)) {
          has_unread_response = true;
        }
      }

      return {
        ...ticket,
        has_unread_response,
        created_at_utc: toISOUTC(ticket.created_at),
        updated_at_utc: ticket.updated_at ? toISOUTC(ticket.updated_at) : null,
        last_comment_at_utc: ticket.last_comment_at ? toISOUTC(ticket.last_comment_at) : null,
        last_read_at_utc: ticket.last_read_at ? toISOUTC(ticket.last_read_at) : null,
        created_at_msk: formatToMoscow(ticket.created_at),
      };
    });

    // sort unread first
    processed.sort((a, b) => {
      if (a.has_unread_response && !b.has_unread_response) return -1;
      if (!a.has_unread_response && b.has_unread_response) return 1;
      return new Date(b.created_at) - new Date(a.created_at);
    });

    res.json(processed);
  });
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

    // Обновляем пометку о прочтении для текущего пользователя/клиента
    const readerUserId = req.user.role !== 'client' ? req.user.id : null;
    const readerClientId = req.user.role === 'client' ? req.user.id : null;

    const upsertRead = () => {
      // Проверим есть ли запись
      db.get(
        'SELECT * FROM ticket_reads WHERE ticket_id = ? AND ((user_id IS NOT NULL AND user_id = ?) OR (client_id IS NOT NULL AND client_id = ?))',
        [id, readerUserId, readerClientId],
        (err, row) => {
          if (err) {
            console.error('Ошибка при проверке ticket_reads:', err);
          }
          if (row) {
            db.run('UPDATE ticket_reads SET last_read_at = CURRENT_TIMESTAMP WHERE id = ?', [row.id], (err) => {
              if (err) console.error('Ошибка при обновлении ticket_reads:', err);
            });
          } else {
            db.run('INSERT INTO ticket_reads (ticket_id, user_id, client_id, last_read_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)', [id, readerUserId, readerClientId], (err) => {
              if (err) console.error('Ошибка при вставке ticket_reads:', err);
            });
          }
        }
      );
    };

      // Получим вложения привязанные к самому тикету (не к комментариям)
      db.all('SELECT * FROM attachments WHERE ticket_id = ? AND comment_id IS NULL', [id], (err, attachments) => {
        if (err) {
          console.error('Ошибка при получении вложений тикета:', err);
          ticket.attachments = [];
        } else {
          ticket.attachments = (attachments || []).map(a => ({ ...a, created_at_msk: formatToMoscow(a.created_at) }));
        }
        // Обновляем пометку о прочтении асинхронно
        try {
          upsertRead();
        } catch (e) {
          console.error('Ошибка при upsertRead:', e);
        }
        // Добавим msk-поля в ответ на конкретный тикет
        const resp = {
          ...ticket,
          created_at_utc: toISOUTC(ticket.created_at),
          updated_at_utc: ticket.updated_at ? toISOUTC(ticket.updated_at) : null,
          created_at_msk: formatToMoscow(ticket.created_at),
          updated_at_msk: ticket.updated_at ? formatToMoscow(ticket.updated_at) : null,
        };
        res.json(resp);
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
          a.created_at_msk = formatToMoscow(a.created_at);
          if (!attachmentsMap[a.comment_id]) attachmentsMap[a.comment_id] = [];
          attachmentsMap[a.comment_id].push(a);
        }

        for (const com of comments) {
          com.attachments = attachmentsMap[com.id] || [];
          com.created_at_msk = formatToMoscow(com.created_at);
          com.created_at_utc = toISOUTC(com.created_at);
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

