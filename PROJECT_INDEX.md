# 📋 HELPDESK - Индекс проекта

**Проект:** Тикет-система Обсидиан  
**Структура:** Монорепозиторий с отделёнными клиентом и сервером  
**Дата индексации:** 26 ноября 2025

---

## 📁 Структура проекта

```
HELPDESK/
├── package.json                 # Root package (scripts для dev/production)
├── install.sh                   # Deployment script
├── PROJECT_INDEX.md            # Этот файл
│
├── server/                      # Backend (Express.js + SQLite)
│   ├── index.js                # Главный файл сервера (1362 строк)
│   ├── package.json            # Server dependencies
│   ├── .env                    # Server configuration
│   ├── helpdesk.db            # SQLite database
│   ├── server.log             # Server logs
│   ├── fonts/                 # Шрифты для PDF (DejaVuSans.ttf)
│   ├── uploads/               # Загруженные файлы
│   │   └── invoices/          # Счета
│   └── node_modules/
│
└── client/                      # Frontend (React + TypeScript)
    ├── package.json            # Client dependencies
    ├── tsconfig.json          # TypeScript configuration
    ├── tailwind.config.js     # Tailwind CSS config
    ├── postcss.config.js      # PostCSS config
    ├── public/                # Static files
    ├── build/                 # Production build
    ├── src/
    │   ├── index.tsx          # Entry point
    │   ├── App.tsx            # Main App component
    │   ├── api.js             # Axios API instance
    │   ├── components/        # Reusable components
    │   ├── context/           # React Context (Auth)
    │   ├── hooks/             # Custom hooks
    │   ├── pages/             # Page components
    │   │   ├── Login.js
    │   │   ├── admin/
    │   │   ├── client/
    │   │   └── specialist/
    │   ├── index.css          # Global styles
    │   ├── App.css            # App styles
    │   └── react-app-env.d.ts # Type definitions
    └── node_modules/
```

---

## 🔧 Backend (server/index.js)

### Технологии
- **Express.js** - Web framework
- **SQLite3** - Database
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **multer** - File uploads
- **PDFKit** - PDF generation
- **QRCode** - QR code generation
- **CORS** - Cross-origin requests

### Конфигурация
```javascript
PORT = 5001 (из .env: PORT=5001)
JWT_SECRET = obsidian-secret-key-change-in-production
CLIENT_ORIGIN = https://obs-panel.ru
ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://obs-panel.ru',
  'https://www.obs-panel.ru'
]
```

### API Endpoints

#### Аутентификация
- `POST /api/auth/login` - Вход администратора/специалиста (email + password)
- `POST /api/auth/client-login` - Вход клиента (email + password или clientId)
- `GET /api/auth/me` - Получить текущего пользователя

#### Клиенты
- `GET /api/clients` - Список всех клиентов
- `GET /api/clients/:id` - Деталь клиента
- `POST /api/clients` - Создать клиента
- `PUT /api/clients/:id` - Обновить клиента
- `DELETE /api/clients/:id` - Удалить клиента
- `GET /api/clients/:id/login` - Получить учётные данные клиента
- `POST /api/clients/:id/login` - Создать/обновить учётные данные

#### Тикеты
- `GET /api/tickets` - Список всех тикетов
- `GET /api/tickets/:id` - Деталь тикета
- `GET /api/tickets/client/:id` - Тикеты клиента
- `POST /api/tickets` - Создать тикет
- `PUT /api/tickets/:id` - Обновить тикет
- `PUT /api/tickets/:id/status` - Изменить статус тикета
- `PUT /api/tickets/:id/specialist` - Назначить специалиста

#### Счета/Инвойсы
- `GET /api/invoices` - Список всех счетов
- `GET /api/invoices/client/:id` - Счета клиента
- `GET /api/invoices/:id` - Деталь счета
- `POST /api/invoices` - Создать счет
- `POST /api/invoices/generate` - Генерировать счет с QR-кодом (PDF)
- `DELETE /api/invoices/:id` - Удалить счет

#### Задачи
- `GET /api/tasks` - Список всех задач
- `GET /api/tasks/client/:id` - Задачи клиента
- `GET /api/tasks/:id` - Деталь задачи
- `POST /api/tasks` - Создать задачу
- `PUT /api/tasks/:id` - Обновить задачу

### Ключевые функции

#### generateInvoicePdfBuffer()
Генерирует PDF счёта с QR-кодом в формате ST00012 (платёжное поручение).
- Входные данные: реквизиты получателя, плательщика, сумма, описание
- Выходные данные: Buffer с PDF
- Использует шрифты: DejaVuSans.ttf для кириллицы

