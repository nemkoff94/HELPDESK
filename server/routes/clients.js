const express = require('express');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { authenticateToken, requireRole } = require('./auth');

const router = express.Router();

/**
 * Функция генерации случайного пароля
 */
const generatePassword = (length = 12) => {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

// Получить список клиентов
router.get('/', authenticateToken, requireRole('admin', 'specialist'), (req, res) => {
  const db = req.db;
  const query = `
    SELECT 
      c.*,
      COUNT(CASE WHEN t.status IN ('open', 'in_progress') THEN 1 END) as open_tickets_count
    FROM clients c
    LEFT JOIN tickets t ON c.id = t.client_id
    GROUP BY c.id
    ORDER BY open_tickets_count DESC, c.project_name ASC
  `;

  db.all(query, [], (err, clients) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка при получении клиентов' });
    }
    res.json(clients);
  });
});

// Получить клиента по ID
router.get('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const userRole = req.user.role;
  const db = req.db;

  if (userRole === 'client' && parseInt(id) !== req.user.id) {
    return res.status(403).json({ error: 'Недостаточно прав' });
  }

  db.get('SELECT * FROM clients WHERE id = ?', [id], (err, client) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка при получении клиента' });
    }
    if (!client) {
      return res.status(404).json({ error: 'Клиент не найден' });
    }
    res.json(client);
  });
});

// Создать клиента
router.post('/', authenticateToken, requireRole('admin'), (req, res) => {
  const { project_name, url, legal_name, legal_address, inn, ogrn, status } = req.body;
  const db = req.db;

  db.run(
    `INSERT INTO clients (project_name, url, legal_name, legal_address, inn, ogrn, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [project_name, url || null, legal_name || null, legal_address || null, inn || null, ogrn || null, status || 'in_development'],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Ошибка при создании клиента' });
      }
      res.json({ id: this.lastID, ...req.body });
    }
  );
});

// Обновить клиента
router.put('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const { project_name, url, legal_name, legal_address, inn, ogrn, status } = req.body;
  const db = req.db;

  db.run(
    `UPDATE clients 
     SET project_name = ?, url = ?, legal_name = ?, legal_address = ?, inn = ?, ogrn = ?, status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [project_name, url || null, legal_name || null, legal_address || null, inn || null, ogrn || null, status, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Ошибка при обновлении клиента' });
      }
      res.json({ message: 'Клиент обновлен' });
    }
  );
});

// Удалить клиента
router.delete('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const db = req.db;

  db.serialize(() => {
    db.all('SELECT file_path FROM invoices WHERE client_id = ?', [id], (err, invoices) => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка при удалении клиента' });
      }

      invoices.forEach((invoice) => {
        if (invoice.file_path) {
          const rel = invoice.file_path.startsWith('/') ? invoice.file_path.slice(1) : invoice.file_path;
          const fullPath = path.join(__dirname, '..', rel);
          fs.unlink(fullPath, (fsErr) => {
            if (fsErr) {
              console.warn('Failed to unlink invoice file:', fullPath, fsErr);
            }
          });
        }
      });

      db.run('DELETE FROM ticket_comments WHERE ticket_id IN (SELECT id FROM tickets WHERE client_id = ?)', [id], (err) => {
        if (err) console.error('Error deleting ticket comments:', err);

        db.run('DELETE FROM tickets WHERE client_id = ?', [id], (err) => {
          if (err) console.error('Error deleting tickets:', err);

          db.run('DELETE FROM invoices WHERE client_id = ?', [id], (err) => {
            if (err) console.error('Error deleting invoices:', err);

            db.run('DELETE FROM task_comments WHERE task_id IN (SELECT id FROM tasks WHERE client_id = ?)', [id], (err) => {
              if (err) console.error('Error deleting task comments:', err);

              db.run('DELETE FROM tasks WHERE client_id = ?', [id], (err) => {
                if (err) console.error('Error deleting tasks:', err);

                db.run('DELETE FROM client_logins WHERE client_id = ?', [id], (err) => {
                  if (err) console.error('Error deleting client login:', err);

                  db.run('DELETE FROM clients WHERE id = ?', [id], function(err) {
                    if (err) {
                      return res.status(500).json({ error: 'Ошибка при удалении клиента' });
                    }
                    if (this.changes === 0) {
                      return res.status(404).json({ error: 'Клиент не найден' });
                    }
                    res.json({ message: 'Клиент и все связанные данные успешно удалены' });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});

// Получить информацию о логине клиента
router.get('/:id/login', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const db = req.db;

  db.get(
    'SELECT id, email, created_at, updated_at FROM client_logins WHERE client_id = ?',
    [id],
    (err, login) => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка при получении логина' });
      }
      res.json(login || null);
    }
  );
});

// Создать логин для клиента
router.post('/:id/login', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { email, password } = req.body;
  const db = req.db;

  db.get('SELECT * FROM clients WHERE id = ?', [id], async (err, client) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка сервера' });
    }

    if (!client) {
      return res.status(404).json({ error: 'Клиент не найден' });
    }

    db.get('SELECT * FROM client_logins WHERE client_id = ?', [id], async (err, existingLogin) => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка сервера' });
      }

      if (existingLogin) {
        return res.status(400).json({ error: 'Логин для этого клиента уже существует' });
      }

      if (email) {
        db.get('SELECT * FROM client_logins WHERE email = ?', [email], async (err, emailTaken) => {
          if (err) {
            return res.status(500).json({ error: 'Ошибка сервера' });
          }

          if (emailTaken) {
            return res.status(400).json({ error: 'Этот email уже используется' });
          }

          const finalPassword = password || generatePassword();
          const hashedPassword = await bcrypt.hash(finalPassword, 10);

          db.run(
            `INSERT INTO client_logins (client_id, email, password)
             VALUES (?, ?, ?)`,
            [id, email, hashedPassword],
            function(insertErr) {
              if (insertErr) {
                return res.status(500).json({ error: 'Ошибка при создании логина' });
              }

              res.json({
                id: this.lastID,
                email,
                password: finalPassword,
                message: 'Логин успешно создан'
              });
            }
          );
        });
      } else {
        return res.status(400).json({ error: 'Необходимо указать email' });
      }
    });
  });
});

// Изменить пароль клиента
router.put('/:id/password', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;
  const db = req.db;

  if (!newPassword) {
    return res.status(400).json({ error: 'Необходимо указать новый пароль' });
  }

  db.get('SELECT * FROM client_logins WHERE client_id = ?', [id], async (err, login) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка сервера' });
    }

    if (!login) {
      return res.status(404).json({ error: 'Логин для этого клиента не найден' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    db.run(
      'UPDATE client_logins SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE client_id = ?',
      [hashedPassword, id],
      function(updateErr) {
        if (updateErr) {
          return res.status(500).json({ error: 'Ошибка при изменении пароля' });
        }

        res.json({
          message: 'Пароль успешно изменен',
          password: newPassword
        });
      }
    );
  });
});

// Сгенерировать новый пароль для клиента
router.post('/:id/generate-password', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const db = req.db;

  db.get('SELECT * FROM client_logins WHERE client_id = ?', [id], async (err, login) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка сервера' });
    }

    if (!login) {
      return res.status(404).json({ error: 'Логин для этого клиента не найден' });
    }

    const newPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    db.run(
      'UPDATE client_logins SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE client_id = ?',
      [hashedPassword, id],
      function(updateErr) {
        if (updateErr) {
          return res.status(500).json({ error: 'Ошибка при генерации пароля' });
        }

        res.json({
          message: 'Новый пароль успешно сгенерирован',
          password: newPassword
        });
      }
    );
  });
});

module.exports = router;
