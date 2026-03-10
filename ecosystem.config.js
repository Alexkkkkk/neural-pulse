module.exports = {
  apps: [{
    name: "neural-pulse-core",
    script: "http-wrapper.js",
    cwd: "/app",
    instances: 1,
    exec_mode: "fork",
    autorestart: true,
    watch: false,
    max_memory_restart: '400M',
    exp_backoff_restart_delay: 2000,
    wait_ready: true,
    listen_timeout: 8000,
    env: {
      NODE_ENV: "production",
      PORT: 3000
    },
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    error_file: "logs/err.log",
    out_file: "logs/out.log"
  }]
}
