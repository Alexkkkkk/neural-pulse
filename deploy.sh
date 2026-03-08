#!/bin/bash

# --- НАСТРОЙКИ ---
DOMAIN="np.bothost.ru"             # Твой домен из server.js
EMAIL="your-email@gmail.com"       # Твоя почта для SSL
PROJECT_ROOT="/home/ubuntu/neural-pulse" # Убедись, что путь верный

echo "🚀 Начинаю процесс обновления системы..."

# 1. Затягиваем последние изменения
cd $PROJECT_ROOT || { echo "❌ Папка проекта не найдена"; exit 1; }
git pull origin main

# 2. Установка зависимостей Node.js
# Благодаря скрипту "postinstall" в package.json, sqlite3 пересоберется сам
echo "📦 Установка пакетов npm..."
npm install

# 3. Настройка Nginx
echo "⚙️ Генерация конфига Nginx..."
sudo bash -c "cat > /etc/nginx/sites-available/neural_pulse <<EOF
map \$sent_http_content_type \$expires {
    default                    off;
    text/html                  epoch;
    text/css                   max;
    application/javascript     max;
    ~image/                    max;
}

server {
    listen 80;
    server_name $DOMAIN;

    root $PROJECT_ROOT/static;
    index index.html;

    # Логи
    access_log /var/log/nginx/neural_pulse_access.log;
    error_log /var/log/nginx/neural_pulse_error.log;

    # Сжатие и безопасность
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection \"1; mode=block\";
    add_header Content-Security-Policy \"frame-ancestors https://t.me https://web.telegram.org https://desktop.telegram.org;\";

    # Раздача картинок
    location /images/ {
        expires \$expires;
        add_header Cache-Control \"public, no-transform\";
    }

    # API запросы к Node.js (порт 3000 из твоего server.js)
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Поддержка WebSockets
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \"upgrade\";
    }

    # SPA роутинг
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF"

# 4. Проверка и активация Nginx
sudo ln -sf /etc/nginx/sites-available/neural_pulse /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

if sudo nginx -t; then
    sudo systemctl restart nginx
else
    echo "❌ Ошибка в конфиге Nginx!"
    exit 1
fi

# 5. SSL через Certbot
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    echo "🔐 Получение сертификата..."
    sudo certbot --nginx -d $DOMAIN --email $EMAIL --agree-tos --no-eff-email --redirect --non-interactive
else
    echo "✅ SSL активен."
    sudo certbot renew --quiet
fi

# 6. Перезапуск приложения через PM2
# Мы используем скрипты, которые ты сам добавил в package.json
echo "🔄 Перезапуск Node.js через PM2..."
npm run reload || npm run prod

echo "✨ Обновление завершено! Проект онлайн: https://$DOMAIN"
