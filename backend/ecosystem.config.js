// PM2 Ecosystem Configuration for Leave Management Backend
// This ensures the server stays running and auto-restarts on crashes

module.exports = {
  apps: [{
    name: 'hrportal-backend',
    script: './src/server.js',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    // Auto-restart settings
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 4000,
    // Error handling
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    merge_logs: true,
    // Keep process alive
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
    // Health monitoring
    exp_backoff_restart_delay: 100,
    // Prevent disconnections
    shutdown_with_message: true
  }]
};

