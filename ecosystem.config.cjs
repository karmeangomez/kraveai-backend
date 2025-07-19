module.exports = {
  apps: [
    {
      name: "backend",
      cwd: "/home/karmean/kraveai-backend",
      script: "bash",
      args: "-c 'source /home/karmean/kraveai-backend/venv/bin/activate && uvicorn src.main:app --host 0.0.0.0 --port 8000'",
      interpreter: "/bin/bash",
      watch: false,
      log_date_format: "YYYY-MM-DD HH:mm Z",
      error_file: "/home/karmean/kraveai-backend/logs/error.log",
      out_file: "/home/karmean/kraveai-backend/logs/out.log",
      combine_logs: true,
      time: true
    }
  ]
};

