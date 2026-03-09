module.exports = {
  apps: [{
    name: "neural-pulse-core",
    script: "./server.js", 
    instances: 1, // Строго 1 для работы с SQLite и Webhook
    autorestart: true,
    watch: false,
    
    // Лимит памяти: PM2 перезапустит бота, если он «потечет»
    max_memory_restart: '450M', 
    
    // Защита от бесконечного цикла перезапусков при ошибках в коде
    exp_backoff_restart_delay: 2000, 
    min_uptime: "20s",
    
    // Даем 10 секунд на корректное закрытие SQLite (вызов flushToDisk)
    kill_timeout: 10000, 
    listen_timeout: 10000, // Время на установку вебхука при старте

    env: {
      NODE_ENV: "development",
      PORT: 3000
    },
    env_production: {
      NODE_ENV: "production",
      PORT: 3000,
      // Можно вынести токен сюда, если не используешь Docker Secrets
      // BOT_TOKEN: "твой_токен"
    },
    
    // Логирование внутри Docker-контейнера
    error_file: "./logs/error.log",
    out_file: "./logs/combined.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    merge_logs: true,
    
    // Оптимизация Node.js под лимиты хостинга
    node_args: "--max-old-space-size=380 --no-warnings"
  }]
}
