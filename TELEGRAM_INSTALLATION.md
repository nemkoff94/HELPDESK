# Telegram Bot Integration - Configuration Examples

## Быстрый старт

### 1. Получить токен бота

```bash
# В Telegram найти @BotFather
# Команда: /newbot
# Получить токен вида:
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklmNOpqrsTuvwxyzABCdeFGhI
```

### 2. Создать .env файл в папке server

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklmNOpqrsTuvwxyzABCdeFGhI
TELEGRAM_BOT_USERNAME=your_awesome_bot

# Application
APP_URL=http://localhost:5001
NODE_ENV=development
PORT=5001

# Database
DATABASE_URL=helpdesk.db

# JWT
JWT_SECRET=your-super-secret-key-change-in-production

# CORS
CLIENT_ORIGIN=http://localhost:3000
```

### 3. Для Production окружения

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklmNOpqrsTuvwxyzABCdeFGhI
TELEGRAM_BOT_USERNAME=your_awesome_bot

# Application
APP_URL=https://your-domain.com
NODE_ENV=production
PORT=5000

# Database
DATABASE_URL=/var/lib/helpdesk/helpdesk.db

# JWT
JWT_SECRET=generate-a-long-random-string-here

# CORS
CLIENT_ORIGIN=https://your-domain.com
```

## Генерирование переменных окружения

### Генерирование JWT_SECRET

```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# bash/zsh
openssl rand -hex 32
```

## Проверка конфигурации

После добавления .env файла, убедитесь что:

1. Сервер запускается без ошибок:
```bash
cd server
npm start
```

2. В логах должно быть сообщение:
```
✅ Telegram бот запущен
```

3. Тестирование API:
```bash
# Проверить статус клиента (должна вернуться 401 без токена)
curl http://localhost:5001/api/telegram/client/status

# Или с валидным токеном
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5001/api/telegram/client/status
```

## Решение проблем

### Ошибка: "TELEGRAM_BOT_TOKEN not found"
- Создайте файл `.env` в папке `server/`
- Убедитесь что переменная `TELEGRAM_BOT_TOKEN` есть в файле
- Убедитесь что нет пробелов: `TELEGRAM_BOT_TOKEN=token`

### Ошибка: "Telegram бот не запущен"
- Проверьте токен (он должен быть правильный от @BotFather)
- Проверьте интернет соединение
- Посмотрите полный лог ошибки в консоли

### QR код не генерируется
- Убедитесь что установлен пакет qrcode: `npm list qrcode`
- Если не установлен: `npm install qrcode`

### Уведомления не отправляются
- Проверьте что пользователь нажал `/start` в боте
- Проверьте что у пользователя `enabled = 1` в БД
- Посмотрите логи в консоли сервера на ошибки API Telegram

## Дополнительно

### Получение webhook URL для бота (не требуется, используется polling)

Текущая реализация использует **polling** (длинные опросы), что хорошо для development.
Для production можно настроить **webhooks**:

```bash
# Установить webhook
curl -X POST https://api.telegram.org/bot{TOKEN}/setWebhook \
  -d url=https://your-domain.com/api/telegram/webhook
```

Но это требует дополнительной настройки маршрутов и сертификатов SSL.

### Тестирование бота вручную

1. Откройте свой бот в Telegram (t.me/your_bot_username)
2. Отправьте `/start` без параметров
3. Вы должны получить сообщение: "Пожалуйста, используйте ссылку из приложения..."
4. Это означает что бот работает правильно

### Отключение Telegram бота

Если вам нужно отключить бота без его удаления:

```env
# Просто удалите или закомментируйте TELEGRAM_BOT_TOKEN
# TELEGRAM_BOT_TOKEN=123456...

# При запуске сервера будет сообщение:
# ⚠️  TELEGRAM_BOT_TOKEN не найден. Telegram интеграция отключена.
```

### Смена токена бота

1. В @BotFather отправьте `/token`
2. Выберите нужного бота
3. Получите новый токен
4. Обновите `TELEGRAM_BOT_TOKEN` в `.env`
5. Перезагрузите сервер

При смене токена:
- Старые токены подключения клиентов больше не будут работать
- Клиентам и администраторам нужно будет переподключиться

## Чек-лист при запуске в production

- [ ] Создан новый бот через @BotFather
- [ ] Получен токен и сохранен в переменных окружения
- [ ] Установлен TELEGRAM_BOT_USERNAME (username бота)
- [ ] APP_URL правильно указан (https://your-domain.com)
- [ ] NODE_ENV=production
- [ ] JWT_SECRET - долгая случайная строка
- [ ] Сервер перезагружен
- [ ] В логах: "✅ Telegram бот запущен"
- [ ] Протестирована отправка уведомления
- [ ] Клиент может отсканировать QR код
- [ ] Уведомления приходят в Telegram
