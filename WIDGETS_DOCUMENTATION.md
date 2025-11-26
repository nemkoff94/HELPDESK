# Новая функциональность: Виджеты для клиентов

## Общее описание

В приложение добавлены 4 новых интерактивных виджета для администраторов и клиентов:

1. **Статус рекламных кампаний** - отслеживание статуса и бюджета рекламных кампаний
2. **Календарь обязательных обновлений** - напоминание о датах продления доменов, хостинга и SSL
3. **Рекомендации** - система рекомендаций по улучшению для клиентов
4. **Доступность сайта** - ежедневная проверка доступности сайта в 04:00

---

## 1. Виджет "Статус рекламных кампаний"

### Для администратора

**Расположение:** Страница клиента → Кнопка "Управлять виджетами" → Вкладка "Рекламные кампании"

**Функции:**
- Включить/отключить виджет для клиента
- Указать текущий месячный бюджет (в рублях) - **обязательно**
- Указать рекомендованный бюджет (опционально)
- Выбрать статус кампании:
  - **Активна** - пульсирует зелёный индикатор
  - **На паузе** - пульсирует жёлтый индикатор
  - **Остановлена** - серый статичный индикатор

**API endpoints:**
```
GET    /api/widgets/ad-campaign/:clientId        - получить виджет
POST   /api/widgets/ad-campaign/:clientId        - создать/обновить виджет
```

### Для клиента

**Расположение:** Dashboard клиента

**Отображение:**
- Название виджета
- Индикатор статуса с соответствующим цветом и пульсацией
- Текущий бюджет на месяц
- Рекомендованный бюджет (если указан)

---

## 2. Виджет "Календарь обязательных обновлений"

### Для администратора

**Расположение:** Страница клиента → "Управлять виджетами" → Вкладка "Календарь обновлений"

**Функции:**
- Включить/отключить виджет
- Указать дату продления домена
- Указать дату продления хостинга
- Указать дату продления SSL или отметить "Обновляется автоматически"
- Динамическое сохранение данных в форме

**API endpoints:**
```
GET    /api/widgets/renewal-calendar/:clientId   - получить виджет
POST   /api/widgets/renewal-calendar/:clientId   - создать/обновить виджет
```

### Для клиента

**Расположение:** Dashboard клиента

**Отображение:**
- Дата продления домена с информацией о количестве дней до обновления
- Дата продления хостинга с информацией о количестве дней до обновления
- Статус SSL (либо дата с количеством дней, либо "Обновляется автоматически ✓")

**Цветовая подсказка:**
- **Серый** - нормально (более 60 дней)
- **Жёлтый** - внимание (менее 60 дней)
- **Красный** - просрочено

---

## 3. Виджет "Рекомендации"

### Для администратора

**Расположение:** Страница клиента → "Управлять виджетами" → Вкладка "Рекомендации"

**Функции:**
- Включить/отключить виджет
- Добавить новую рекомендацию:
  - Тема (обязательно)
  - Описание (опционально)
  - Стоимость работы в рублях (опционально)
- Просмотр всех текущих рекомендаций
- Удаление рекомендаций

**API endpoints:**
```
GET    /api/widgets/recommendations/:clientId          - получить виджет с рекомендациями
POST   /api/widgets/recommendations/:clientId          - создать/обновить виджет
POST   /api/widgets/recommendations/:clientId/add      - добавить рекомендацию
DELETE /api/widgets/recommendations/:recommendationId   - удалить рекомендацию
```

### Для клиента

**Расположение:** Dashboard клиента

**Отображение:**

**Вариант 1: Нет рекомендаций**
```
✓
Все работает штатно, новых рекомендаций нет
```

**Вариант 2: Есть рекомендации**
- Список рекомендаций (виден каждый пункт)
- При нажатии на рекомендацию открывается модальное окно с:
  - Названием рекомендации
  - Полным описанием
  - Стоимостью работы
  - Кнопка "Принять" - создаёт новый тикет с данными рекомендации
  - Кнопка "Закрыть"

**API endpoint для клиента:**
```
POST   /api/widgets/recommendations/:recommendationId/accept - принять рекомендацию
```

