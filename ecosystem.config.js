module.exports = {
  apps: [
    {
      name: "backend",
      script: "bash",
      args: "-c 'source /home/karmean/kraveai-backend/venv/bin/activate && uvicorn src.main:app --host 0.0.0.0 --port 8000'",
      cwd: "/home/karmean/kraveai-backend",
      autorestart: true,
    },
    {
      name: "tunnel",
      script: "cloudflared",
      args: "tunnel run kraveai",
      autorestart: true,
    },
  ],
};
