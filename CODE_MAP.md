# 🗺️ CODE_MAP.md - Карта кода для быстрого поиска

Этот документ помогает быстро найти нужные части кода при разработке новых функций.

---

## 🔍 Быстрый поиск по функциям

### Backend (server/index.js)

| Функция | Строки | Описание |
|---------|--------|---------|
| **Imports & Setup** | 1-50 | Dependencies, port, JWT secret |
| **CORS Config** | 32-45 | Allowed origins, preflight handling |
| **Multer Setup** | 50-70 | File upload configuration |
| **generateInvoicePdfBuffer()** | 73-170 | PDF + QR code generation |
| **Database Init** | 172-320 | Create all tables if not exists |
| **authenticateToken** | 325-345 | JWT verification middleware |
| **requireRole()** | 347-360 | Role-based access middleware |
| **POST /auth/login** | 365-395 | Admin/specialist login |
| **POST /auth/client-login** | 397-480 | Client login (email or ID) |
| **GET /auth/me** | 482-510 | Get current user |
| **GET /clients** | 515-540 | List all clients |
| **GET /clients/:id** | 542-560 | Get client details |
| **POST /clients** | 562-590 | Create new client |
| **PUT /clients/:id** | 592-630 | Update client |
| **DELETE /clients/:id** | 632-655 | Delete client |
| **GET /clients/:id/login** | 657-680 | Get client credentials |
| **POST /clients/:id/login** | 682-730 | Create/update client login |
| **GET /tickets** | 735-760 | List all tickets |
| **GET /tickets/:id** | 762-785 | Get ticket details |
| **GET /tickets/client/:id** | 787-810 | Get tickets for client |
| **POST /tickets** | 812-850 | Create ticket |
| **PUT /tickets/:id** | 852-895 | Update ticket |
| **PUT /tickets/:id/status** | 897-920 | Change ticket status |
| **PUT /tickets/:id/specialist** | 922-945 | Assign specialist |
| **GET /comments** | 950-975 | List all comments |
| **GET /comments/ticket/:id** | 977-1000 | Get comments for ticket |
| **POST /comments** | 1002-1045 | Create comment |
| **DELETE /comments/:id** | 1047-1080 | Delete comment |
| **GET /invoices** | 1085-1110 | List all invoices |
| **GET /invoices/client/:id** | 1112-1135 | Get invoices for client |
| **POST /invoices** | 1137-1175 | Create invoice |
| **POST /invoices/generate** | 1177-1250 | Generate invoice with QR |
| **DELETE /invoices/:id** | 1252-1280 | Delete invoice |
| **GET /tasks** | 1285-1310 | List all tasks |
| **GET /tasks/client/:id** | 1312-1335 | Get tasks for client |
| **POST /tasks** | 1337-1360 | Create task |
| **app.listen()** | 1362 | Server startup |

---

## 📄 Frontend File Map

### Pages

| File | Path | Роли | Описание |
|------|------|------|---------|
| **Login.js** | `/pages/` | all | Единый экран входа для всех ролей |
| **ClientsList.js** | `/pages/admin/` | admin | Список всех клиентов |
| **ClientDetail.js** | `/pages/admin/` | admin | Деталь клиента (4 табы) |
| **NewClient.js** | `/pages/admin/` | admin | Форма создания клиента |
| **TicketDetail.js** | `/pages/admin/` | admin,specialist | Деталь тикета |
| **TaskDetail.js** | `/pages/admin/` | admin,specialist | Деталь задачи |
| **NewTicket.js** | `/pages/admin/` | admin | Создание тикета |
| **NewInvoice.js** | `/pages/admin/` | admin | Создание счёта |
| **Dashboard.js** | `/pages/client/` | client | Главная страница клиента |
| **TicketsList.js** | `/pages/client/` | client | Список тикетов клиента |
| **TicketDetail.js** | `/pages/client/` | client | Деталь тикета (читалка) |
| **NewTicket.js** | `/pages/client/` | client | Создание тикета |
| **InvoicesList.js** | `/pages/client/` | client | Список счетов |
| **ClientsList.js** | `/pages/specialist/` | specialist | Клиенты для специалиста |
| **TicketDetail.js** | `/pages/specialist/` | specialist | Деталь тикета |

