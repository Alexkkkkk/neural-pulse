module.exports = {
  apps: [{
    name: "neural-pulse",
    script: "http-wrapper.js",
    autorestart: true,
    wait_ready: true,
    max_memory_restart: '400M',
    env: {
      NODE_ENV: "production",
      PORT: 3000
    },
    error_file: "logs/err.log",
    out_file: "logs/out.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss"
  }]
}
