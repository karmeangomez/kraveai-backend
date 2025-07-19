module.exports = {
  apps: [{
    name: "backend",
    script: "/home/karmean/kraveai-backend/start.sh",
    cwd: "/home/karmean/kraveai-backend",
    autorestart: true,
    watch: false,
    max_memory_restart: "300M",
    env: {
      NODE_ENV: "production"
    },
    log_date_format: "YYYY-MM-DD HH:mm Z",
    error_file: "logs/error.log",
    out_file: "logs/out.log",
    combine_logs: true
  }]
};
