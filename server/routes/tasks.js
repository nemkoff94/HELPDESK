const express = require('express');
const { authenticateToken, requireRole } = require('./auth');

const router = express.Router();

// ========== TASKS ==========

// Получить задачи клиента
router.get('/client/:clientId', authenticateToken, requireRole('admin', 'specialist'), (req, res) => {
  const { clientId } = req.params;
  const db = req.db;

  const query = `
    SELECT 
      t.*,
      u.name as created_by_name,
      u.role as created_by_role
    FROM tasks t
    LEFT JOIN users u ON t.created_by = u.id
    WHERE t.client_id = ?
    ORDER BY 
      CASE WHEN t.status = 'new' THEN 0 WHEN t.status = 'in_progress' THEN 1 ELSE 2 END,
      CASE WHEN t.deadline IS NOT NULL AND t.deadline < date('now') AND t.status != 'completed' THEN 0 ELSE 1 END,
      t.created_at DESC
  `;

  db.all(query, [clientId], (err, tasks) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка при получении задач' });
    }
    res.json(tasks);
  });
});

// Получить задачу по ID
router.get('/:id', authenticateToken, requireRole('admin', 'specialist'), (req, res) => {
  const { id } = req.params;
  const db = req.db;

  const query = `
    SELECT 
      t.*,
      u.name as created_by_name,
      u.role as created_by_role
    FROM tasks t
    LEFT JOIN users u ON t.created_by = u.id
    WHERE t.id = ?
  `;

  db.get(query, [id], (err, task) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка при получении задачи' });
    }
    if (!task) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }
    res.json(task);
  });
});

// Создать задачу
router.post('/', authenticateToken, requireRole('admin'), (req, res) => {
  const { client_id, title, description, deadline } = req.body;
  const db = req.db;

  if (!client_id || !title) {
    return res.status(400).json({ error: 'Необходимо указать client_id и title' });
  }

  db.run(
    `INSERT INTO tasks (client_id, title, description, deadline, created_by, status)
     VALUES (?, ?, ?, ?, ?, 'new')`,
    [client_id, title, description || null, deadline || null, req.user.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Ошибка при создании задачи' });
      }
      res.json({
        id: this.lastID,
        client_id,
        title,
        description,
        deadline,
        status: 'new',
        created_by: req.user.id
      });
    }
  );
});

// Обновить задачу
router.put('/:id', authenticateToken, requireRole('admin', 'specialist'), (req, res) => {
  const { id } = req.params;
  const { title, description, status, deadline } = req.body;
  const db = req.db;

  const updates = [];
  const values = [];

  if (title !== undefined) {
    updates.push('title = ?');
    values.push(title);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    values.push(description);
  }
  if (status !== undefined) {
    updates.push('status = ?');
    values.push(status);
  }
  if (deadline !== undefined) {
    updates.push('deadline = ?');
    values.push(deadline || null);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'Необходимо указать хотя бы одно поле для обновления' });
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  db.run(
    `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`,
    values,
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Ошибка при обновлении задачи' });
      }
      res.json({ message: 'Задача обновлена' });
    }
  );
});

// Удалить задачу
router.delete('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const db = req.db;

  db.run('DELETE FROM tasks WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Ошибка при удалении задачи' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }
    res.json({ message: 'Задача удалена' });
  });
});

// ========== TASK COMMENTS ==========

// Получить комментарии к задаче
router.get('/:id/comments', authenticateToken, requireRole('admin', 'specialist'), (req, res) => {
  const { id } = req.params;
  const db = req.db;

  const query = `
    SELECT 
      tc.*,
      u.name as user_name,
      u.role as user_role
    FROM task_comments tc
    JOIN users u ON tc.user_id = u.id
    WHERE tc.task_id = ?
    ORDER BY tc.created_at ASC
  `;

  db.all(query, [id], (err, comments) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка при получении комментариев' });
    }
    res.json(comments);
  });
});

// Добавить комментарий к задаче
router.post('/:id/comments', authenticateToken, requireRole('admin', 'specialist'), (req, res) => {
  const { id } = req.params;
  const { message } = req.body;
  const db = req.db;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Необходимо указать сообщение' });
  }

  db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, task) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка сервера' });
    }
    if (!task) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }

    db.run(
      `INSERT INTO task_comments (task_id, user_id, message)
       VALUES (?, ?, ?)`,
      [id, req.user.id, message],
      function(insertErr) {
        if (insertErr) {
          return res.status(500).json({ error: 'Ошибка при создании комментария' });
        }
        res.json({ id: this.lastID, message: 'Комментарий добавлен' });
      }
    );
  });
});

module.exports = router;
