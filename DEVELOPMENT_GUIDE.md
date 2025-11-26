# 🛠️ DEVELOPMENT_GUIDE.md - Руководство разработчика

## Быстрый старт

### Предварительные требования
- Node.js 14+
- npm 6+
- Git
- Текстовый редактор (VS Code рекомендуется)

### Первый запуск

```bash
# 1. Клонировать репозиторий
git clone https://github.com/nemkoff94/HELPDESK.git
cd HELPDESK

# 2. Установить зависимости
npm run install-all
# Или вручную:
# npm install && cd server && npm install && cd ../client && npm install

# 3. Запустить в режиме разработки
npm run dev

# 4. Открыть в браузере
# Frontend: http://localhost:3000
# Backend API: http://localhost:5001/api
```

**Тестовые данные:**
- Admin: `admin@obsidian.ru` / `admin123`
- Specialist: `specialist@obsidian.ru` / `specialist123`

---

## Структура файлов для быстрого поиска

### Backend серверная логика
```
server/
├── index.js (1362 строки)
│   ├── Lines 1-50: Imports & Setup
│   ├── Lines 51-70: CORS Configuration
│   ├── Lines 71-130: PDF Generation Helper
│   ├── Lines 131-200: Database Initialization
│   ├── Lines 201-250: Middleware (authenticateToken, requireRole)
│   ├── Lines 251-400: Auth Routes (login, register)
│   ├── Lines 401-500: Client Routes (GET, POST, PUT, DELETE)
│   ├── Lines 501-700: Ticket Routes
│   ├── Lines 701-900: Comment Routes
│   ├── Lines 901-1100: Invoice Routes
│   ├── Lines 1101-1300: Task Routes
│   └── Lines 1301-1362: Server Startup
```

### Frontend структура
```
client/src/
├── index.tsx (Entry point)
├── App.tsx (Main router)
├── api.js (HTTP client configuration)
├── pages/
│   ├── Login.js (Экран входа для всех ролей)
│   ├── admin/ (Админ функции)
│   ├── client/ (Клиент функции)
│   └── specialist/ (Специалист функции)
├── components/
│   ├── Layout.js (Header + Navigation)
│   ├── ProtectedRoute.js (Route guard)
│   └── ConfirmModal.js (Confirm dialog)
├── context/
│   └── AuthContext.js (Auth state management)
└── hooks/
    └── useAuth.js (useAuth hook)
```

---

## 📝 Добавление новой функции - пошаговое руководство

### Пример: Добавляем функцию "Комментарии к задачам"

#### Шаг 1: Планирование
**Что нужно:**
- Новая таблица `task_comments` в БД
- 3 новых API endpoint'а (GET, POST, DELETE)
- Новый компонент для отображения комментариев
- Форма для добавления комментария

---

#### Шаг 2: Backend - Добавляем таблицу в БД

**Файл: `server/index.js` (в функции инициализации БД, ~line 180)**

```javascript
// Найдите строку с "CREATE TABLE IF NOT EXISTS comments"
// Добавьте после неё:

db.run(`
  CREATE TABLE IF NOT EXISTS task_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
  )
`);
```

---

#### Шаг 3: Backend - Добавляем API endpoints

**Файл: `server/index.js` (в конце, перед `app.listen()`, ~line 1350)**

