module.exports = {
  apps: [{
    name: "kraveai-backend",
    script: "src/main.py",
    interpreter: "venv/bin/python",
    cwd: "/home/karmean/kraveai-backend",
    env: {
      NODE_ENV: "production"
    },
    error_file: "logs/err.log",
    out_file: "logs/out.log",
    log_file: "logs/combined.log",
    time: true
  }]
}
