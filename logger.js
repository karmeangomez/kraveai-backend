const colors = {
  info: '\x1b[36m',
  success: '\x1b[32m',
  warning: '\x1b[33m',
  error: '\x1b[31m',
  reset: '\x1b[0m'
};

module.exports = {
  info: (msg) => console.log(`${colors.info}[RUSO-SYS] ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.success}[✅] ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.warning}[⚠️] ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.error}[🔥] ${msg}${colors.reset}`)
};
