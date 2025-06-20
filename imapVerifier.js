// 📂 imapVerifier.js (Configuración oficial IONOS)
const Imap = require('imap');
const logger = require('./logger');

module.exports.verificarEmail = (targetEmail) => {
  return new Promise((resolve) => {
    const imap = new Imap({
      user: 'admin@kraveapi.xyz',       // Tu email completo
      password: 'TuContraseñaIONOS',    // Contraseña del email (no la de IONOS)
      host: 'imap.ionos.mx',            // Servidor IMAP oficial de IONOS
      port: 993,                        // Puerto seguro (SSL)
      tls: true,
      authTimeout: 10000,               // 10 segundos máximo de espera
      connTimeout: 30000                // 30 segundos para conexión
    });

    // Eventos IMAP
    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          logger.error(`❌ Error al abrir INBOX: ${err.message}`);
          return resolve(false);
        }

        // Filtros de búsqueda (últimos 10 minutos)
        const searchCriteria = [
          'UNSEEN',                     // Solo emails no leídos
          'FROM "no-reply@instagram.com"',
          ['SINCE', new Date(Date.now() - 10 * 60 * 1000)] // Últimos 10 min
        ];

        imap.search(searchCriteria, (err, results) => {
          if (err || !results.length) {
            imap.end();
            logger.warning(`⚠️ No hay emails nuevos de Instagram para ${targetEmail}`);
            return resolve(false);
          }

          // Procesar el email más reciente
          const latestEmail = results[results.length - 1];
          const fetch = imap.fetch(latestEmail, { 
            bodies: ['HEADER', 'TEXT'], 
            markSeen: true // Marcar como leído
          });

          fetch.on('message', (msg) => {
            let body = '';
            msg.on('body', (stream, info) => {
              stream.on('data', (chunk) => body += chunk.toString('utf8'));
              stream.on('end', () => {
                // Detectar verificación de Instagram
                if (/Confirmar|Verify|Código de verificación/i.test(body)) {
                  logger.success(`✅ Email de Instagram encontrado para ${targetEmail}`);
                  resolve(true);
                }
              });
            });
          });

          fetch.on('error', (err) => {
            logger.error(`📪 Error al leer email: ${err.message}`);
            resolve(false);
          });
        });
      });
    });

    imap.once('error', (err) => {
      logger.error(`🚨 Error IMAP: ${err.message}`);
      resolve(false);
    });

    imap.connect();
  });
};
