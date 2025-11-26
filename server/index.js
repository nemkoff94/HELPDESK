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
const cron = require('node-cron');
const https = require('https');
const http = require('http');
const { URL } = require('url');
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

  // Услуги
  db.run(`CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
  )`);

  // Заказы услуг клиентами
  db.run(`CREATE TABLE IF NOT EXISTS service_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    service_id INTEGER NOT NULL,
    ticket_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id),
    FOREIGN KEY (ticket_id) REFERENCES tickets(id)
  )`);

  // Виджет: Статус рекламных кампаний
  db.run(`CREATE TABLE IF NOT EXISTS ad_campaign_widgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL UNIQUE,
    enabled BOOLEAN DEFAULT 1,
    monthly_budget REAL NOT NULL,
    recommended_budget REAL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused', 'stopped')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
  )`);

  // Виджет: Календарь обязательных обновлений
  db.run(`CREATE TABLE IF NOT EXISTS renewal_calendar_widgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL UNIQUE,
    enabled BOOLEAN DEFAULT 0,
    domain_renewal_date DATE,
    hosting_renewal_date DATE,
    ssl_renewal_date DATE,
    ssl_auto_renewal BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
  )`);

  // Виджет: Рекомендации
  db.run(`CREATE TABLE IF NOT EXISTS recommendations_widgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL UNIQUE,
    enabled BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
  )`);

  // Рекомендации (записи в виджет)
  db.run(`CREATE TABLE IF NOT EXISTS recommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    widget_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    cost REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (widget_id) REFERENCES recommendations_widgets(id) ON DELETE CASCADE
  )`);

  // Виджет: Доступность сайта
  db.run(`CREATE TABLE IF NOT EXISTS site_availability_widgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL UNIQUE,
    enabled BOOLEAN DEFAULT 0,
    site_url TEXT,
    last_check_time DATETIME,
    last_check_status TEXT,
    last_check_message TEXT,
    last_screenshot_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
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

// Удалить тикет (полное удаление с комментариями и связанными заказами услуг)
app.delete('/api/tickets/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM tickets WHERE id = ?', [id], (err, ticket) => {
    if (err) return res.status(500).json({ error: 'Ошибка сервера' });
    if (!ticket) return res.status(404).json({ error: 'Тикет не найден' });

    // Удаляем комментарии к тикету
    db.run('DELETE FROM ticket_comments WHERE ticket_id = ?', [id], (err) => {
      if (err) console.error('Error deleting ticket comments:', err);

      // Удаляем связи в service_orders, где ticket_id ссылается на этот тикет
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

          res.json({ message: 'Тикет удален' });
        });
      });
    });
  });
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

// Роуты для услуг
app.get('/api/services', authenticateToken, (req, res) => {
  const userRole = req.user.role;
  
  // Клиенты и специалисты видят только опубликованные услуги
  // Администраторы видят все
  let query = 'SELECT * FROM services ORDER BY name ASC';
  
  db.all(query, [], (err, services) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка при получении услуг' });
    }
    res.json(services);
  });
});

app.get('/api/services/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM services WHERE id = ?', [id], (err, service) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка при получении услуги' });
    }
    if (!service) {
      return res.status(404).json({ error: 'Услуга не найдена' });
    }
    res.json(service);
  });
});

app.post('/api/services', authenticateToken, requireRole('admin'), (req, res) => {
  const { name, description, price } = req.body;

  if (!name || price === undefined || price === null) {
    return res.status(400).json({ error: 'Необходимо указать name и price' });
  }

  db.run(
    `INSERT INTO services (name, description, price, created_by)
     VALUES (?, ?, ?, ?)`,
    [name, description || null, parseFloat(price), req.user.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Ошибка при создании услуги' });
      }
      res.json({ id: this.lastID, name, description, price, created_by: req.user.id });
    }
  );
});

app.put('/api/services/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const { name, description, price } = req.body;

  if (!name || price === undefined || price === null) {
    return res.status(400).json({ error: 'Необходимо указать name и price' });
  }

  db.run(
    `UPDATE services 
     SET name = ?, description = ?, price = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [name, description || null, parseFloat(price), id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Ошибка при обновлении услуги' });
      }
      res.json({ message: 'Услуга обновлена' });
    }
  );
});

