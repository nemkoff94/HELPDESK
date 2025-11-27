const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

/**
 * Инициализирует базу данных и создает таблицы
 * @param {sqlite3.Database} db - Экземпляр БД SQLite
 */
const initializeDatabase = (db) => {
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

    // Кастомные обновления для календаря (создаются администратором для конкретного клиента)
    db.run(`CREATE TABLE IF NOT EXISTS renewal_custom_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      widget_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      date DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (widget_id) REFERENCES renewal_calendar_widgets(id) ON DELETE CASCADE
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
};

module.exports = {
  initializeDatabase
};
