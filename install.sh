#!/bin/bash
set -e

# ============================================================================
# Cursor Helpdesk — Автоматический скрипт развёртывания на Ubuntu/Debian
# ============================================================================
# Использование:
#   chmod +x install.sh
#   sudo ./install.sh
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="cursor-helpdesk"
APP_USER="www-data"
APP_HOME="/var/www/${PROJECT_NAME}"

echo "=========================================="
echo "Cursor Helpdesk — Развёртывание"
echo "=========================================="
echo ""

# ============================================================================
# 1. Проверка прав sudo
# ============================================================================
if [ "$EUID" -ne 0 ]; then
  echo "❌ Скрипт должен быть запущен с sudo. Выполните:"
  echo "   sudo ./install.sh"
  exit 1
fi

echo "✓ Права sudo получены"
echo ""

# ============================================================================
# 2. Переменные окружения
# ============================================================================
read -p "Введите домен для сайта (например: example.com): " DOMAIN
if [ -z "$DOMAIN" ]; then
  echo "❌ Домен не может быть пустым"
  exit 1
fi

read -p "Введите вторичный домен или пропустите (например: www.example.com): " DOMAIN_WWW
if [ -z "$DOMAIN_WWW" ]; then
  DOMAIN_WWW="www.$DOMAIN"
fi