#### Middleware
- `cors()` - CORS handling
- `authenticateToken` - JWT verification
- `requireRole(role)` - Role-based access control

### Роли и доступ
- **admin** - Полный доступ
- **specialist** - Просмотр клиентов, тикетов, создание комментариев
- **client** - Просмотр своих тикетов, создание новых, просмотр счетов

---

## 🎨 Frontend (client/src)

### Технологии
- **React 19** - UI framework
- **TypeScript** - Type safety
- **React Router v7** - Navigation
- **Axios** - HTTP client
- **Tailwind CSS** - Styling

### Структура компонентов

#### Pages
```
pages/
├── Login.js                  # Экран входа
├── admin/
│   ├── ClientsList.js       # Список клиентов
│   ├── ClientDetail.js      # Деталь клиента (табы: инфо, тикеты, счета, задачи)
│   ├── NewClient.js         # Форма создания клиента
│   ├── TicketDetail.js      # Деталь тикета
│   ├── TaskDetail.js        # Деталь задачи
│   ├── NewTicket.js         # Форма создания тикета
│   └── NewInvoice.js        # Форма создания счета
├── client/
│   ├── Dashboard.js         # Главная для клиента
│   ├── TicketsList.js       # Список тикетов клиента
│   ├── TicketDetail.js      # Деталь тикета для клиента
│   ├── InvoicesList.js      # Список счетов
│   └── NewTicket.js         # Форма создания тикета
└── specialist/
    ├── ClientsList.js       # Список клиентов для специалиста
    └── TicketDetail.js      # Деталь тикета для специалиста
```

#### Components
- `Layout.js` - Обёртка со статус-баром, навигацией
- `ProtectedRoute.js` - HOC для защиты маршрутов
- `ConfirmModal.js` - Модальное окно подтверждения

#### Context & Hooks
- `AuthContext.js` - Управление аутентификацией
- `useAuth.js` - Hook для доступа к auth контексту

### API Client (api.js)
```javascript
API_URL определяется:
- Production: текущий хост (obs-panel.ru)
- Development: http://localhost:5001/api

Автоматически добавляет JWT token в заголовки
```

### Маршруты

#### Admin (`/admin/...`)
- `/admin/clients` - Список клиентов
- `/admin/clients/new` - Новый клиент
- `/admin/clients/:id` - Деталь клиента
- `/admin/tickets/:id` - Деталь тикета
- `/admin/tasks/:id` - Деталь задачи
- `/admin/tickets/new` - Новый тикет
- `/admin/invoices/new/:clientId` - Новый счет

#### Client (`/client/...`)
- `/client` - Dashboard
- `/client/tickets/all` - Список тикетов
- `/client/tickets/:id` - Деталь тикета
- `/client/tickets/new` - Новый тикет
- `/client/invoices/all` - Список счетов

#### Specialist (`/specialist/...`)
- `/specialist` - Список клиентов
- `/specialist/tickets/:id` - Деталь тикета

---

## 🗄️ База данных (SQLite)

### Таблицы

#### users
```sql
id, email, password_hash, role, name, created_at
```
Роли: admin, specialist

#### clients
```sql
id, project_name, url, legal_name, legal_address, inn, ogrn, status, created_at
```
Статусы: in_development, in_progress, completed, paused

#### client_logins
```sql
id, client_id, email, password, created_at, updated_at
```
Логины для клиентов

#### tickets
```sql
id, client_id, title, description, status, assigned_to, created_at, updated_at
```
Статусы: open, in_progress, closed

#### comments
```sql
id, ticket_id, author_id, text, created_at
```

#### invoices
```sql
id, client_id, amount, description, created_at, pdf_path
```

#### tasks
```sql
id, client_id, title, description, deadline, created_at, updated_at
```

---

## 📦 Dependencies

### Backend
```json
{
  "express": "^4.18.2",
  "cors": "^2.8.5",
  "sqlite3": "^5.1.6",
  "bcryptjs": "^2.4.3",
  "jsonwebtoken": "^9.0.2",
  "multer": "^1.4.5-lts.1",
  "pdfkit": "^0.13.0",
  "qrcode": "^1.5.1",
  "dotenv": "^16.3.1"
}
```

### Frontend
```json
{
  "react": "^19.2.0",
  "react-dom": "^19.2.0",
  "react-router-dom": "^7.9.6",
  "typescript": "^4.9.5",
  "axios": "^1.13.2",
  "tailwindcss": "^3.4.18"
}
```

---

## 🚀 Scripts

