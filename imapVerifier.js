// imapVerifier.js
const Imap = require('imap');
const logger = require('./logger');

const imapConfig = {
  user: 'admin@kraveapi.xyz',
  password: 'Pedrero160794',
  host: 'imap.ionos.mx',
  port: 993,
  tls: true,
  authTimeout: 10000,
  connTimeout: 30000
};

function getVerificationCode(targetEmail) {
  return new Promise((resolve) => {
    const imap = new Imap(imapConfig);

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err) => {
        if (err) {
          logger.error(`❌ Error al abrir INBOX: ${err.message}`);
          return resolve(null);
        }

        const searchCriteria = [
          'UNSEEN',
          'FROM', 'no-reply@instagram.com',
          ['SINCE', new Date(Date.now() - 10 * 60 * 1000)]
        ];

        imap.search(searchCriteria, (err, results) => {
          if (err || !results.length) {
            logger.warn(`⚠️ No hay emails nuevos de Instagram para ${targetEmail}`);
            imap.end();
            return resolve(null);
          }

          const latest = results.pop();
          const fetch = imap.fetch(latest, { bodies: ['TEXT'], markSeen: true });

          fetch.on('message', (msg) => {
            let body = '';
            msg.on('body', (stream) => {
              stream.on('data', (chunk) => body += chunk.toString('utf8'));
              stream.on('end', () => {
                const codeMatch = body.match(/\b\d{6}\b/);
                if (codeMatch) {
                  logger.success(`✅ Código encontrado para ${targetEmail}: ${codeMatch[0]}`);
                  resolve(codeMatch[0]);
                } else {
                  logger.warn(`📭 Email recibido pero sin código detectable.`);
                  resolve(null);
                }
              });
            });
          });

          fetch.once('error', (err) => {
            logger.error(`📪 Error al leer el mensaje: ${err.message}`);
            resolve(null);
          });
        });
      });
    });

    imap.once('error', (err) => {
      logger.error(`🚨 Error IMAP: ${err.message}`);
      resolve(null);
    });

    imap.connect();
  });
}

// Opcional: email generator con subdominios
function getEmail() {
  const sub = ['a', 'b', 'c', 'x', 'z'];
  const rand = Math.random().toString(36).slice(2, 8);
  const dominio = sub[Math.floor(Math.random() * sub.length)];
  return `insta_${rand}@${dominio}.kraveapi.xyz`;
}

module.exports = { getEmail, getVerificationCode };
