# Telegram API Examples

## cURL примеры

### Для клиентов

#### Генерирование ссылки и QR кода

```bash
curl -X POST http://localhost:5001/api/telegram/client/generate-link \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Ответ:**
```json
{
  "deepLink": "https://t.me/your_bot?start=abc123def456",
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAI...",
  "botUsername": "your_bot"
}
```

#### Получение статуса подключения

```bash
curl -X GET http://localhost:5001/api/telegram/client/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Ответ:**
```json
{
  "connected": true,
  "enabled": true,
  "username": "john_doe"
}
```

Или если не подключено:
```json
{
  "connected": false,
  "enabled": false
}
```

#### Отключение уведомлений

```bash
curl -X POST http://localhost:5001/api/telegram/client/disconnect \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Ответ:**
```json
{
  "message": "Уведомления отключены"
}
```

### Для администраторов/специалистов

#### Генерирование ссылки и QR кода

```bash
curl -X POST http://localhost:5001/api/telegram/user/generate-link \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

#### Получение статуса подключения

```bash
curl -X GET http://localhost:5001/api/telegram/user/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Отключение уведомлений

```bash
curl -X POST http://localhost:5001/api/telegram/user/disconnect \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

#### Отправка кастомного сообщения клиенту

```bash
curl -X POST http://localhost:5001/api/telegram/client/123/send-message \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "<b>Важно!</b>\n\nВаш тикет готов к рассмотрению."
  }'
```

**Ответ:**
```json
{
  "message": "Уведомление отправлено"
}
```

**Ошибка (клиент не подключил Telegram):**
```json
{
  "error": "Клиент не подключил Telegram"
}
```

## JavaScript примеры

### React компонент для подключения

```javascript
import React, { useState } from 'react';
import api from '../api';

const TelegramConnect = () => {
  const [deepLink, setDeepLink] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);

  const generateLink = async () => {
    try {
      setLoading(true);
      const response = await api.post('/telegram/client/generate-link');
      setDeepLink(response.data.deepLink);
      setQrCode(response.data.qrCode);
    } catch (error) {
      console.error('Error:', error);
      alert('Ошибка при генерации ссылки');
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async () => {
    try {
      const response = await api.get('/telegram/client/status');
      setConnected(response.data.connected);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const disconnect = async () => {
    try {
      await api.post('/telegram/client/disconnect');
      setConnected(false);
    } catch (error) {
      console.error('Error:', error);
      alert('Ошибка при отключении');
    }
  };

  return (
    <div className="telegram-widget">
      <h3>Telegram Уведомления</h3>
      
      {!connected ? (
        <div>
          <button onClick={generateLink} disabled={loading}>
            {loading ? 'Загрузка...' : 'Включить уведомления'}
          </button>
          
          {qrCode && (
            <div>
              <img src={qrCode} alt="QR Code" />
              <a href={deepLink} target="_blank" rel="noopener noreferrer">
                Или откройте эту ссылку
              </a>
            </div>
          )}
        </div>
      ) : (
        <div>
          <p>✅ Подключено</p>
          <button onClick={disconnect}>Отключить</button>
        </div>
      )}
    </div>
  );
};

export default TelegramConnect;
```

### Node.js использование на сервере

```javascript
// В маршруте или middleware
const { notifyClientNewTicket } = require('../lib/telegramNotifications');

// При создании тикета
router.post('/tickets', authenticateToken, async (req, res) => {
  const { title, description, client_id } = req.body;
  
  // ... создание тикета в БД ...
  
  const ticketId = this.lastID;
  
  // Отправить уведомление в Telegram
  try {
    await notifyClientNewTicket(db, client_id, ticketId, title);
  } catch (error) {
    console.error('Telegram notification error:', error);
    // Продолжить работу даже если уведомление не отправилось
  }
  
  res.json({ id: ticketId, title, description, status: 'open' });
});
```

### Отправка сообщения с HTML форматированием

```javascript
const message = `
🎫 <b>Новый тикет</b>

