// webhook_listener.js
const express = require('express');
const { exec } = require('child_process');
const app = express();

app.use(express.json());

app.post('/', (req, res) => {
  const event = req.headers['x-github-event'];

  if (event === 'push') {
    console.log('📥 Push recibido, actualizando proyecto...');
    exec('cd ~/kraveai && git pull && pm2 restart server', (err, stdout, stderr) => {
      if (err) {
        console.error('❌ Error al hacer pull o reiniciar:', err);
        return res.sendStatus(500);
      }
      console.log('✅ Proyecto actualizado:\n', stdout);
      res.sendStatus(200);
    });
  } else {
    res.sendStatus(204); // No hacemos nada para otros eventos
  }
});

app.listen(5000, () => {
  console.log('🔔 Webhook listener activo en puerto 5000');
});
