module.exports = {
  apps: [
    {
      name: "backend",
      cwd: "/home/karmean/kraveai-backend",
      script: "/home/karmean/kraveai-backend/venv/bin/python",
      args: "src/main.py",
      interpreter: "/home/karmean/kraveai-backend/venv/bin/python",
      watch: false,
      env: {
        PYTHONUNBUFFERED: "1",
      },
      error_file: "logs/error.log",
      out_file: "logs/out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
