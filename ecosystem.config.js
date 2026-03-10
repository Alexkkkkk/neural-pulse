
module.exports = {
  apps: [{
    name: "neural-pulse",
    script: "server.js",
    autorestart: true,
    max_memory_restart: '450M',
    env: { NODE_ENV: "production", PORT: 3000 }
  }]
}