<b>Название:</b> ${ticket.title}
<b>Приоритет:</b> Высокий
<b>Статус:</b> <u>Открыт</u>

<i>Описание:</i>
${ticket.description.substring(0, 300)}...

<a href="https://your-app.com/tickets/${ticket.id}">Открыть тикет</a>
`;

await notifyClientNewTicket(db, clientId, ticketId, message);
```

## Postman примеры

### Создать новый запрос

**1. Генерирование ссылки**

- **Method:** POST
- **URL:** `http://localhost:5001/api/telegram/client/generate-link`
- **Headers:**
  - `Authorization: Bearer YOUR_JWT_TOKEN`
  - `Content-Type: application/json`

**2. Отправка сообщения**

- **Method:** POST
- **URL:** `http://localhost:5001/api/telegram/client/123/send-message`
- **Headers:**
  - `Authorization: Bearer YOUR_JWT_TOKEN`
  - `Content-Type: application/json`
- **Body (raw JSON):**
```json
{
  "message": "<b>Привет!</b>\nЭто тестовое сообщение"
}
```

## Типичные ошибки и решения

### Error 401: Unauthorized
```
Решение: Передайте правильный JWT токен в заголовке Authorization
```

### Error 400: Клиент не подключил Telegram
```json
{
  "error": "Клиент не подключил Telegram"
}
```
Решение: Попросите клиента включить Telegram уведомления на дашборде

### Error 404: Клиент не найден
```json
{
  "error": "Клиент не найден"
}
```
Решение: Проверьте что clientId правильный

### Error 500: Ошибка при отправке
```json
{
  "error": "Ошибка при отправке"
}
```
Решение: Проверьте логи сервера, возможно проблема с API Telegram

## Интеграция с системой

### Автоматические уведомления

Уведомления отправляются автоматически при:

1. **Создании тикета** (`POST /api/tickets`)
   - Клиент получает: "🎫 Новый тикет"
   - Админ получает: "🎫 Новый тикет от клиента"

2. **Добавлении комментария** (`POST /api/tickets/:id/comments`)
   - Если комментарий от клиента → уведомление администратору
   - Если комментарий от администратора → уведомление клиенту

3. **Изменении статуса** (`PUT /api/tickets/:id`)
   - Клиент получает: "📋 Изменение статуса тикета"

4. **Создании счета** (`POST /api/invoices`)
   - Клиент получает: "💰 Новый счет на оплату"

## Статус коды

| Код | Описание |
|-----|---------|
| 200 | Успешно |
| 400 | Bad Request (неверные параметры) |
| 401 | Unauthorized (нет или неверный токен) |
| 403 | Forbidden (недостаточно прав) |
| 404 | Not Found (ресурс не найден) |
| 500 | Internal Server Error (ошибка сервера) |

## Rate Limiting

Telegram API имеет ограничения на количество сообщений:
- До 30 сообщений в секунду одному пользователю
- До 100 сообщений в секунду одному боту

Если превысить лимиты, Telegram заблокирует бота на время.
Текущая реализация не имеет встроенного rate limiter, но сообщения отправляются асинхронно и не должны создавать проблемы при нормальном использовании.

## Отладка

### Включение подробного логирования

Добавьте в `.env`:
```env
DEBUG=*
NODE_DEBUG=telegram*
```

### Проверка БД

```javascript
// Получить все подключения клиентов
SELECT * FROM client_telegram WHERE enabled = 1;

// Получить все подключения администраторов
SELECT * FROM user_telegram WHERE enabled = 1;

// Проверить очередь уведомлений
SELECT * FROM telegram_notifications_queue ORDER BY created_at DESC LIMIT 10;
```

### Тестирование уведомлений вручную

```bash
# Отправить тестовое сообщение
curl -X POST http://localhost:5001/api/telegram/client/1/send-message \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "<b>🧪 Тестовое сообщение</b>\n\nЕсли вы видите это - всё работает!"
  }'
```
