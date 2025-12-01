const { Telegraf } = require('telegraf');
const QRCode = require('qrcode');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

let bot = null;

/**
 * Инициализирует Telegram бота
 * @param {string} botToken - Token бота от BotFather
 * @param {object} db - SQLite база данных
 */
const initializeTelegramBot = (botToken, db) => {
  if (!botToken) {
    console.warn('Telegram bot token не найден в переменных окружения');
    return null;
  }

  bot = new Telegraf(botToken);

  // Обработка команды /start
  bot.command('start', async (ctx) => {
    const telegramUserId = ctx.from.id;
    const telegramUsername = ctx.from.username || ctx.from.first_name;

    // Извлекаем токен из текста команды
    const args = ctx.message.text.split(' ');
    const connectionToken = args[1];

    if (!connectionToken) {
      await ctx.reply(
        'Пожалуйста, используйте ссылку из приложения для подключения уведомлений.'
      );
      return;
    }

    // Проверяем тип подключения (client или user)
    try {
      const clientConnection = await getClientByToken(db, connectionToken);
      
      if (clientConnection) {
        // Подключение клиента
        await updateClientTelegramConnection(db, clientConnection.client_id, telegramUserId, telegramUsername);
        await ctx.reply('✅ Уведомления подключены! Вы будете получать уведомления от нашей системы.');
        return;
      }

      const userConnection = await getUserByToken(db, connectionToken);
      
      if (userConnection) {
        // Подключение администратора/специалиста
        await updateUserTelegramConnection(db, userConnection.user_id, telegramUserId, telegramUsername);
        await ctx.reply('✅ Уведомления подключены! Вы будете получать уведомления о тикетах.');
        return;
      }

      await ctx.reply('❌ Неверная ссылка. Проверьте QR код или ссылку из приложения.');
    } catch (error) {
      console.error('Ошибка при обработке /start:', error);
      await ctx.reply('❌ Ошибка подключения. Попробуйте позже.');
    }
  });

  // Обработка команды /help
  bot.command('help', async (ctx) => {
    await ctx.reply(
      'ℹ️ Доступные команды:\n' +
      '/start - подключить уведомления\n' +
      '/help - справка'
    );
  });

  // Обработка всех остальных сообщений
  bot.on('message', async (ctx) => {
    await ctx.reply(
      'Привет! 👋\n\n' +
      'Используйте ссылку из приложения для подключения уведомлений.'
    );
  });

  // Запуск бота
  bot.launch();

  console.log('✅ Telegram бот запущен');

  // Graceful shutdown
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  return bot;
};

/**
 * Получает клиента по токену подключения
 */
const getClientByToken = (db, token) => {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM client_telegram WHERE connection_token = ?',
      [token],
      (err, row) => {
        if (err) reject(err);
        resolve(row);
      }
    );
  });
};

/**
 * Получает пользователя по токену подключения
 */
const getUserByToken = (db, token) => {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM user_telegram WHERE connection_token = ?',
      [token],
      (err, row) => {
        if (err) reject(err);
        resolve(row);
      }
    );
  });
};

/**
 * Обновляет Telegram подключение клиента
 */
const updateClientTelegramConnection = (db, clientId, telegramUserId, telegramUsername) => {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE client_telegram 
       SET telegram_user_id = ?, telegram_username = ?, enabled = 1, updated_at = CURRENT_TIMESTAMP
       WHERE client_id = ?`,
      [telegramUserId, telegramUsername, clientId],
      function(err) {
        if (err) reject(err);
        resolve(this);
      }
    );
  });
};

/**
 * Обновляет Telegram подключение пользователя
 */
const updateUserTelegramConnection = (db, userId, telegramUserId, telegramUsername) => {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE user_telegram 
       SET telegram_user_id = ?, telegram_username = ?, enabled = 1, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`,
      [telegramUserId, telegramUsername, userId],
      function(err) {
        if (err) reject(err);
        resolve(this);
      }
    );
  });
};

/**
 * Генерирует уникальный токен подключения
 */
