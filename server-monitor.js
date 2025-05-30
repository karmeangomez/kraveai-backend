// server-monitor.js
const { exec } = require('child_process');
const path = require('path');

console.log("🔄 Starting KraveAI server monitor...");
let serverProcess;

function startServer() {
  serverProcess = exec('node server.js', {
    cwd: __dirname
  });
  
  serverProcess.stdout.on('data', (data) => {
    console.log(`[SERVER] ${data}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`[SERVER ERROR] ${data}`);
  });

  serverProcess.on('close', (code) => {
    console.error(`💥 Server crashed with code ${code}. Restarting in 5s...`);
    setTimeout(startServer, 5000);
  });
}

startServer();

// Manejo de cierres limpios
process.on('SIGINT', () => {
  serverProcess.kill();
  process.exit();
});
