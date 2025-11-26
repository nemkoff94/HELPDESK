# ⚡ QUICK_REFERENCE.md - Быстрый справочник

Этот файл содержит все самые важные команды и коды для копирования-вставки.

---

## 🚀 Команды для запуска

### Первый запуск проекта
```bash
git clone https://github.com/nemkoff94/HELPDESK.git
cd HELPDESK
npm run install-all
npm run dev
```

### Запуск отдельно
```bash
npm run server      # Только backend (http://localhost:5001)
npm run client      # Только frontend (http://localhost:3000)
npm run dev         # Оба одновременно
```

### Production build
```bash
cd client
npm run build       # Создаст /build папку
cd ..
./install.sh        # Deploy на сервер
```

---

## 🔐 Тестовые логины

```
Admin:
  Email: admin@obsidian.ru
  Pass: admin123

Specialist:
  Email: specialist@obsidian.ru
  Pass: specialist123

Client:
  Email: (из client_logins таблицы)
  Pass: (из client_logins таблицы)
```

---

## 📍 Важные пути

### Backend
```
server/index.js         # Главный файл сервера (ВСЕ API endpoints тут)
server/.env            # PORT, JWT_SECRET, CLIENT_ORIGIN
server/helpdesk.db     # База данных SQLite
```

### Frontend
```
client/src/App.tsx     # Router, все маршруты
client/src/api.js      # API client (Axios)
client/src/pages/      # Page components по ролям
client/src/context/    # AuthContext
```

---

## 🔌 API Endpoints (все 25+)

### Аутентификация
```
POST /api/auth/login
POST /api/auth/client-login
GET /api/auth/me
```

### Клиенты
```
GET    /api/clients
POST   /api/clients
GET    /api/clients/:id
PUT    /api/clients/:id
DELETE /api/clients/:id
GET    /api/clients/:id/login
POST   /api/clients/:id/login
```

### Тикеты
```
GET    /api/tickets
GET    /api/tickets/:id
GET    /api/tickets/client/:id
POST   /api/tickets
PUT    /api/tickets/:id
PUT    /api/tickets/:id/status
PUT    /api/tickets/:id/specialist
```

### Комментарии
```
GET    /api/comments
GET    /api/comments/ticket/:id
POST   /api/comments
DELETE /api/comments/:id
```

### Счета
```
GET    /api/invoices
GET    /api/invoices/client/:id
GET    /api/invoices/:id
POST   /api/invoices
POST   /api/invoices/generate     # С QR кодом
DELETE /api/invoices/:id
```

### Задачи
```
GET    /api/tasks
GET    /api/tasks/client/:id
GET    /api/tasks/:id
POST   /api/tasks
PUT    /api/tasks/:id
```

---

## 💻 Коды для копирования

### Backend - Простой endpoint

```javascript
app.get('/api/resource/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM resource WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: 'Error' });
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  });
});
```

### Backend - POST endpoint

```javascript
app.post('/api/resource', authenticateToken, requireRole('admin'), (req, res) => {
  const { name, description } = req.body;
  
  if (!name) return res.status(400).json({ error: 'Name required' });
  
  db.run(
    'INSERT INTO resource (name, description) VALUES (?, ?)',
    [name, description],
    function(err) {
      if (err) return res.status(500).json({ error: 'Error' });
      res.json({ id: this.lastID, name, description });
    }
  );
});
```

### Backend - Middleware для защиты

```javascript
// Всегда добавляй эти middleware к защищённым endpoints:
app.get('/api/admin-only', authenticateToken, requireRole('admin'), (req, res) => {
  // Только админы могут сюда попасть
  res.json({ message: 'Admin access granted' });
});
```

### Frontend - Компонент с API запросом

```javascript
import React, { useState, useEffect } from 'react';
import api from '../../api';
import { useParams } from 'react-router-dom';

const MyComponent = () => {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await api.get(`/resource/${id}`);
        setData(response.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Network error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!data) return <div>No data</div>;

  return <div>{/* Render data */}</div>;
};

export default MyComponent;
```

### Frontend - Form submission

```javascript
const handleSubmit = async (e) => {
  e.preventDefault();
  try {
    setLoading(true);
    const response = await api.post('/resource', formData);
    navigate(`/resource/${response.data.id}`);
  } catch (error) {
    setError(error.response?.data?.error || 'Error');
  } finally {
    setLoading(false);
  }
};
```

### Frontend - Protected Route

```javascript
import { ProtectedRoute } from '../../components/ProtectedRoute';

<Route
  path="/admin/resource/:id"
  element={
    <ProtectedRoute allowedRoles={['admin']}>
      <ResourceDetail />
    </ProtectedRoute>
  }
/>
```

### Frontend - Conditional render by role

