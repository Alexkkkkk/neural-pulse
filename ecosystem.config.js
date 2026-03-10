module.exports = {
  apps: [{
    name: "np-app",
    script: "app.js",
    autorestart: true,
    wait_ready: true,
    max_memory_restart: '400M',
    error_file: "logs/err.log",
    out_file: "logs/out.log"
  }]
}