### Root (HELPDESK/package.json)
```bash
npm run dev              # Запуск сервера и клиента одновременно
npm run server          # Только сервер (nodemon)
npm run client          # Только клиент
npm run install-all     # Установка всех зависимостей
```

### Server (server/package.json)
```bash
npm start               # node index.js
npm run dev            # nodemon index.js
```

### Client (client/package.json)
```bash
npm start              # react-scripts start (port 3000)
npm run build          # Production build
npm test               # Jest tests
```

---

## 👤 Тестовые пользователи

### Администратор
```
Email: admin@obsidian.ru
Пароль: admin123
```

### Специалист
```
Email: specialist@obsidian.ru
Пароль: specialist123
```

### Клиент
```
Email: (из таблицы client_logins)
Пароль: (из таблицы client_logins)
```

---

## 🔐 Развёртывание (production)

### Серверные реквизиты
```javascript
Получатель: НЕМКОВА СОФИЯ СЕРГЕЕВНА (ИП)
ИНН: 401110194908
Счёт: 40802810001480000058
Банк: АО "АЛЬФА-БАНК"
БИК: 044525593
Корр. счёт: 30101810200000000593
Адрес: Калужская область, г. Малоярославец
```

### Nginx конфиг
- Порт: 80 → 443 с SSL
- Frontend serve: `/client/build/`
- API proxy: `/api/` → `http://127.0.0.1:5001`
- SPA routing: все 404 → `/index.html`

### SSL сертификаты
- Let's Encrypt (letsencrypt.org)
- Путь: `/etc/letsencrypt/live/obs-panel.ru/`

---

## 📝 Ключевые файлы для редактирования

### При добавлении новой функции:

1. **Backend API** → `server/index.js`
2. **API endpoints** → `server/index.js` (app.get/post/put/delete)
3. **DB schema** → `server/index.js` (в конце, инициализация DB)
4. **Frontend page** → `client/src/pages/`
5. **API client call** → `client/src/api.js` или создать hook
6. **Routing** → `client/src/App.tsx`
7. **Styles** → Tailwind классы или `client/src/*.css`

---

## 🔍 Quick Navigation

### Для локальной разработки:
1. Скачать репозиторий
2. `npm run install-all` - установить зависимости
3. `npm run dev` - запустить сервер и клиент
4. Открыть http://localhost:3000
5. Логин: admin@obsidian.ru / admin123

### Для production:
1. `npm run build` (в client/)
2. `./install.sh` - автоматизированный deploy
3. Домен: https://obs-panel.ru

---

## 📊 Основные сущности

| Сущность | Описание |
|----------|---------|
| **Client** | Компания-клиент с реквизитами |
| **Ticket** | Задача/проблема клиента |
| **Comment** | Комментарий к тикету |
| **Invoice** | Счёт с QR-кодом для оплаты |
| **Task** | Внутренняя задача для специалистов |
| **User** | Администратор или специалист |

---

## 🔗 Зависимости между модулями

```
App.tsx
├── AuthContext (Login check)
├── Routes (Page routing)
└── Layout (Header + Navigation)
    ├── Admin Pages
    │   ├── ClientsList → ClientDetail → NewClient
    │   ├── TicketDetail → Comments
    │   └── TaskDetail
    ├── Client Pages
    │   ├── Dashboard
    │   ├── TicketsList → TicketDetail
    │   └── InvoicesList
    └── Specialist Pages
        ├── ClientsList
        └── TicketDetail

Backend (server/index.js)
├── Database (SQLite)
├── Authentication (JWT)
├── File Upload (Multer)
├── PDF Generation (PDFKit + QRCode)
└── CORS Middleware
```

---

## 📄 Версионирование

**Текущая версия:** 1.0.0  
**Git репозиторий:** https://github.com/nemkoff94/HELPDESK  
**Последнее обновление:** 26 ноября 2025

---

## ⚙️ Для корректного добавления нового функционала:

### Шаг 1: Планирование
- Определить сущность и её свойства
- Решить, нужна ли таблица в БД или изменение существующей
- Спланировать API endpoints
- Набросать UI/UX

### Шаг 2: Backend
- Добавить SQL схему (если нужно)
- Реализовать endpoints в `server/index.js`
- Протестировать через postman/curl

### Шаг 3: Frontend
- Создать компоненты в `pages/` или `components/`
- Добавить API вызовы
- Добавить маршруты в `App.tsx`
- Добавить UI с Tailwind

### Шаг 4: Тестирование
- Проверить на всех ролях (admin, specialist, client)
- Проверить ошибки и граничные случаи
- Проверить на production конфиге

---

**Готово для разработки! 🚀**
