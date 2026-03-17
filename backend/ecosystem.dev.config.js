{
  "apps": [
    {
      "name": "alumni-backend-dev",
      "script": "./server.js",
      "instances": 1,
      "exec_mode": "fork",
      "env": {
        "NODE_ENV": "development",
        "PORT": 5000
      },
      "error_file": "./logs/pm2-dev-error.log",
      "out_file": "./logs/pm2-dev-out.log",
      "log_date_format": "YYYY-MM-DD HH:mm:ss Z",
      "merge_logs": true,
      "autorestart": true,
      "watch": true,
      "ignore_watch": [
        "node_modules",
        "logs",
        "uploads",
        "*.log",
        ".git"
      ],
      "watch_delay": 1000,
      "max_memory_restart": "300M",
      "kill_timeout": 3000
    }
  ]
}