```javascript
import { useAuth } from '../../hooks/useAuth';

export const MyComponent = () => {
  const { user } = useAuth();
  
  return (
    <>
      {user?.role === 'admin' && <div>Admin only content</div>}
      {user?.role === 'specialist' && <div>Specialist content</div>}
      {user?.role === 'client' && <div>Client content</div>}
    </>
  );
};
```

### Frontend - Tailwind styling

```javascript
<div className="flex gap-4 p-6 bg-white rounded-lg shadow-md border border-gray-200">
  <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400">
    Primary Button
  </button>
  <button className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
    Danger Button
  </button>
  <button className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400">
    Secondary Button
  </button>
</div>
```

---

## 🗄️ Таблицы БД - Создание

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_name TEXT NOT NULL,
  url TEXT,
  legal_name TEXT,
  legal_address TEXT,
  inn TEXT,
  ogrn TEXT,
  status TEXT DEFAULT 'in_development',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open',
  assigned_to INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL,
  author_id INTEGER,
  text TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  description TEXT,
  pdf_path TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  deadline DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);
```

---

## 🔍 Git команды

```bash
# Создание branch для новой функции
git checkout -b feature/new-feature

# Проверка изменений
git status
git diff

# Сохранение изменений
git add .
git commit -m "feat: добавл новую функцию"

# Загрузка на GitHub
git push origin feature/new-feature

# Слияние с main
git checkout main
git pull origin main
git merge feature/new-feature
git push origin main
```

---

## 🧪 Тестирование API (curl примеры)

```bash
# Login
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@obsidian.ru","password":"admin123"}'

# Get clients
curl -X GET http://localhost:5001/api/clients \
  -H "Authorization: Bearer YOUR_TOKEN"

# Create ticket
curl -X POST http://localhost:5001/api/tickets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"title":"Bug report","description":"Something is broken"}'

# Update ticket status
curl -X PUT http://localhost:5001/api/tickets/1/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"status":"closed"}'
```

---

## 📝 Переменные окружения (.env)

```env
# Backend (.env в папке server/)
PORT=5001
JWT_SECRET=obsidian-secret-key-change-in-production
NODE_ENV=production
CLIENT_ORIGIN=https://obs-panel.ru
```

---

## 📊 Статусы и роли

### Ticket статусы
```
'open'         # Новый тикет
'in_progress'  # В работе
'closed'       # Закрыт
```

### Client статусы
```
'in_development'  # Разработка
'in_progress'     # В процессе
'completed'       # Завершён
'paused'          # На паузе
```

### User роли
```
'admin'       # Администратор (полный доступ)
'specialist'  # Специалист (тикеты и клиенты)
'client'      # Клиент (свои тикеты и счета)
```

---

## 🎨 Tailwind цветовая схема

```javascript
// Используемые цвета:
'bg-blue-600'       // Primary (основной)
'bg-green-600'      // Success
'bg-red-600'        // Error/Danger
'bg-yellow-600'     // Warning
'bg-gray-*'         // Neutral (50-900)

// Примеры:
'text-white'
'border-gray-300'
'hover:bg-blue-700'
'disabled:bg-gray-400'
'rounded-lg'        // Скруглённые углы
'shadow-md'         // Тень
'px-4 py-2'        // Паддинг
'gap-4'            // Промежуток между элементами
```

---

## 🆘 Быстрое решение проблем

### Сервер не запускается
```bash
# Проверить, какой процесс занимает порт 5001
lsof -ti:5001 | xargs kill -9

# Или изменить PORT в .env
PORT=5002
```

### БД повреждена / заблокирована
```bash
# Удалить и пересоздать БД
rm server/helpdesk.db
npm run server
```

### CORS ошибка
```javascript
// Проверить ALLOWED_ORIGINS в server/index.js
// Добавить текущий хост, например:
'http://localhost:3001'
```

### Токен не работает
```bash
# Проверить JWT_SECRET в .env и server/index.js
# Перелогиниться (токен истёк через 24 часа)
```

### React компонент не обновляется
```javascript
// Используй key prop для Lists:
{items.map(item => <Item key={item.id} {...item} />)}

// Или useEffect зависимости:
useEffect(() => { fetchData() }, [id])
```

---

## 📞 Важные числа

```
PORT backend:        5001
PORT frontend:       3000
JWT expiry:          24h
Pagination default:  20 items
Max upload size:     50MB (nginx)
Database:            SQLite (helpdesk.db)
```

---

## 🚀 Production deployment (одна строка)

```bash
ssh user@obs-panel.ru && cd /path/to/HELPDESK && ./install.sh
```

---

## 📚 Дополнительно

**Нужен полный пример?** → [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md)  
**Нужна карта кода?** → [CODE_MAP.md](./CODE_MAP.md)  
**Нужна архитектура?** → [ARCHITECTURE.md](./ARCHITECTURE.md)  
**Полный индекс?** → [PROJECT_INDEX.md](./PROJECT_INDEX.md)  

---

**Последнее обновление:** 26 ноября 2025
