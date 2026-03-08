#!/bin/bash

# --- НАСТРОЙКИ ---
DOMAIN="your-domain.com"          # ЗАМЕНИ НА СВОЙ
EMAIL="your-email@gmail.com"      # ЗАМЕНИ НА СВОЙ
PROJECT_ROOT="/home/user/my_project" # ЗАМЕНИ НА ПУТЬ К ПРОЕКТУ

echo "🚀 Начинаю процесс обновления..."

# 1. Затягиваем последние изменения
cd $PROJECT_ROOT
git pull origin main

# 2. Установка зависимостей (убедись, что venv создан)
if [ -d "venv" ]; then
    source venv/bin/activate
    pip install -r requirements.txt
fi

# 3. Настройка Nginx (динамическое создание конфига)
# Мы выносим заголовки безопасности прямо в server блок для надежности
sudo bash -c "cat > /etc/nginx/sites-available/neural_pulse <<EOF
# Настройка кэширования статики
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

    # Безопасность для Telegram Mini App
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection \"1; mode=block\";
    add_header Content-Security-Policy \"frame-ancestors https://t.me https://web.telegram.org https://desktop.telegram.org;\";

    # Сжатие
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    # Раздача картинок
    location /images/ {
        expires \$expires;
        add_header Cache-Control \"public, no-transform\";
    }

    # API запросы к Python
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Для WebSockets
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \"upgrade\";
    }

    # Главная страница и роутинг
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF"

# 4. Активация конфига
echo "⚙️ Проверка конфигурации Nginx..."
sudo ln -sf /etc/nginx/sites-available/neural_pulse /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

if sudo nginx -t; then
    sudo systemctl restart nginx
else
    echo "❌ Ошибка в конфиге Nginx! Откат изменений."
    exit 1
fi

# 5. Проверка SSL (Certbot)
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    echo "🔐 Сертификат не найден. Получаю новый SSL..."
    sudo certbot --nginx -d $DOMAIN --email $EMAIL --agree-tos --no-eff-email --redirect --non-interactive
else
    echo "✅ SSL уже активен."
    # На всякий случай обновляем, если срок подходит
    sudo certbot renew --quiet
fi

# 6. Перезапуск бэкенда
echo "🔄 Перезапуск Python сервиса..."
sudo systemctl restart neural_pulse.service

echo "✨ Обновление завершено! Сайт должен быть доступен по адресу: https://$DOMAIN"
