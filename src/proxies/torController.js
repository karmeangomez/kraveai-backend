import { exec } from 'child_process';

export default async function rotateTorIP() {
  return new Promise((resolve, reject) => {
    console.log('🔄 Rotando IP de Tor...');
    exec('sudo service tor restart', (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ Error rotando IP: ${error.message}`);
        reject(error);
        return;
      }
      console.log('✅ IP de Tor rotada');
      resolve();
    });
  });
}
