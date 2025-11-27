const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

// Import modules
const { initializeDatabase } = require('./database');
const { initializeCronJobs } = require('./cron');
const { initializeTelegramBot } = require('./lib/telegramBot');

// Import routes
const { router: authRouter } = require('./routes/auth');
const clientsRouter = require('./routes/clients');
const ticketsRouter = require('./routes/tickets');
const invoicesRouter = require('./routes/invoices');
const tasksRouter = require('./routes/tasks');
const servicesRouter = require('./routes/services');
const { router: widgetsRouter } = require('./routes/widgets');
const telegramRouter = require('./routes/telegram');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware Setup
// Configure CORS
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
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
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

// Database Initialization
const db = new sqlite3.Database('helpdesk.db');
initializeDatabase(db);

// Telegram Bot Initialization
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (TELEGRAM_BOT_TOKEN) {
  initializeTelegramBot(TELEGRAM_BOT_TOKEN, db);
} else {
  console.warn('⚠️  TELEGRAM_BOT_TOKEN не найден. Telegram интеграция отключена.');
}

// Middleware to attach db to requests
app.use((req, res, next) => {
  req.db = db;
  next();
});

// Обработка OPTIONS запросов (preflight)
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// API Routes
app.use('/api', authRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/services', servicesRouter);
app.use('/api/widgets', widgetsRouter);
app.use('/api', telegramRouter);

// Start Server
const server = app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  
  // Initialize cron jobs
  initializeCronJobs(db);
});

server.on('error', (err) => {
  console.error('Server error:', err);
  if (err && err.code === 'EADDRINUSE') {
    console.error(`Порт ${PORT} уже занят. Проверьте запущенные процессы.`);
  }
});
