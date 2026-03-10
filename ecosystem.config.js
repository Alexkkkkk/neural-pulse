module.exports = {
  apps: [{
    name: "pulse-bot",
    script: "http-wrapper.js",
    autorestart: true,
    exp_backoff_restart_delay: 100,
    env: { NODE_ENV: "production" }
  }]
}
