module.exports = {
  apps: [{
    name: "neural-pulse",
    script: "http-wrapper.js",
    instances: 1,
    exec_mode: "fork",
    autorestart: true,
    watch: false,
    max_memory_restart: '400M',
    wait_ready: true,
    listen_timeout: 5000,
    env: {
      NODE_ENV: "production",
      PORT: 3000
    },
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    error_file: "logs/err.log",
    out_file: "logs/out.log"
  }]
}