---

## 4. Виджет "Доступность сайта"

### Для администратора

**Расположение:** Страница клиента → "Управлять виджетами" → Вкладка "Доступность сайта"

**Функции:**
- Включить/отключить виджет
- Указать URL сайта для проверки (обязательно при включении)
- Информация о последней проверке (статус, время)

**API endpoints:**
```
GET    /api/widgets/site-availability/:clientId  - получить виджет
POST   /api/widgets/site-availability/:clientId  - создать/обновить виджет
```

### Для клиента

**Расположение:** Dashboard клиента

**Отображение:**

**После первой проверки (происходит ежедневно в 04:00):**

Зелёный фон (успех):
```
Доступность сайта
https://example.com

✓ Последняя проверка в [дата и время] прошла успешно

[HTML-скриншот/информация о проверке]
```

Красный фон (ошибка):
```
Доступность сайта
https://example.com

✗ Сайт был недоступен в [дата и время]
Ошибка: [описание ошибки]
```

**Автоматическая проверка:**
- Крон-задача срабатывает в 04:00 (по времени сервера)
- Проверяется доступность сайта по HTTP/HTTPS
- При успехе сохраняется информация о проверке и "скриншот" (HTML-файл)
- При ошибке сохраняется сообщение об ошибке
- Каждый новый скриншот удаляет предыдущий

---

## База данных

Добавлены 5 новых таблиц:

```sql
-- Виджет: Статус рекламных кампаний
CREATE TABLE ad_campaign_widgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT 1,
  monthly_budget REAL NOT NULL,
  recommended_budget REAL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused', 'stopped')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- Виджет: Календарь обязательных обновлений
CREATE TABLE renewal_calendar_widgets (
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
);

-- Виджет: Рекомендации
CREATE TABLE recommendations_widgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- Рекомендации (записи в виджет)
CREATE TABLE recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  widget_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  cost REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (widget_id) REFERENCES recommendations_widgets(id) ON DELETE CASCADE
);

-- Виджет: Доступность сайта
CREATE TABLE site_availability_widgets (
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
);
```

---

## Использование

### Для администратора

1. Перейти на страницу клиента в разделе "Администрирование"
2. Нажать кнопку "Управлять виджетами"
3. Выбрать нужный виджет из вкладок
4. Включить виджет и заполнить необходимые данные
5. Сохранить изменения

### Для клиента

1. На главной странице Dashboard видны все активированные администратором виджеты
2. Взаимодействие зависит от типа виджета:
   - **Рекламные кампании**: просмотр информации
   - **Календарь**: просмотр дат с цветовой индикацией
   - **Рекомендации**: открытие рекомендаций и создание тикетов
   - **Доступность**: просмотр последней проверки и статуса сайта

---

## Файлы, которые были изменены/созданы

### Backend (сервер)
- `/server/index.js` - добавлены таблицы БД, API endpoints, крон-задача
- `/server/package.json` - добавлена зависимость `node-cron`

### Frontend (клиент)
- `/client/src/components/widgets/AdCampaignWidget.js` - новый компонент
- `/client/src/components/widgets/RenewalCalendarWidget.js` - новый компонент
- `/client/src/components/widgets/RecommendationsWidget.js` - новый компонент
- `/client/src/components/widgets/SiteAvailabilityWidget.js` - новый компонент
- `/client/src/pages/admin/ClientWidgetsManager.js` - новая страница управления виджетами
- `/client/src/pages/client/Dashboard.js` - обновлена для отображения виджетов
- `/client/src/pages/admin/ClientDetail.js` - добавлена кнопка управления виджетами
- `/client/src/App.tsx` - добавлен маршрут для страницы управления виджетами

---

## Примечания

- Все виджеты отключены по умолчанию при создании
- При удалении клиента все его виджеты удаляются автоматически
- Крон-задача для проверки доступности сайтов запускается каждый день в 04:00
- Скриншоты сайтов хранятся в директории `/uploads/screenshots`
- API endpoints защищены проверкой авторизации
- Клиенты могут видеть только свои виджеты
- Рекомендация при принятии создаёт новый тикет в статусе "open"
