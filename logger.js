class Logger {
  log(level, message) {
    const timestamp = new Date().toISOString();
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      warn: '\x1b[33m',
      error: '\x1b[31m',
      reset: '\x1b[0m'
    };

    const logLine = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    console.log(`${colors[level] || ''}${logLine}${colors.reset}`);
  }

  info(msg) { this.log('info', msg); }
  success(msg) { this.log('success', msg); }
  warn(msg) { this.log('warn', msg); }
  error(msg) { this.log('error', msg); }
}

module.exports = Logger;
