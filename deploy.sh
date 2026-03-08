#!/bin/bash

# --- НАСТРОЙКИ (поменяй под себя один раз) ---
DOMAIN="your-domain.com"
EMAIL="your-email@gmail.com"
PROJECT_ROOT="/home/user/my_project" # Путь где лежит твой код

echo "🚀 Начинаю процесс обновления..."

# 1. Затягиваем последние изменения из GitHub
git pull origin main

# 2. Установка зависимостей Python (если они изменились)
source venv/bin/activate
pip install -r requirements.txt

# 3. Копируем конфиг Nginx в системную папку
# Мы используем 'cat', чтобы конфиг всегда был актуальным
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

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF"

# 4. Активируем конфиг и перезапускаем Nginx
sudo ln -sf /etc/nginx/sites-available/neural_pulse /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

# 5. Проверка SSL (Certbot)
# Если сертификата нет — он создаст его. Если есть — просто пропустит.
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    echo "🔐 Сертификат не найден. Запускаю получение SSL..."
    sudo certbot --nginx -d $DOMAIN --email $EMAIL --agree-tos --no-eff-email --redirect --non-interactive
else
    echo "✅ SSL уже настроен."
fi

# 6. Перезапуск твоего Python сервера (через Systemd или Gunicorn)
# Замени 'neural_pulse.service' на имя твоего сервиса
sudo systemctl restart neural_pulse.service

echo "✨ Обновление завершено успешно!"