app.delete('/api/services/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM services WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Ошибка при удалении услуги' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Услуга не найдена' });
    }
    res.json({ message: 'Услуга удалена' });
  });
});

// Роут для заказа услуги (создает тикет)
app.post('/api/services/:id/order', authenticateToken, (req, res) => {
  const { id } = req.params;
  const userRole = req.user.role;

  if (userRole !== 'client') {
    return res.status(403).json({ error: 'Только клиенты могут заказывать услуги' });
  }

  const clientId = req.user.id;

  // Получаем информацию об услуге
  db.get('SELECT * FROM services WHERE id = ?', [id], (err, service) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка сервера' });
    }
    if (!service) {
      return res.status(404).json({ error: 'Услуга не найдена' });
    }

    // Создаем тикет с темой "Заказана услуга"
    db.run(
      `INSERT INTO tickets (client_id, title, description, status)
       VALUES (?, ?, ?, 'open')`,
      [clientId, 'Заказана услуга', service.name],
      function(ticketErr) {
        if (ticketErr) {
          return res.status(500).json({ error: 'Ошибка при создании тикета' });
        }

        const ticketId = this.lastID;

        // Записываем заказ услуги
        db.run(
          `INSERT INTO service_orders (client_id, service_id, ticket_id)
           VALUES (?, ?, ?)`,
          [clientId, id, ticketId],
          function(orderErr) {
            if (orderErr) {
              return res.status(500).json({ error: 'Ошибка при создании заказа' });
            }

            res.json({
              id: this.lastID,
              service_id: id,
              ticket_id: ticketId,
              message: 'Услуга успешно заказана'
            });
          }
        );
      }
    );
  });
});

// Роут для смены пароля администратора
app.put('/api/auth/change-password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;
  const userRole = req.user.role;

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

    // Проверяем текущий пароль
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Текущий пароль неверный' });
    }

    // Хешируем новый пароль
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

// Роут для создания нового пользователя (только администратор)
app.post('/api/auth/create-user', authenticateToken, requireRole('admin'), async (req, res) => {
  const { email, password, role, name } = req.body;

  if (!email || !password || !role || !name) {
    return res.status(400).json({ error: 'Необходимо указать email, password, role и name' });
  }

  if (!['admin', 'specialist'].includes(role)) {
    return res.status(400).json({ error: 'Role должна быть admin или specialist' });
  }

  // Проверяем, не существует ли уже пользователь с этим email
  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, existingUser) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка сервера' });
    }

    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с этим email уже существует' });
    }

    // Хешируем пароль
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