const generateConnectionToken = () => {
  return crypto.randomBytes(16).toString('hex');
};

/**
 * Создает QR код для подключения
 */
const generateQRCode = async (deepLink) => {
  try {
    const qrCode = await QRCode.toDataURL(deepLink);
    return qrCode;
  } catch (error) {
    console.error('Ошибка при генерации QR кода:', error);
    return null;
  }
};

/**
 * Отправляет сообщение клиенту в Telegram
 */
/**
 * Отправляет сообщение клиенту в Telegram. Если указан опциональный документ
 * (путь или Buffer), документ будет отправлен с подписью (caption).
 *
 * @param {object} db - sqlite db
 * @param {number} clientId
 * @param {string} message - HTML-formatted message
 * @param {object} [options]
 * @param {string} [options.documentPath] - путь к файлу на диске
 * @param {Buffer} [options.documentBuffer] - данные файла в памяти
 * @param {string} [options.filename] - имя файла для отправки
 */
const sendClientNotification = async (db, clientId, message, options = {}) => {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT telegram_user_id FROM client_telegram WHERE client_id = ? AND enabled = 1',
      [clientId],
      async (err, row) => {
        if (err) return reject(err);

        if (!row || !row.telegram_user_id) {
          return resolve({ success: false, reason: 'not_connected' });
        }

        if (!bot) {
          return resolve({ success: false, reason: 'bot_not_initialized' });
        }

        try {
          // If a document path or buffer provided, send document with caption
          if ((options.documentPath || options.documentBuffer)) {
            let input = null;
            const filename = options.filename || (options.documentPath ? path.basename(options.documentPath) : 'document.pdf');

            if (options.documentBuffer) {
              input = { source: options.documentBuffer, filename };
            } else {
              // resolve path relative to project root if needed
              let fullPath = options.documentPath;
              if (!path.isAbsolute(fullPath)) {
                fullPath = path.resolve(__dirname, '..', fullPath);
              }
              if (!fs.existsSync(fullPath)) {
                // fallback: try as-is
                if (!fs.existsSync(options.documentPath)) {
                  console.warn('Document not found for Telegram send:', fullPath);
                  // send text message instead
                  await bot.telegram.sendMessage(row.telegram_user_id, message, { parse_mode: 'HTML' });
                  return resolve({ success: true, sentDocument: false });
                }
              }
              input = { source: fs.createReadStream(fullPath), filename };
            }

            await bot.telegram.sendDocument(row.telegram_user_id, input, { caption: message, parse_mode: 'HTML' });
            return resolve({ success: true, sentDocument: true });
          }

          // otherwise send normal text message
          await bot.telegram.sendMessage(row.telegram_user_id, message, {
            parse_mode: 'HTML'
          });
          resolve({ success: true, sentDocument: false });
        } catch (error) {
          console.error('Ошибка при отправке сообщения:', error);
          reject(error);
        }
      }
    );
  });
};

/**
 * Отправляет сообщение администратору в Telegram
 */
const sendAdminNotification = async (db, userId, message) => {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT telegram_user_id FROM user_telegram WHERE user_id = ? AND enabled = 1',
      [userId],
      async (err, row) => {
        if (err) return reject(err);
        
        if (!row || !row.telegram_user_id) {
          return resolve({ success: false, reason: 'not_connected' });
        }

        if (!bot) {
          return resolve({ success: false, reason: 'bot_not_initialized' });
        }

        try {
          await bot.telegram.sendMessage(row.telegram_user_id, message, {
            parse_mode: 'HTML'
          });
          resolve({ success: true });
        } catch (error) {
          console.error('Ошибка при отправке сообщения:', error);
          reject(error);
        }
      }
    );
  });
};

/**
 * Получает Telegram бот
 */
const getTelegramBot = () => {
  return bot;
};

module.exports = {
  initializeTelegramBot,
  generateConnectionToken,
  generateQRCode,
  sendClientNotification,
  sendAdminNotification,
  getTelegramBot,
  getClientByToken,
  getUserByToken
};