```javascript
// GET все комментарии к задаче
app.get('/api/tasks/:taskId/comments', authenticateToken, (req, res) => {
  const { taskId } = req.params;
  
  db.all(
    `SELECT tc.*, u.name, u.email 
     FROM task_comments tc
     LEFT JOIN users u ON tc.author_id = u.id
     WHERE tc.task_id = ?
     ORDER BY tc.created_at DESC`,
    [taskId],
    (err, comments) => {
      if (err) return res.status(500).json({ error: 'Ошибка сервера' });
      res.json(comments);
    }
  );
});

// POST новый комментарий к задаче
app.post('/api/tasks/:taskId/comments', authenticateToken, (req, res) => {
  const { taskId } = req.params;
  const { text } = req.body;
  const userId = req.user.id;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Текст не может быть пустым' });
  }

  db.run(
    `INSERT INTO task_comments (task_id, author_id, text) VALUES (?, ?, ?)`,
    [taskId, userId, text],
    function(err) {
      if (err) return res.status(500).json({ error: 'Ошибка при создании комментария' });
      
      // Вернём новый комментарий с информацией об авторе
      db.get(
        `SELECT tc.*, u.name, u.email 
         FROM task_comments tc
         LEFT JOIN users u ON tc.author_id = u.id
         WHERE tc.id = ?`,
        [this.lastID],
        (err, comment) => {
          if (err) return res.status(500).json({ error: 'Ошибка' });
          res.json(comment);
        }
      );
    }
  );
});

// DELETE комментарий (только автор или админ)
app.delete('/api/tasks/comments/:commentId', authenticateToken, (req, res) => {
  const { commentId } = req.params;
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  db.get('SELECT author_id FROM task_comments WHERE id = ?', [commentId], (err, comment) => {
    if (err) return res.status(500).json({ error: 'Ошибка сервера' });
    if (!comment) return res.status(404).json({ error: 'Комментарий не найден' });
    
    // Только автор или админ могут удалить
    if (comment.author_id !== userId && !isAdmin) {
      return res.status(403).json({ error: 'Нет прав на удаление' });
    }

    db.run('DELETE FROM task_comments WHERE id = ?', [commentId], function(err) {
      if (err) return res.status(500).json({ error: 'Ошибка при удалении' });
      res.json({ success: true });
    });
  });
});
```

---

#### Шаг 4: Frontend - Создаём компонент для комментариев

**Новый файл: `client/src/components/TaskComments.js`**