// Получить список всех пользователей (кроме текущего пользователя)
app.get('/api/auth/users', authenticateToken, requireRole('admin'), (req, res) => {
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

// Удалить пользователя
app.delete('/api/auth/users/:userId', authenticateToken, requireRole('admin'), (req, res) => {
  const { userId } = req.params;

  // Не позволяем удалить текущего пользователя
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

// ========== ВИДЖЕТЫ ==========

// Виджет: Статус рекламных кампаний
// Получить виджет рекламных кампаний для клиента
app.get('/api/widgets/ad-campaign/:clientId', authenticateToken, (req, res) => {
  const { clientId } = req.params;
  const userRole = req.user.role;

  // Клиенты могут видеть только свои виджеты
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

// Создать или обновить виджет рекламных кампаний (администратор)
app.post('/api/widgets/ad-campaign/:clientId', authenticateToken, requireRole('admin'), (req, res) => {
  const { clientId } = req.params;
  const { enabled, monthly_budget, recommended_budget, status } = req.body;

  if (monthly_budget === undefined || monthly_budget === null) {
    return res.status(400).json({ error: 'Необходимо указать monthly_budget' });
  }

  // Проверяем, существует ли виджет
  db.get(
    'SELECT * FROM ad_campaign_widgets WHERE client_id = ?',
    [clientId],
    (err, existingWidget) => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка сервера' });
      }

      if (existingWidget) {
        // Обновляем существующий виджет
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
        // Создаем новый виджет
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

// Виджет: Календарь обязательных обновлений
// Получить виджет календаря обновлений для клиента
app.get('/api/widgets/renewal-calendar/:clientId', authenticateToken, (req, res) => {
  const { clientId } = req.params;
  const userRole = req.user.role;

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
      res.json(widget || null);
    }
  );
});

// Создать или обновить виджет календаря обновлений (администратор)
app.post('/api/widgets/renewal-calendar/:clientId', authenticateToken, requireRole('admin'), (req, res) => {
  const { clientId } = req.params;
  const { enabled, domain_renewal_date, hosting_renewal_date, ssl_renewal_date, ssl_auto_renewal } = req.body;

  // Проверяем, существует ли виджет
  db.get(
    'SELECT * FROM renewal_calendar_widgets WHERE client_id = ?',
    [clientId],
    (err, existingWidget) => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка сервера' });
      }

      if (existingWidget) {
        // Обновляем существующий виджет
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
        // Создаем новый виджет
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

// Виджет: Рекомендации
// Получить виджет рекомендаций для клиента
app.get('/api/widgets/recommendations/:clientId', authenticateToken, (req, res) => {
  const { clientId } = req.params;
  const userRole = req.user.role;

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

      // Получаем все рекомендации для этого виджета
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

// Создать или обновить виджет рекомендаций (администратор)
app.post('/api/widgets/recommendations/:clientId', authenticateToken, requireRole('admin'), (req, res) => {
  const { clientId } = req.params;
  const { enabled } = req.body;

  db.get(
    'SELECT * FROM recommendations_widgets WHERE client_id = ?',
    [clientId],
    (err, existingWidget) => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка сервера' });
      }

      if (existingWidget) {
        // Обновляем существующий виджет
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
        // Создаем новый виджет
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

// Добавить рекомендацию в виджет (администратор)
app.post('/api/widgets/recommendations/:clientId/add', authenticateToken, requireRole('admin'), (req, res) => {
  const { clientId } = req.params;
  const { title, description, cost } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Необходимо указать title' });
  }

  // Получаем виджет рекомендаций для этого клиента
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

      // Добавляем новую рекомендацию
      db.run(
        `INSERT INTO recommendations (widget_id, title, description, cost)
         VALUES (?, ?, ?, ?)`,
        [widget.id, title, description || null, cost || null],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Ошибка при добавлении рекомендации' });
          }
          res.json({ id: this.lastID, message: 'Рекомендация добавлена' });
        }
      );
    }
  );
});

// Удалить рекомендацию (администратор)
app.delete('/api/widgets/recommendations/:recommendationId', authenticateToken, requireRole('admin'), (req, res) => {
  const { recommendationId } = req.params;

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

// Принять рекомендацию и создать тикет (клиент)
app.post('/api/widgets/recommendations/:recommendationId/accept', authenticateToken, (req, res) => {
  const { recommendationId } = req.params;
  const userRole = req.user.role;

  if (userRole !== 'client') {
    return res.status(403).json({ error: 'Только клиенты могут принимать рекомендации' });
  }

  const clientId = req.user.id;

  // Получаем рекомендацию
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

      // Проверяем, что рекомендация принадлежит этому клиенту
      if (recommendation.client_id !== clientId) {
        return res.status(403).json({ error: 'Недостаточно прав' });
      }

      // Создаем тикет на основе рекомендации
      db.run(
        `INSERT INTO tickets (client_id, title, description, status)
         VALUES (?, ?, ?, 'open')`,
        [clientId, recommendation.title, recommendation.description || ''],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Ошибка при создании тикета' });
          }
          res.json({ 
            id: this.lastID, 
            message: 'Рекомендация принята, создан новый тикет' 
          });
        }
      );
    }
  );
});

// Виджет: Доступность сайта
// Получить виджет доступности сайта для клиента
app.get('/api/widgets/site-availability/:clientId', authenticateToken, (req, res) => {
  const { clientId } = req.params;
  const userRole = req.user.role;

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

// Создать или обновить виджет доступности сайта (администратор)
app.post('/api/widgets/site-availability/:clientId', authenticateToken, requireRole('admin'), (req, res) => {
  const { clientId } = req.params;
  const { enabled, site_url } = req.body;

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
        // Обновляем существующий виджет
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
        // Создаем новый виджет
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

// Функция для проверки доступности сайта и снятия скриншота
const checkSiteAvailability = async (url, clientId) => {
  try {
    // Проверяем доступность сайта
    return await new Promise((resolve) => {
      const urlObj = new URL(url);
      const protocol = urlObj.protocol === 'https:' ? https : http;

      const req = protocol.get(url, { timeout: 15000 }, (res) => {
        // Если статус код 2xx или 3xx - сайт доступен
        if (res.statusCode >= 200 && res.statusCode < 400) {
          // Простое создание "скриншота" - сохраняем информацию о проверке
          const timestamp = new Date().toISOString();
          const screenshotsDir = path.join(__dirname, 'uploads', 'screenshots');
          
          if (!fs.existsSync(screenshotsDir)) {
            fs.mkdirSync(screenshotsDir, { recursive: true });
          }

          // Создаём простой HTML файл как "скриншот"
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

// Крон-задача для проверки доступности сайтов каждый день в 04:00
const screenshotCron = cron.schedule('0 4 * * *', async () => {
  console.log('Запуск задачи проверки доступности сайтов...');
  
  db.all(
    'SELECT * FROM site_availability_widgets WHERE enabled = 1',
    async (err, widgets) => {
      if (err) {
        console.error('Ошибка при получении виджетов доступности:', err);
        return;
      }

      for (const widget of widgets) {
        if (!widget.site_url) continue;

        console.log(`Проверка сайта для клиента ${widget.client_id}: ${widget.site_url}`);
        const result = await checkSiteAvailability(widget.site_url, widget.client_id);

        // Удаляем старый скриншот если есть
        if (widget.last_screenshot_path) {
          const oldPath = path.join(__dirname, widget.last_screenshot_path.startsWith('/') ? widget.last_screenshot_path.slice(1) : widget.last_screenshot_path);
          fs.unlink(oldPath, (err) => {
            if (err) console.warn('Не удалось удалить старый скриншот:', err);
          });
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
              if (err) console.error('Ошибка при обновлении виджета:', err);
              else console.log(`Сайт доступен для клиента ${widget.client_id}`);
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
              if (err) console.error('Ошибка при обновлении виджета:', err);
              else console.log(`Ошибка при проверке клиента ${widget.client_id}: ${result.error}`);
            }
          );
        }
      }
    }
  );
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  console.log('Крон-задача снятия скриншотов активирована');
});

// Админ-эндпоинт: инициализировать виджеты для всех клиентов, у которых их нет
app.post('/api/widgets/init', authenticateToken, requireRole('admin'), (req, res) => {
  db.all('SELECT id, url FROM clients', [], (err, clients) => {
    if (err) return res.status(500).json({ error: 'Ошибка при чтении клиентов' });

    clients.forEach(client => {
      const clientId = client.id;

      // ad_campaign
      db.get('SELECT id FROM ad_campaign_widgets WHERE client_id = ?', [clientId], (err, row) => {
        if (!row) {
          db.run(`INSERT INTO ad_campaign_widgets (client_id, enabled, monthly_budget, recommended_budget, status) VALUES (?, 1, 0, 0, 'active')`, [clientId]);
        }
      });

      // renewal_calendar
      db.get('SELECT id FROM renewal_calendar_widgets WHERE client_id = ?', [clientId], (err, row) => {
        if (!row) {
          db.run(`INSERT INTO renewal_calendar_widgets (client_id, enabled, domain_renewal_date, hosting_renewal_date, ssl_renewal_date, ssl_auto_renewal) VALUES (?, 1, NULL, NULL, NULL, 0)`, [clientId]);
        }
      });

      // recommendations
      db.get('SELECT id FROM recommendations_widgets WHERE client_id = ?', [clientId], (err, row) => {
        if (!row) {
          db.run(`INSERT INTO recommendations_widgets (client_id, enabled) VALUES (?, 1)`, [clientId], function(err) {
            if (err) console.error('Ошибка при создании recommendations_widgets:', err);
          });
        }
      });

      // site_availability
      db.get('SELECT id FROM site_availability_widgets WHERE client_id = ?', [clientId], (err, row) => {
        if (!row) {
          db.run(`INSERT INTO site_availability_widgets (client_id, enabled, site_url, last_check, status) VALUES (?, 1, ?, CURRENT_TIMESTAMP, 'unknown')`, [clientId, client.url || null]);
        }
      });
    });

    res.json({ message: 'Инициализация виджетов запущена' });
  });
});


