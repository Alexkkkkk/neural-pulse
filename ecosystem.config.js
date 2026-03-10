module.exports = {
  apps: [{
    name: "neural-pulse",
    script: "http-wrapper.js",
    instances: 1,
    exec_mode: "fork",
    autorestart: true,
    wait_ready: true,
    listen_timeout: 8000,
    env: {
      NODE_ENV: "production",
      PORT: 3000
    }
  }]
}
