const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const { checkSiteAvailability } = require('./routes/widgets');

/**
 * Инициализирует крон-задачу для проверки доступности сайтов
 * @param {sqlite3.Database} db - Экземпляр БД SQLite
 */
const initializeCronJobs = (db) => {
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

  console.log('Крон-задача проверки доступности сайтов активирована');
  return screenshotCron;
};

module.exports = {
  initializeCronJobs
};
