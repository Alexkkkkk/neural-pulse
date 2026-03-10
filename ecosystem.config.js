module.exports = {
  apps: [{
    name: "np-core",
    script: "http-wrapper.js",
    instances: 1,
    exec_mode: "fork",
    autorestart: true,
    wait_ready: true,
    listen_timeout: 10000,
    max_memory_restart: '400M',
    env: {
      NODE_ENV: "production",
      PORT: 3000
    },
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    error_file: "logs/err.log",
    out_file: "logs/out.log"
  }]
}
