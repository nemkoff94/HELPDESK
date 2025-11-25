const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'obsidian-secret-key-change-in-production';

// Middleware
// Configure CORS: in development allow any origin (so frontend on different ports works),
// in production only allow the configured CLIENT_ORIGIN.
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:3000';
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://obs-panel.ru',
  'http://obs-panel.ru',
  'https://www.obs-panel.ru',
  'http://www.obs-panel.ru',
  CLIENT_ORIGIN
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (e.g. curl, mobile apps, OPTIONS preflight)
    if (!origin) return callback(null, true);
    // Check if origin is in allowed list
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    // In development, allow all
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    return callback(new Error('CORS policy: origin not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

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

// Helper: generate invoice PDF buffer with QR code (improved layout, uses Cyrillic-capable font when available)
const generateInvoicePdfBuffer = async ({ recipient, recipientInn, bankName, bic, corrAccount, account, amount, serviceName, invoiceDate, invoiceNumber, legalAddress, payerName, payerInn, payerAddress, payerOgrn }) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Prepare QR text in ST00012-like format
      const sumStr = Number(amount).toFixed(2);
      const qrText = `ST00012|Name=${recipient}|PersonalAcc=${account}|BankName=${bankName}|BIC=${bic}|CorrespAcc=${corrAccount}|Sum=${sumStr}|Purpose=${encodeURIComponent('Оплата по счету: ' + serviceName)}`;
      const qrDataUrl = await QRCode.toDataURL(qrText);
      const qrBase64 = qrDataUrl.split(',')[1];
      const qrBuffer = Buffer.from(qrBase64, 'base64');

      // Font selection (DejaVuSans/Arial if available)
      const fontCandidates = [
        path.join(__dirname, 'fonts', 'DejaVuSans.ttf'),
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/Library/Fonts/Arial.ttf',
        '/System/Library/Fonts/Supplemental/Arial.ttf'
      ];
      let fontPath = null;
      for (const f of fontCandidates) {
        try { if (fs.existsSync(f)) { fontPath = f; break; } } catch (e) {}
      }
      if (fontPath) {
        try { doc.registerFont('Main', fontPath); doc.font('Main'); } catch (e) { console.warn('Failed to register font', e); }
      } else {
        console.warn('No Cyrillic-capable font found; PDF may show garbled Cyrillic. Place a TTF (e.g. DejaVuSans.ttf) into server/fonts/ to fix.');
      }

      // Header
      doc.fontSize(20).text('СЧЕТ НА ОПЛАТУ', { align: 'center' });
      doc.moveDown(0.5);

      // Meta
      const metaX = doc.page.width - doc.options.margin - 220;
      doc.fontSize(10).text(`Номер: ${invoiceNumber || ''}`, metaX, 80);
      doc.text(`Дата: ${invoiceDate || new Date().toISOString().split('T')[0]}`, { align: 'right' });

      // Payer (Плательщик) and Recipient (Получатель) blocks side by side
      doc.moveDown(1);
      const leftStart = doc.x;
      const mid = doc.page.width / 2;

      // Payer block (from client)
      doc.fontSize(10).text('Плательщик:', leftStart, doc.y, { underline: true });
      doc.moveDown(0.2);
      if (payerName) {
        doc.fontSize(11).text(payerName, leftStart);
        if (payerInn) doc.text(`ИНН: ${payerInn}`);
        if (payerOgrn) doc.text(`ОГРН: ${payerOgrn}`);
        if (payerAddress) doc.text(`Юр. адрес: ${payerAddress}`);
      } else {
        doc.fontSize(11).text('-', leftStart);
      }

      // Recipient block on the right
      const recX = mid + 10;
      let recY = doc.y - 40; // align top approximately
      doc.fontSize(10).text('Получатель:', recX, recY, { underline: true });
      doc.moveDown(0.2);
      recY = doc.y;
      doc.fontSize(11).text(recipient, recX, recY);
      if (recipientInn) doc.text(`ИНН: ${recipientInn}`);
      if (legalAddress) doc.text(`Юр. адрес: ${legalAddress}`);
      doc.moveDown(0.5);

      // Bank details under recipient
      doc.fontSize(10).text('Банковские реквизиты:', recX);
      doc.text(`Р/с: ${account}`);
      doc.text(`Банк: ${bankName}`);
      doc.text(`БИК: ${bic}`);
      doc.text(`К/с: ${corrAccount}`);

      // Separator
      doc.moveDown(0.5);
      const sepY = doc.y;
      doc.moveTo(leftStart, sepY).lineTo(doc.page.width - doc.options.margin, sepY).stroke();

      // Table header
      doc.moveDown(0.5);
      const tableTop = doc.y;
      doc.fontSize(10).text('№', leftStart, tableTop);
      doc.text('Наименование', leftStart + 30, tableTop);
      doc.text('Кол-во', leftStart + 360, tableTop);
      doc.text('Цена', leftStart + 420, tableTop);
      doc.text('Сумма', leftStart + 480, tableTop);

      // Row
      const rowY = tableTop + 18;
      doc.fontSize(11).text('1', leftStart, rowY);
      doc.text(serviceName || '-', leftStart + 30, rowY, { width: 300 });
      doc.text('1', leftStart + 360, rowY);
      doc.text(Number(amount).toFixed(2) + ' ₽', leftStart + 420, rowY);
      doc.text(Number(amount).toFixed(2) + ' ₽', leftStart + 480, rowY);

      // Total
      doc.moveTo(leftStart, rowY + 30).lineTo(doc.page.width - doc.options.margin, rowY + 30).stroke();
      doc.fontSize(12).text('Итого:', leftStart + 360, rowY + 40);
      doc.text(Number(amount).toFixed(2) + ' ₽', leftStart + 480, rowY + 40);

      // QR
      const qrSize = 160;
      const qrX = doc.page.width - doc.options.margin - qrSize;
      const qrY = rowY + 10;
      doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });

      // Footer
      doc.moveDown(10);
      doc.fontSize(10).text('Назначение платежа: ' + `Оплата по счету: ${serviceName}`);
      doc.moveDown(2);
      doc.fontSize(10).text('Подпись получателя: ____________________', leftStart);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

