module.exports = {
  apps: [
    {
      name: "krave-backend",
      cwd: "/home/karmean/kraveai-backend/src",
      interpreter: "/home/karmean/venv/bin/python",
      script: "-m",
      args: "uvicorn main:app --host 0.0.0.0 --port 8000",
      env: {
        PORT: 8000,
        HOST: "0.0.0.0",
        ENV: "production"
      }
    },
    {
      name: "krave-tunnel",
      script: "cloudflared",
      args: "tunnel run 609fe7fb-d511-4d68-a303-39bafd3da360"
    }
  ]
};