```javascript
import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../hooks/useAuth';

const TaskComments = ({ taskId }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchComments();
  }, [taskId]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/tasks/${taskId}/comments`);
      setComments(response.data || []);
    } catch (err) {
      setError('Ошибка при загрузке комментариев');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const response = await api.post(`/tasks/${taskId}/comments`, {
        text: newComment
      });
      setComments([response.data, ...comments]);
      setNewComment('');
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка при добавлении комментария');
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Вы уверены?')) return;

    try {
      await api.delete(`/tasks/comments/${commentId}`);
      setComments(comments.filter(c => c.id !== commentId));
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка при удалении');
    }
  };

  if (loading) return <div className="text-gray-500">Загрузка...</div>;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">Комментарии</h3>

      {/* Форма добавления комментария */}
      <form onSubmit={handleAddComment} className="space-y-2">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Добавьте комментарий..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows="3"
        />
        <button
          type="submit"
          disabled={!newComment.trim()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        >
          Добавить комментарий
        </button>
        {error && <div className="text-red-600 text-sm">{error}</div>}
      </form>

      {/* Список комментариев */}
      <div className="space-y-3 mt-4">
        {comments.length === 0 ? (
          <p className="text-gray-500">Нет комментариев</p>
        ) : (
          comments.map(comment => (
            <div key={comment.id} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-gray-800">{comment.name || comment.email}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(comment.created_at).toLocaleString('ru-RU')}
                  </p>
                </div>
                {(user?.id === comment.author_id || user?.role === 'admin') && (
                  <button
                    onClick={() => handleDeleteComment(comment.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Удалить
                  </button>
                )}
              </div>
              <p className="text-gray-700 mt-2">{comment.text}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TaskComments;
```

---

#### Шаг 5: Frontend - Интегрируем компонент в TaskDetail

**Файл: `client/src/pages/admin/TaskDetail.js` (добавить импорт и компонент)**

```javascript
// Добавить в начало файла:
import TaskComments from '../../components/TaskComments';

// В JSX (добавить где-то после информации о задаче):
<div className="mt-8 border-t pt-8">
  <TaskComments taskId={id} />
</div>
```

---

#### Шаг 6: Тестирование

1. **Запустить приложение:**
```bash
npm run dev
```

2. **Тестировать функцию:**
   - Залогиниться как админ
   - Перейти к задаче
   - Добавить комментарий
   - Проверить отображение
   - Удалить комментарий
   - Проверить, что другой пользователь не может удалить чужой комментарий

3. **Проверить в браузере:**
   - Open DevTools (F12)
   - Network tab - посмотреть API запросы
   - Console - нет ли ошибок

4. **Протестировать на разных ролях:**
   - Админ - полный доступ
   - Специалист - должен видеть и добавлять
   - Клиент - не должен видеть задачи (если задачи только внутренние)

---

## 🔍 Типичные паттерны

### Паттерн 1: Простой API запрос

```javascript
// Frontend component
useEffect(() => {
  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/resource/${id}`);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error');
    } finally {
      setLoading(false);
    }
  };
  
  fetchData();
}, [id]);
```

### Паттерн 2: Form submission

```javascript
const handleSubmit = async (e) => {
  e.preventDefault();
  
  try {
    setLoading(true);
    const response = await api.post('/api/resource', formData);
    navigate(`/resource/${response.data.id}`);
  } catch (error) {
    setError(error.response?.data?.error);
  } finally {
    setLoading(false);
  }
};
```

### Паттерн 3: Условный рендеринг

```javascript
{loading && <p>Loading...</p>}
{error && <div className="text-red-600">{error}</div>}
{data && <div>{/* render data */}</div>}
```

### Паттерн 4: Защита маршрута

```javascript
<Route
  path="/admin/resource/:id"
  element={
    <ProtectedRoute allowedRoles={['admin']}>
      <ResourceDetail />
    </ProtectedRoute>
  }
/>
```

### Паттерн 5: Backend database query

```javascript
db.get(
  'SELECT * FROM table WHERE id = ?',
  [id],
  (err, row) => {
    if (err) return res.status(500).json({ error: 'Error' });
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  }
);
```

---

## 🐛 Отладка

### Backend отладка

```javascript
// Добавьте логирование:
console.log('Request body:', req.body);
console.log('User:', req.user);

// Проверьте БД прямо:
db.all('SELECT * FROM table', (err, rows) => {
  console.log('DB rows:', rows);
});
```

### Посмотреть API запросы
```bash
# Terminal - смотреть backend логи
npm run server

# Browser - DevTools Network tab
# Смотреть запросы и ответы
```

### Очистить БД (для разработки)
```bash
rm server/helpdesk.db
npm run server
# БД пересоздастся с нуля
```

---

## 📋 Чеклист перед push в production

- [ ] Все новые endpoints протестированы
- [ ] Все роли (admin, specialist, client) протестированы
- [ ] Нет console.log() и console.error() в продакшене
- [ ] Обработаны все ошибки (try-catch)
- [ ] Добавлены проверки доступа (authenticateToken, requireRole)
- [ ] Пароли не хранятся в кодe (используйте .env)
- [ ] Нет SQL injection уязвимостей (используйте parameterized queries)
- [ ] Frontend работает на http://localhost:3000
- [ ] Backend работает на http://localhost:5001
- [ ] Все зависимости добавлены в package.json
- [ ] Git коммит с описанием

---

## 📚 Полезные команды

```bash
# Развитие
npm run dev                    # Run server + client
npm run server                 # Just backend
npm run client                 # Just frontend

# Сборка
cd client && npm run build     # Production build

# Тестирование
npm test                       # Run tests
npm run lint                   # Run linter

# Git
git status                     # Check changes
git add .                      # Stage all
git commit -m "message"        # Commit
git push origin main           # Push

# Node/npm
npm list                       # List packages
npm install package-name       # Install package
npm update                     # Update packages
```

---

## 🔗 Полезные ссылки

- [Express.js docs](https://expressjs.com/)
- [React docs](https://react.dev/)
- [SQLite docs](https://www.sqlite.org/docs.html)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [JWT intro](https://jwt.io/introduction)

---

## 💬 Часто задаваемые вопросы

**Q: Где добавлять новый API endpoint?**
A: В `server/index.js`, в строках 901-1300 (перед app.listen).

**Q: Как добавить новую роль?**
A: Добавить в функцию `requireRole()` и в `clients/src/App.tsx` маршруты.

**Q: Как изменить порт?**
A: Серверу - меняйте PORT в `.env`. Клиенту - в `package.json` (REACT_APP_PORT).

**Q: Как подключиться к БД напрямую?**
A: Установите `sqlite3` CLI и запустите `sqlite3 server/helpdesk.db`.

**Q: Почему токен не работает?**
A: Проверьте, что JWT_SECRET одинаков на backend и. Проверьте срок действия токена.

---

**Готово! Начинайте разработку! 🚀**
