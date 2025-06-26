import { exec } from 'child_process';

export default async function rotateTorIP() {
  return new Promise((resolve) => {
    exec('sudo systemctl restart tor', (error) => {
      if (!error) {
        console.log('🔄 IP Tor rotada (SIGNAL NEWNYM)');
        resolve(true);
      } else {
        console.error('❌ Error al reiniciar Tor:', error.message);
        resolve(false);
      }
    });
  });
}
