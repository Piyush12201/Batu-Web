{
  "apps": [
    {
      "name": "alumni-backend",
      "script": "./server.js",
      "instances": "max",
      "exec_mode": "cluster",
      "env": {
        "NODE_ENV": "production",
        "PORT": 5000
      },
      "error_file": "./logs/pm2-error.log",
      "out_file": "./logs/pm2-out.log",
      "log_date_format": "YYYY-MM-DD HH:mm:ss Z",
      "merge_logs": true,
      "autorestart": true,
      "max_restarts": 10,
      "min_uptime": "10s",
      "max_memory_restart": "500M",
      "watch": false,
      "ignore_watch": ["node_modules", "logs", "uploads"],
      "kill_timeout": 5000,
      "wait_ready": true,
      "listen_timeout": 10000,
      "shutdown_with_message": true,
      "instance_var": "INSTANCE_ID",
      "combine_logs": true,
      "cron_restart": "0 3 * * *",
      "vizion": true,
      "post_update": ["npm install"],
      "exp_backoff_restart_delay": 100
    }
  ]
}