### Components

| File | Назначение | Props |
|------|-----------|-------|
| **Layout.js** | Обёртка с навигацией | children |
| **ProtectedRoute.js** | Guard для маршрутов | allowedRoles, children |
| **ConfirmModal.js** | Модаль подтверждения | title, message, onConfirm, onCancel |

### Context & Hooks

| File | Назначение |
|------|-----------|
| **AuthContext.js** | Провайдер аутентификации (user, token, login, logout) |
| **useAuth.js** | Hook для доступа к auth контексту |

---

## 🔑 Ключевые переменные и константы

### Backend

```javascript
PORT = 5001
JWT_SECRET = 'obsidian-secret-key-change-in-production'
CLIENT_ORIGIN = 'https://obs-panel.ru'
ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://obs-panel.ru',
  'https://www.obs-panel.ru'
]

// Реквизиты ИП для счетов
recipient = 'НЕМКОВА СОФИЯ СЕРГЕЕВНА (ИП)'
recipientInn = '401110194908'
account = '40802810001480000058'
bankName = 'АО "АЛЬФА-БАНК"'
bic = '044525593'
corrAccount = '30101810200000000593'
```

### Frontend

```javascript
API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api'

// User roles
'admin'      // Полный доступ
'specialist' // Просмотр, редактирование тикетов
'client'     // Создание тикетов, просмотр своих

// Ticket statuses
'open'
'in_progress'
'closed'

// Client statuses
'in_development'
'in_progress'
'completed'
'paused'
```

---

## 🛠️ Где искать нужную функцию?

### Нужно добавить...

**...новый API endpoint?**
1. Найди похожий endpoint в `server/index.js`
2. Скопируй структуру
3. Замени SQL query
4. Добавь middleware для защиты
5. Тестируй через Postman/curl

**...новую страницу для админа?**
1. Создай файл в `client/src/pages/admin/NewPage.js`
2. Посмотри на `ClientsList.js` как пример
3. Используй API из `api.js`
4. Добавь маршрут в `App.tsx`

**...новую роль?**
1. Добавь в `users` таблицу новый role (в `server/index.js`)
2. Добавь проверку в `requireRole()`
3. Добавь маршруты в `App.tsx`
4. Создай новый folder в `pages/`

**...обработку ошибок?**
1. Обертни в try-catch
2. В backend: `return res.status(500).json({ error: '...' })`
3. В frontend: `setError(error.response?.data?.error)`

**...защиту данных?**
1. Добавь `authenticateToken` middleware
2. Добавь `requireRole('admin')` если нужна роль
3. Проверь `req.user.id` для изоляции данных

**...файлы (PDF, изображения)?**
1. Используй `multer` в backend
2. Сохраняй в `/uploads` папку
3. Верни URL в response
4. Используй `<a href>` или `<img>` в frontend

---

## 🔄 Типичные операции

### Получить данные с API

```javascript
// В frontend компоненте
useEffect(() => {
  api.get('/tickets')
    .then(res => setTickets(res.data))
    .catch(err => setError(err.response?.data?.error));
}, []);
```

### Отправить форму

```javascript
const handleSubmit = async (e) => {
  e.preventDefault();
  try {
    const res = await api.post('/tickets', { title, description });
    navigate(`/tickets/${res.data.id}`);
  } catch (err) {
    setError(err.response?.data?.error);
  }
};
```

### Защитить маршрут

```javascript
<Route
  path="/admin"
  element={
    <ProtectedRoute allowedRoles={['admin']}>
      <AdminPage />
    </ProtectedRoute>
  }
/>
```

### Добавить иконку/кнопку