// Инициализация базы данных
const db = new sqlite3.Database('helpdesk.db');

// Создание таблиц
db.serialize(() => {
  // Пользователи (администраторы и специалисты)
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'specialist')),
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Клиенты
  db.run(`CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_name TEXT NOT NULL,
    url TEXT,
    legal_name TEXT,
    legal_address TEXT,
    inn TEXT,
    ogrn TEXT,
    status TEXT NOT NULL DEFAULT 'in_development' CHECK(status IN ('in_development', 'working', 'needs_attention')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Тикеты
  db.run(`CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'resolved', 'closed')),
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
  )`);

  // Комментарии к тикетам
  db.run(`CREATE TABLE IF NOT EXISTS ticket_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    user_id INTEGER,
    client_id INTEGER,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (client_id) REFERENCES clients(id)
  )`);

  // Счета
  db.run(`CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    date DATE NOT NULL,
    comment TEXT,
    file_path TEXT,
    status TEXT NOT NULL DEFAULT 'unpaid' CHECK(status IN ('paid', 'unpaid')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id)
  )`);

  // Логины клиентов
  db.run(`CREATE TABLE IF NOT EXISTS client_logins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL UNIQUE,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
  )`);

  // Задачи
  db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'in_progress', 'completed')),
    deadline DATE,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
  )`);

  // Комментарии к задачам
  db.run(`CREATE TABLE IF NOT EXISTS task_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // Создание тестового администратора (пароль: admin123)
  const adminPassword = bcrypt.hashSync('admin123', 10);
  db.run(`INSERT OR IGNORE INTO users (email, password, role, name) 
    VALUES ('admin@obsidian.ru', ?, 'admin', 'Администратор')`, [adminPassword]);

  // Создание тестового специалиста (пароль: specialist123)
  const specialistPassword = bcrypt.hashSync('specialist123', 10);
  db.run(`INSERT OR IGNORE INTO users (email, password, role, name) 
    VALUES ('specialist@obsidian.ru', ?, 'specialist', 'Специалист')`, [specialistPassword]);
});

// Обработка OPTIONS запросов (preflight)
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
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

// Роуты авторизации
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка сервера' });
    }

    if (!user) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
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

// Роут для авторизации клиента (по email и паролю)
app.post('/api/auth/client-login', async (req, res) => {
  const { email, password, clientId } = req.body;

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
        return res.status(401).json({ error: 'Неверный email или пароль' });
      }

      const validPassword = await bcrypt.compare(password, clientLogin.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Неверный email или пароль' });
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

// Получить текущего пользователя
app.get('/api/auth/me', authenticateToken, (req, res) => {
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

// Роуты для клиентов
app.get('/api/clients', authenticateToken, requireRole('admin', 'specialist'), (req, res) => {
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

app.get('/api/clients/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const userRole = req.user.role;

  // Клиенты могут видеть только свои данные
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

app.post('/api/clients', authenticateToken, requireRole('admin'), (req, res) => {
  const { project_name, url, legal_name, legal_address, inn, ogrn, status } = req.body;

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

app.put('/api/clients/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const { project_name, url, legal_name, legal_address, inn, ogrn, status } = req.body;

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

app.delete('/api/clients/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;

  // Начинаем транзакцию для удаления всех связанных данных
  db.serialize(() => {
    // Сначала получаем все счета клиента для удаления файлов
    db.all('SELECT file_path FROM invoices WHERE client_id = ?', [id], (err, invoices) => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка при удалении клиента' });
      }

      // Удаляем файлы счетов
      invoices.forEach((invoice) => {
        if (invoice.file_path) {
          const rel = invoice.file_path.startsWith('/') ? invoice.file_path.slice(1) : invoice.file_path;
          const fullPath = path.join(__dirname, rel);
          fs.unlink(fullPath, (fsErr) => {
            if (fsErr) {
              console.warn('Failed to unlink invoice file:', fullPath, fsErr);
            }
          });
        }
      });

      // Удаляем все связанные данные клиента
      // Удаляем комментарии к тикетам
      db.run('DELETE FROM ticket_comments WHERE ticket_id IN (SELECT id FROM tickets WHERE client_id = ?)', [id], (err) => {
        if (err) console.error('Error deleting ticket comments:', err);

        // Удаляем тикеты
        db.run('DELETE FROM tickets WHERE client_id = ?', [id], (err) => {
          if (err) console.error('Error deleting tickets:', err);

          // Удаляем счета
          db.run('DELETE FROM invoices WHERE client_id = ?', [id], (err) => {
            if (err) console.error('Error deleting invoices:', err);

            // Удаляем комментарии к задачам
            db.run('DELETE FROM task_comments WHERE task_id IN (SELECT id FROM tasks WHERE client_id = ?)', [id], (err) => {
              if (err) console.error('Error deleting task comments:', err);

              // Удаляем задачи
              db.run('DELETE FROM tasks WHERE client_id = ?', [id], (err) => {
                if (err) console.error('Error deleting tasks:', err);

                // Удаляем логин клиента
                db.run('DELETE FROM client_logins WHERE client_id = ?', [id], (err) => {
                  if (err) console.error('Error deleting client login:', err);

                  // Удаляем самого клиента
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

// Роуты для тикетов
app.get('/api/tickets', authenticateToken, (req, res) => {
  const userRole = req.user.role;
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

app.get('/api/tickets/client/:clientId', authenticateToken, (req, res) => {
  const { clientId } = req.params;
  const userRole = req.user.role;

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

app.get('/api/tickets/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM tickets WHERE id = ?', [id], (err, ticket) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка при получении тикета' });
    }
    if (!ticket) {
      return res.status(404).json({ error: 'Тикет не найден' });
    }

    // Проверка прав доступа
    if (req.user.role === 'client' && ticket.client_id !== req.user.id) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    res.json(ticket);
  });
});

app.post('/api/tickets', authenticateToken, (req, res) => {
  const { client_id, title, description } = req.body;
  const userRole = req.user.role;

  // Клиенты могут создавать тикеты только для себя
  const actualClientId = userRole === 'client' ? req.user.id : client_id;

  if (!actualClientId || !title || !description) {
    return res.status(400).json({ error: 'Необходимо указать client_id, title и description' });
  }

  const createdBy = userRole !== 'client' ? req.user.id : null;

  db.run(
    `INSERT INTO tickets (client_id, title, description, created_by, status)
     VALUES (?, ?, ?, ?, 'open')`,
    [actualClientId, title, description, createdBy],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Ошибка при создании тикета' });
      }
      res.json({ id: this.lastID, client_id: actualClientId, title, description, status: 'open' });
    }
  );
});

app.put('/api/tickets/:id', authenticateToken, requireRole('admin', 'specialist'), (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  db.run(
    'UPDATE tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Ошибка при обновлении тикета' });
      }
      res.json({ message: 'Тикет обновлен' });
    }
  );
});

// Роуты для комментариев
app.get('/api/tickets/:id/comments', authenticateToken, (req, res) => {
  const { id } = req.params;

  // Проверка доступа к тикету
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

app.post('/api/tickets/:id/comments', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { message } = req.body;

  // Проверка доступа к тикету
  db.get('SELECT * FROM tickets WHERE id = ?', [id], (err, ticket) => {
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
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Ошибка при создании комментария' });
        }
        res.json({ id: this.lastID, message: 'Комментарий добавлен' });
      }
    );
  });
});

// Роуты для счетов
app.get('/api/invoices', authenticateToken, (req, res) => {
  const userRole = req.user.role;
  let query;
  let params = [];

  if (userRole === 'client') {
    query = `
      SELECT i.*, c.project_name
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      WHERE i.client_id = ?
      ORDER BY i.date DESC
    `;
    params = [req.user.id];
  } else {
    query = `
      SELECT i.*, c.project_name
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      ORDER BY i.date DESC
    `;
  }

  db.all(query, params, (err, invoices) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка при получении счетов' });
    }
    res.json(invoices);
  });
});

app.get('/api/invoices/client/:clientId', authenticateToken, (req, res) => {
  const { clientId } = req.params;
  const userRole = req.user.role;

  if (userRole === 'client' && parseInt(clientId) !== req.user.id) {
    return res.status(403).json({ error: 'Недостаточно прав' });
  }

  db.all(
    'SELECT * FROM invoices WHERE client_id = ? ORDER BY date DESC',
    [clientId],
    (err, invoices) => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка при получении счетов' });
      }
      res.json(invoices);
    }
  );
});

// Генерация PDF счета с QR (возвращает base64 PDF для предпросмотра)
app.post('/api/invoices/generate-pdf', authenticateToken, requireRole('admin'), async (req, res) => {
  const { client_id, amount, service_name } = req.body;

  if (!client_id || !amount || !service_name) {
    return res.status(400).json({ error: 'Необходимо указать client_id, amount и service_name' });
  }

  db.get('SELECT * FROM clients WHERE id = ?', [client_id], async (err, client) => {
    if (err) return res.status(500).json({ error: 'Ошибка сервера' });
    if (!client) return res.status(404).json({ error: 'Клиент не найден' });

    try {
      // Recipient static info (from your request)
      const recipient = 'НЕМКОВА СОФИЯ СЕРГЕЕВНА (ИП)';
      const recipientInn = '401110194908';
      const account = '40802810001480000058';
      const bankName = 'АО "АЛЬФА-БАНК"';
      const bic = '044525593';
      const corrAccount = '30101810200000000593';
      const legalAddress = 'Калужская область, г. Малоярославец';

      // Payer info taken from client record when available
      const payerName = client.legal_name || client.project_name || '';
      const payerAddress = client.legal_address || '';
      const payerInn = client.inn || '';
      const payerOgrn = client.ogrn || '';

      const invoiceDate = new Date().toISOString().split('T')[0];
      const invoiceNumber = `QR-${Date.now()}`;

      const pdfBuffer = await generateInvoicePdfBuffer({ recipient, recipientInn, bankName, bic, corrAccount, account, amount, serviceName: service_name, invoiceDate, invoiceNumber, legalAddress, payerName, payerInn, payerAddress, payerOgrn });
      const base64 = pdfBuffer.toString('base64');

      res.json({ pdf_base64: base64, filename: `invoice-${invoiceNumber}.pdf` });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Ошибка при генерации PDF' });
    }
  });
});

app.post('/api/invoices', authenticateToken, requireRole('admin'), upload.single('file'), (req, res) => {
  const { client_id, amount, date, comment } = req.body;
  const filePath = req.file ? `/uploads/invoices/${req.file.filename}` : null;

  db.run(
    `INSERT INTO invoices (client_id, amount, date, comment, file_path, status)
     VALUES (?, ?, ?, ?, ?, 'unpaid')`,
    [client_id, amount, date, comment || null, filePath],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Ошибка при создании счета' });
      }
      res.json({ 
        id: this.lastID, 
        client_id, 
        amount, 
        date, 
        comment, 
        file_path: filePath,
        status: 'unpaid'
      });
    }
  );
});

app.put('/api/invoices/:id/status', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  db.run(
    'UPDATE invoices SET status = ? WHERE id = ?',
    [status, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Ошибка при обновлении счета' });
      }
      res.json({ message: 'Статус счета обновлен' });
    }
  );
});

// Удалить счет (файл + запись в БД)
app.delete('/api/invoices/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM invoices WHERE id = ?', [id], (err, invoice) => {
    if (err) return res.status(500).json({ error: 'Ошибка сервера' });
    if (!invoice) return res.status(404).json({ error: 'Счет не найден' });

    db.run('DELETE FROM invoices WHERE id = ?', [id], function(deleteErr) {
      if (deleteErr) return res.status(500).json({ error: 'Ошибка при удалении счета' });

      // Удаляем файл, если есть
      if (invoice.file_path) {
        const rel = invoice.file_path.startsWith('/') ? invoice.file_path.slice(1) : invoice.file_path;
        const fullPath = path.join(__dirname, rel);
        fs.unlink(fullPath, (fsErr) => {
          if (fsErr) {
            console.warn('Failed to unlink invoice file:', fullPath, fsErr);
          }
          return res.json({ message: 'Счет удален' });
        });
      } else {
        return res.json({ message: 'Счет удален' });
      }
    });
  });
});

// Получить сумму задолженности для клиента
app.get('/api/invoices/debt/:clientId', authenticateToken, (req, res) => {
  const { clientId } = req.params;
  const userRole = req.user.role;

  if (userRole === 'client' && parseInt(clientId) !== req.user.id) {
    return res.status(403).json({ error: 'Недостаточно прав' });
  }

  db.get(
    `SELECT COALESCE(SUM(amount), 0) as total_debt
     FROM invoices
     WHERE client_id = ? AND status = 'unpaid'`,
    [clientId],
    (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка при расчете задолженности' });
      }
      res.json({ total_debt: result.total_debt });
    }
  );
});

// Роуты для задач (только для администраторов и специалистов)
app.get('/api/tasks/client/:clientId', authenticateToken, requireRole('admin', 'specialist'), (req, res) => {
  const { clientId } = req.params;

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

app.get('/api/tasks/:id', authenticateToken, requireRole('admin', 'specialist'), (req, res) => {
  const { id } = req.params;

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

app.post('/api/tasks', authenticateToken, requireRole('admin'), (req, res) => {
  const { client_id, title, description, deadline } = req.body;

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

app.put('/api/tasks/:id', authenticateToken, requireRole('admin', 'specialist'), (req, res) => {
  const { id } = req.params;
  const { title, description, status, deadline } = req.body;

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

app.delete('/api/tasks/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;

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

// Роуты для комментариев к задачам
app.get('/api/tasks/:id/comments', authenticateToken, requireRole('admin', 'specialist'), (req, res) => {
  const { id } = req.params;

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

app.post('/api/tasks/:id/comments', authenticateToken, requireRole('admin', 'specialist'), (req, res) => {
  const { id } = req.params;
  const { message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Необходимо указать сообщение' });
  }

  // Проверяем, существует ли задача
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

// Функция генерации случайного пароля
const generatePassword = (length = 12) => {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

// Получить информацию о логине клиента
app.get('/api/clients/:id/login', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;

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
app.post('/api/clients/:id/login', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { email, password } = req.body;

  // Проверяем, существует ли клиент
  db.get('SELECT * FROM clients WHERE id = ?', [id], async (err, client) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка сервера' });
    }

    if (!client) {
      return res.status(404).json({ error: 'Клиент не найден' });
    }

    // Проверяем, есть ли уже логин
    db.get('SELECT * FROM client_logins WHERE client_id = ?', [id], async (err, existingLogin) => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка сервера' });
      }

      if (existingLogin) {
        return res.status(400).json({ error: 'Логин для этого клиента уже существует' });
      }

      // Проверяем, не занят ли email
      if (email) {
        db.get('SELECT * FROM client_logins WHERE email = ?', [email], async (err, emailTaken) => {
          if (err) {
            return res.status(500).json({ error: 'Ошибка сервера' });
          }

          if (emailTaken) {
            return res.status(400).json({ error: 'Этот email уже используется' });
          }

          // Генерируем пароль, если не указан
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
                password: finalPassword, // Возвращаем пароль только при создании
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
app.put('/api/clients/:id/password', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword) {
    return res.status(400).json({ error: 'Необходимо указать новый пароль' });
  }

  // Проверяем, существует ли логин
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
          password: newPassword // Возвращаем новый пароль
        });
      }
    );
  });
});

// Сгенерировать новый пароль для клиента
app.post('/api/clients/:id/generate-password', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;

  // Проверяем, существует ли логин
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

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});


