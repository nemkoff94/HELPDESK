const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { generateInvoicePdfBuffer } = require('../pdfGenerator');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'obsidian-secret-key-change-in-production';

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/invoices';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'invoice-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Только PDF файлы разрешены'), false);
    }
  }
});

// Middleware для проверки JWT
const authenticateToken = (req, res, next) => {
  // Пропускаем OPTIONS запросы
  if (req.method === 'OPTIONS') {
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Токен не предоставлен' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Недействительный токен' });
    }
    req.user = user;
    next();
  });
};

// Middleware для проверки роли
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    next();
  };
};

// ========== AUTH ROUTES ==========

router.post('/auth/login', async (req, res, next) => {
  const { email, password } = req.body;
  const db = req.db;

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка сервера' });
    }

    if (!user) {
      // Возможно, это клиент, который пытается войти через форму сотрудника
      db.get('SELECT * FROM client_logins WHERE email = ?', [email], (cErr, clientLogin) => {
        if (cErr) {
          return res.status(500).json({ error: 'Ошибка сервера' });
        }

        if (clientLogin) {
          return res.status(401).json({ error: 'Клиент пытается войти как сотрудник' });
        }

        return res.status(401).json({ error: 'Не найден пользователь по логину' });
      });
      return;
    }

    if (user.role === 'client') {
      return res.status(401).json({ error: 'Клиент пытается войти как сотрудник' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Введен неверный пароль пользователя' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name
      }
    });
  });
});

router.post('/auth/client-login', async (req, res, next) => {
  const { email, password, clientId } = req.body;
  const db = req.db;

  // Поддержка старого способа входа по ID (для обратной совместимости)
  if (clientId && !email && !password) {
    db.get('SELECT * FROM clients WHERE id = ?', [clientId], (err, client) => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка сервера' });
      }

      if (!client) {
        return res.status(401).json({ error: 'Клиент не найден' });
      }

      const token = jwt.sign(
        { id: client.id, role: 'client', name: client.project_name },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        token,
        user: {
          id: client.id,
          role: 'client',
          name: client.project_name,
          projectName: client.project_name,
          status: client.status
        }
      });
    });
    return;
  }

  // Новый способ входа по email и паролю
  if (!email || !password) {
    return res.status(400).json({ error: 'Необходимо указать email и пароль' });
  }

  db.get(
    `SELECT cl.*, c.project_name, c.status 
     FROM client_logins cl 
     JOIN clients c ON cl.client_id = c.id 
     WHERE cl.email = ?`,
    [email],
    async (err, clientLogin) => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка сервера' });
      }

      if (!clientLogin) {
        // Возможно, это сотрудник, который пытается зайти через форму клиента
        db.get('SELECT * FROM users WHERE email = ?', [email], (uErr, userRow) => {
          if (uErr) {
            return res.status(500).json({ error: 'Ошибка сервера' });
          }

          if (userRow) {
            return res.status(401).json({ error: 'Сотрудник пытается войти как клиент' });
          }

          return res.status(401).json({ error: 'Не найден пользователь по логину' });
        });
        return;
      }

      const validPassword = await bcrypt.compare(password, clientLogin.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Введен неверный пароль пользователя' });
      }

      const token = jwt.sign(
        { id: clientLogin.client_id, role: 'client', name: clientLogin.project_name },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        token,
        user: {
          id: clientLogin.client_id,
          role: 'client',
          name: clientLogin.project_name,
          projectName: clientLogin.project_name,
          status: clientLogin.status
        }
      });
    }
  );
});

router.get('/auth/me', authenticateToken, (req, res, next) => {
  const db = req.db;
  if (req.user.role === 'client') {
    db.get('SELECT * FROM clients WHERE id = ?', [req.user.id], (err, client) => {
      if (err || !client) {
        return res.status(404).json({ error: 'Клиент не найден' });
      }
      res.json({
        id: client.id,
        role: 'client',
        name: client.project_name,
        projectName: client.project_name,
        status: client.status
      });
    });
  } else {
    res.json(req.user);
  }
});

router.put('/auth/change-password', authenticateToken, async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;
  const db = req.db;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Необходимо указать текущий и новый пароль' });
  }

  db.get('SELECT * FROM users WHERE id = ?', [userId], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка сервера' });
    }

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Текущий пароль неверный' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    db.run(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, userId],
      function(updateErr) {
        if (updateErr) {
          return res.status(500).json({ error: 'Ошибка при изменении пароля' });
        }

        res.json({ message: 'Пароль успешно изменен' });
      }
    );
  });
});

router.post('/auth/create-user', authenticateToken, requireRole('admin'), async (req, res, next) => {
  const { email, password, role, name } = req.body;
  const db = req.db;

  if (!email || !password || !role || !name) {
    return res.status(400).json({ error: 'Необходимо указать email, password, role и name' });
  }

  if (!['admin', 'specialist'].includes(role)) {
    return res.status(400).json({ error: 'Role должна быть admin или specialist' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, existingUser) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка сервера' });
    }

    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с этим email уже существует' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
      `INSERT INTO users (email, password, role, name)
       VALUES (?, ?, ?, ?)`,
      [email, hashedPassword, role, name],
      function(insertErr) {
        if (insertErr) {
          return res.status(500).json({ error: 'Ошибка при создании пользователя' });
        }

        res.json({
          id: this.lastID,
          email,
          role,
          name,
          message: 'Пользователь успешно создан'
        });
      }
    );
  });
});

router.get('/auth/users', authenticateToken, requireRole('admin'), (req, res, next) => {
  const db = req.db;
  db.all(
    'SELECT id, email, name, role, created_at FROM users WHERE id != ? ORDER BY created_at DESC',
    [req.user.id],
    (err, users) => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка сервера' });
      }
      res.json(users);
    }
  );
});

router.delete('/auth/users/:userId', authenticateToken, requireRole('admin'), (req, res, next) => {
  const { userId } = req.params;
  const db = req.db;

  if (parseInt(userId) === req.user.id) {
    return res.status(400).json({ error: 'Вы не можете удалить свою учетную запись' });
  }

  db.run(
    'DELETE FROM users WHERE id = ?',
    [userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Ошибка при удалении пользователя' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      res.json({ message: 'Пользователь успешно удален' });
    }
  );
});

module.exports = {
  router,
  authenticateToken,
  requireRole,
  upload
};
