import { exec } from 'child_process';

export default async function rotateTorIP() {
  return new Promise((resolve, reject) => {
    console.log('🔄 Rotando IP de Tor...');
    exec('sudo systemctl restart tor', (error) => {
      if (error) {
        console.error('❌ Error rotando Tor, intentando método alternativo...');
        exec('sudo pkill -HUP tor', (altError) => {
          if (altError) {
            console.error('🔥 Error crítico con Tor:', altError.message);
            reject(altError);
          } else {
            console.log('✅ IP de Tor rotada (método alternativo)');
            resolve();
          }
        });
        return;
      }
      console.log('✅ IP de Tor rotada');
      resolve();
    });
  });
}