```javascript
<button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
  Action
</button>
```

### Фильтровать по ролям

```javascript
import { useAuth } from '../hooks/useAuth';

const MyComponent = () => {
  const { user } = useAuth();
  
  return (
    <>
      {user?.role === 'admin' && <AdminPanel />}
      {user?.role === 'client' && <ClientPanel />}
    </>
  );
};
```

---

## 🗄️ Таблицы БД

### Диаграмма связей

```
users
  ├─ id
  ├─ email (UNIQUE)
  ├─ password_hash
  ├─ role (admin, specialist)
  └─ name

clients
  ├─ id
  ├─ project_name
  ├─ url
  ├─ legal_name
  ├─ legal_address
  ├─ inn
  ├─ ogrn
  └─ status

client_logins
  ├─ id
  ├─ client_id → clients.id
  ├─ email
  └─ password

tickets
  ├─ id
  ├─ client_id → clients.id
  ├─ title
  ├─ description
  ├─ status
  ├─ assigned_to → users.id (nullable)
  └─ created_at

comments
  ├─ id
  ├─ ticket_id → tickets.id
  ├─ author_id → users.id
  ├─ text
  └─ created_at

invoices
  ├─ id
  ├─ client_id → clients.id
  ├─ amount
  ├─ description
  ├─ pdf_path
  └─ created_at

tasks
  ├─ id
  ├─ client_id → clients.id
  ├─ title
  ├─ description
  ├─ deadline
  └─ created_at
```

### SQL примеры

```sql
-- Список клиентов
SELECT * FROM clients ORDER BY created_at DESC;

-- Тикеты клиента с комментариями
SELECT t.*, COUNT(c.id) as comment_count
FROM tickets t
LEFT JOIN comments c ON t.id = c.ticket_id
WHERE t.client_id = ?
GROUP BY t.id;

-- Счета за последний месяц
SELECT * FROM invoices
WHERE client_id = ? AND created_at > datetime('now', '-1 month')
ORDER BY created_at DESC;

-- Задачи специалиста
SELECT t.*, c.project_name
FROM tasks t
JOIN clients c ON t.client_id = c.id
ORDER BY t.deadline ASC;
```

---

## 📊 Метрики кода

| Метрика | Значение |
|---------|----------|
| Backend строк кода | ~1362 |
| Frontend компонентов | ~20+ |
| API endpoints | ~25+ |
| Таблиц в БД | 7 |
| Ролей | 3 (admin, specialist, client) |

---

## 🚨 Критические функции

### На что обратить внимание при изменении

1. **JWT_SECRET** - меняйте только в production
2. **CORS ALLOWED_ORIGINS** - при смене домена
3. **generateInvoicePdfBuffer()** - сложная логика
4. **authenticateToken** - критична для безопасности
5. **requireRole()** - предотвращает несанкционированный доступ
6. **Database initialization** - если меняется схема

---

## 🔗 Навигация между файлами

```
API Call
  ↓
api.js (axios instance)
  ↓
server/index.js (endpoint handler)
  ↓
database (SQLite query)
  ↓
Response back to component
  ↓
useState (update component state)
  ↓
Render JSX
```

---

## 📝 Комментарии в коде

Ищите комментарии по паттернам:

```javascript
// TODO: ...        - Что нужно сделать
// FIXME: ...       - Что нужно исправить
// HACK: ...        - Временное решение
// NOTE: ...        - Важное замечание
// XXX: ...         - Осторожно!
```

---

## 🎯 Начните с этих файлов

1. **Первый запуск** → `DEVELOPMENT_GUIDE.md`
2. **Архитектура** → `ARCHITECTURE.md`
3. **Добавление функции** → этот файл + `DEVELOPMENT_GUIDE.md`
4. **Поиск кода** → используйте эту карту
5. **Проблемы** → смотрите раздел Troubleshooting в `DEVELOPMENT_GUIDE.md`

---

**Последнее обновление:** 26 ноября 2025
