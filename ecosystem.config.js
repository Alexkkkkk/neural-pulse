module.exports = {
  apps: [{
    name: "neural-pulse",
    script: "server.js",
    autorestart: true,
    env: { NODE_ENV: "production", PORT: 3000 }
  }]
}