read -sp "Введите JWT_SECRET для сервера (минимум 20 символов): " JWT_SECRET
if [ ${#JWT_SECRET} -lt 20 ]; then
  echo ""
  echo "❌ JWT_SECRET должен быть минимум 20 символов"
  exit 1
fi
echo ""

echo ""
echo "=========================================="
echo "Переданные параметры:"
echo "  Домен: $DOMAIN"
echo "  WWW-домен: $DOMAIN_WWW"
echo "  JWT_SECRET: [скрыт]"
echo "  Проект будет в: $APP_HOME"
echo "=========================================="
echo ""

# ============================================================================
# 3. Обновление системы
# ============================================================================
echo "▶ Обновление системы..."
apt-get update
apt-get upgrade -y
apt-get install -y curl git build-essential snapd

echo "✓ Система обновлена"
echo ""

# ============================================================================
# 4. Установка Node.js (LTS)
# ============================================================================
echo "▶ Установка Node.js LTS..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
  apt-get install -y nodejs
else
  echo "✓ Node.js уже установлен: $(node --version)"
fi
echo "✓ Node.js установлен: $(node --version)"
echo "✓ npm: $(npm --version)"
echo ""

# ============================================================================
# 5. Установка nginx
# ============================================================================
echo "▶ Установка nginx..."
if ! command -v nginx &> /dev/null; then
  apt-get install -y nginx
else
  echo "✓ nginx уже установлен"
fi
echo "✓ nginx установлен"
echo ""

# ============================================================================
# 6. Установка certbot (Let's Encrypt)
# ============================================================================
echo "▶ Установка Certbot..."
snap install core
snap refresh core
snap install --classic certbot
ln -s /snap/bin/certbot /usr/bin/certbot || true
echo "✓ Certbot установлен"
echo ""

# ============================================================================
# 7. Установка PM2
# ============================================================================
echo "▶ Установка PM2..."
npm install -g pm2
echo "✓ PM2 установлен"
echo ""

# ============================================================================
# 8. Установка шрифтов для кириллицы
# ============================================================================
echo "▶ Установка шрифтов DejaVu..."
apt-get install -y fonts-dejavu
echo "✓ Шрифты установлены"
echo ""

# ============================================================================
# 9. Копирование проекта
# ============================================================================
echo "▶ Подготовка директории проекта..."
if [ -d "$APP_HOME" ]; then
  echo "  (Директория $APP_HOME уже существует, обновляем)"
else
  mkdir -p "$APP_HOME"
fi
chown "$APP_USER:$APP_USER" "$APP_HOME"

# Если скрипт запущен из директории проекта, копируем оттуда
if [ -f "$SCRIPT_DIR/package.json" ] || [ -d "$SCRIPT_DIR/server" ]; then
  echo "  Копирование проекта из $SCRIPT_DIR..."
  cp -r "$SCRIPT_DIR"/* "$APP_HOME/" 2>/dev/null || true
  cp -r "$SCRIPT_DIR"/.git "$APP_HOME/" 2>/dev/null || true
else
  echo "  Скрипт не в корне проекта; предполагаем, что проект уже загружен"
fi

chown -R "$APP_USER:$APP_USER" "$APP_HOME"
echo "✓ Проект готов в $APP_HOME"
echo ""

# ============================================================================
# 10. Установка зависимостей backend
# ============================================================================
echo "▶ Установка зависимостей backend..."
cd "$APP_HOME/server"
npm install
echo "✓ Backend зависимости установлены"
echo ""

# ============================================================================
# 11. Установка и сборка frontend
# ============================================================================
echo "▶ Сборка frontend..."
cd "$APP_HOME/client"
npm install
npm run build
echo "✓ Frontend собран в client/build"
echo ""

# ============================================================================
# 12. Подготовка шрифтов для backend
# ============================================================================
echo "▶ Подготовка шрифтов для backend..."
mkdir -p "$APP_HOME/server/fonts"
if [ -f "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf" ]; then
  cp /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf "$APP_HOME/server/fonts/"
  echo "✓ DejaVuSans.ttf скопирован в server/fonts/"
fi
chown -R "$APP_USER:$APP_USER" "$APP_HOME/server/fonts"
echo ""

# ============================================================================
# 13. Создание .env для backend
# ============================================================================
echo "▶ Создание .env для backend..."
cat > "$APP_HOME/server/.env" <<EOF
PORT=5001
JWT_SECRET=$JWT_SECRET
NODE_ENV=production
EOF
chown "$APP_USER:$APP_USER" "$APP_HOME/server/.env"
chmod 600 "$APP_HOME/server/.env"
echo "✓ .env создан"
echo ""

# ============================================================================
# 14. Создание и запуск backend через PM2
# ============================================================================
echo "▶ Запуск backend с PM2..."
cd "$APP_HOME/server"

# Остановить и удалить старые процессы, если есть
pm2 delete "$PROJECT_NAME-backend" 2>/dev/null || true

# Запустить новый процесс
pm2 start index.js \
  --name "$PROJECT_NAME-backend" \
  --cwd "$APP_HOME/server" \
  --env NODE_ENV=production \
  

pm2 save

# Настроить автозапуск через systemd для пользователя, запустившего sudo (если есть)
if [ -n "${SUDO_USER:-}" ]; then
  echo "▶ Настройка автозапуска PM2 для пользователя ${SUDO_USER}..."
  pm2 startup systemd -u "$SUDO_USER" --hp "/home/$SUDO_USER"
  echo "Если pm2 вывел команду для выполнения — выполните её с sudo, чтобы завершить настройку автозапуска."
fi

echo "✓ Backend запущен под PM2"
echo ""

# ============================================================================
# 15. Конфигурация nginx
# ============================================================================
echo "▶ Конфигурация nginx..."

# Удалить дефолтный сайт
rm -f /etc/nginx/sites-enabled/default

# Создать начальный конфиг для проекта (HTTP-only)
#  — 443 сервер с SSL добавим после получения сертификата
cat > "/etc/nginx/sites-available/$PROJECT_NAME" <<EOF
server {
  listen 80;
  listen [::]:80;
  server_name $DOMAIN $DOMAIN_WWW;

  root $APP_HOME/client/build;
  index index.html index.htm;

  client_max_body_size 50M;

  # SPA routing
  location / {
    try_files \$uri \$uri/ /index.html;
  }

  # API прокси
  location /api/ {
    proxy_pass http://127.0.0.1:5001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_cache_bypass \$http_upgrade;
  }

  # Статические файлы (uploads)
  location /uploads/ {
    alias $APP_HOME/server/uploads/;
    autoindex off;
    expires 30d;
  }

  access_log /var/log/nginx/$PROJECT_NAME-access.log;
  error_log /var/log/nginx/$PROJECT_NAME-error.log;
}
EOF

# Включить сайт
ln -sf "/etc/nginx/sites-available/$PROJECT_NAME" /etc/nginx/sites-enabled/

# Проверить конфиг
nginx -t

# Перезагрузить nginx
systemctl reload nginx

echo "✓ nginx конфигурирован"
echo ""

# ============================================================================
# 16. Получение SSL через Certbot
# ============================================================================
echo "▶ Получение SSL сертификата (Let's Encrypt)..."
echo ""
echo "  ВАЖНО: Убедитесь, что DNS для $DOMAIN уже указывает на этот сервер!"
echo "  Если DNS ещё не настроена, остановите скрипт (Ctrl+C) и настройте DNS."
echo ""
read -p "Нажмите Enter, когда DNS будет готово (или Ctrl+C для отмены): "

# Остановить nginx перед certbot (если используется webroot)
systemctl stop nginx

# Получить сертификат
certbot certonly \
  --standalone \
  -d "$DOMAIN" \
  -d "$DOMAIN_WWW" \
  --non-interactive \
  --agree-tos \
  --email "admin@$DOMAIN" \
  --expand

# Снова запустить nginx
systemctl start nginx

echo "✓ SSL сертификат получен"
echo ""

# ============================================================================
# 17. Обновление nginx конфига с SSL путями
# ============================================================================
echo "▶ Обновление nginx конфига с SSL сертификатами..."
cat > "/etc/nginx/sites-available/$PROJECT_NAME" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN $DOMAIN_WWW;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN $DOMAIN_WWW;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    root $APP_HOME/client/build;
    index index.html index.htm;
    client_max_body_size 50M;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    location /uploads/ {
        alias $APP_HOME/server/uploads/;
        autoindex off;
        expires 30d;
    }

    access_log /var/log/nginx/$PROJECT_NAME-access.log;
    error_log /var/log/nginx/$PROJECT_NAME-error.log;
}
EOF

nginx -t
systemctl reload nginx

echo "✓ nginx обновлён с SSL"
echo ""

# ============================================================================
# 18. Настройка автоматического продления сертификата
# ============================================================================
echo "▶ Настройка автоматического продления SSL..."
certbot renew --dry-run
echo "✓ Автоматическое продление настроено"
echo ""

# ============================================================================
# 19. Права доступа
# ============================================================================
echo "▶ Установка прав доступа..."
chown -R "$APP_USER:$APP_USER" "$APP_HOME/server/uploads" 2>/dev/null || true
chmod -R 755 "$APP_HOME/server/uploads" 2>/dev/null || true
echo "✓ Права установлены"
echo ""

# ============================================================================
# 20. Проверки и итоговый отчёт
# ============================================================================
echo "=========================================="
echo "✓ РАЗВЁРТЫВАНИЕ ЗАВЕРШЕНО"
echo "=========================================="
echo ""
echo "Информация о сервисах:"
echo "  Backend (PM2): $PROJECT_NAME-backend"
echo "  Frontend: https://$DOMAIN"
echo "  Проект: $APP_HOME"
echo ""
echo "Полезные команды:"
echo "  # Статус backend"
echo "  pm2 status"
echo ""
echo "  # Логи backend"
echo "  pm2 logs $PROJECT_NAME-backend"
echo ""
echo "  # Перезапуск backend"
echo "  pm2 restart $PROJECT_NAME-backend"
echo ""
echo "  # Логи nginx"
echo "  tail -f /var/log/nginx/$PROJECT_NAME-access.log"
echo "  tail -f /var/log/nginx/$PROJECT_NAME-error.log"
echo ""
echo "  # Проверка SSL"
echo "  certbot certificates"
echo ""
echo "=========================================="
echo "🎉 Готово! Откройте https://$DOMAIN в браузере"
echo "=========================================="
