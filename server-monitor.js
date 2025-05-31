const { exec } = require('child_process');
const path = require('path');

console.log("🚀 Iniciando monitor del servidor KraveAI...");
let serverProcess;

function startServer() {
  serverProcess = exec('node server.js', { cwd: __dirname });
  
  serverProcess.stdout.on('data', (data) => {
    console.log(`[SERVER] ${data}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`[SERVER ERROR] ${data}`);
  });

  serverProcess.on('close', (code) => {
    console.error(`💥 Servidor caído (código ${code}). Reiniciando en 5s...`);
    setTimeout(startServer, 5000);
  });
}

startServer();

process.on('SIGINT', () => {
  serverProcess.kill();
  process.exit();
});
