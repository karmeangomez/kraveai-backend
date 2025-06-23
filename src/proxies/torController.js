const { exec } = require('child_process');

async function rotateTorIP() {
  return new Promise((resolve) => {
    exec('sudo systemctl restart tor', (error) => {
      if (!error) {
        console.log('🔄 IP Tor rotada (SIGNAL NEWNYM)');
        resolve(true);
      }
    });
  });
}
