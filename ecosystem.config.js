module.exports = {
  apps: [{
    name: "pulse-bot-main",
    script: "server.js",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '450M',
    env: {
      NODE_ENV: "production",
      PORT: 3000
    }
  }]
}
