#!/bin/bash

# --- НАСТРОЙКИ ---
DOMAIN="np.bothost.ru"             
EMAIL="your-email@gmail.com"       
PROJECT_ROOT="/home/ubuntu/neural-pulse" 

echo "🚀 [1/6] Начинаю процесс обновления системы..."

# 1. Затягиваем последние изменения
cd $PROJECT_ROOT || { echo "❌ Папка проекта не найдена"; exit 1; }

# Проверяем, есть ли права на запись в папку с БД
if [ ! -w "data" ]; then
    echo "⚠️ Исправляю права доступа для папки данных..."
    sudo chown -R $USER:$USER data
    chmod -R 755 data
fi

echo "📥 Загрузка свежего кода из GitHub..."
git pull origin main

# 2. Установка зависимостей Node.js
echo "📦 [2/6] Установка пакетов npm..."
# Используем --frozen-lockfile если есть package-lock.json для стабильности
npm install --no-audit --no-fund

# 3. Настройка Nginx
echo "⚙️ [3/6] Генерация конфигурации Nginx..."
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

    access_log /var/log/nginx/neural_pulse_access.log;
    error_log /var/log/nginx/neural_pulse_error.log;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    
    # Безопасность для Telegram WebApp
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection \"1; mode=block\";
    add_header Content-Security-Policy \"frame-ancestors https://t.me https://web.telegram.org https://desktop.telegram.org;\";

    location /images/ {
        expires \$expires;
        add_header Cache-Control \"public, no-transform\";
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \"upgrade\";
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF"

# 4. Проверка и активация Nginx
echo "🛠 [4/6] Валидация Nginx..."
sudo ln -sf /etc/nginx/sites-available/neural_pulse /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

if sudo nginx -t; then
    sudo systemctl restart nginx
else
    echo "❌ Ошибка в конфиге Nginx! Откат невозможен, проверьте вручную."
    exit 1
fi

# 5. SSL через Certbot
echo "🔐 [5/6] Проверка SSL сертификата..."
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    sudo certbot --nginx -d $DOMAIN --email $EMAIL --agree-tos --no-eff-email --redirect --non-interactive
else
    sudo certbot renew --quiet
fi

# 6. Перезапуск приложения через PM2
echo "🔄 [6/6] Перезагрузка Node.js ядра..."
# reload обеспечивает zero-downtime перезапуск
npm run reload || npm run prod

echo "✨ ДЕПЛОЙ ЗАВЕРШЕН УСПЕШНО!"
echo "🌍 Адрес: https://$DOMAIN"
