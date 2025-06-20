// fingerprintTracker.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TRACKER_FILE = path.join(__dirname, 'fingerprint_history.json');

// Cargar historial
function loadTracker() {
  if (!fs.existsSync(TRACKER_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf8'));
  } catch {
    return {};
  }
}

// Guardar historial
function saveTracker(data) {
  fs.writeFileSync(TRACKER_FILE, JSON.stringify(data, null, 2));
}

// Generar hash único por fingerprint (basado en userAgent + timezoneId)
function getFingerprintHash(fp) {
  return crypto.createHash('md5').update(fp.userAgent + fp.timezoneId).digest('hex');
}

// Registrar resultado del fingerprint
function logFingerprintResult(fingerprint, status) {
  const tracker = loadTracker();
  const hash = getFingerprintHash(fingerprint);

  if (!tracker[hash]) {
    tracker[hash] = {
      fingerprint,
      used: 0,
      success: 0,
      error: 0,
      shadowban: 0,
      lastUsed: null
    };
  }

  tracker[hash].used++;
  tracker[hash].lastUsed = new Date().toISOString();

  if (status === 'success') tracker[hash].success++;
  else if (status === 'shadowbanned') tracker[hash].shadowban++;
  else tracker[hash].error++;

  saveTracker(tracker);
}

// Obtener resumen de todos los fingerprints
function getFingerprintStats() {
  const tracker = loadTracker();
  return Object.entries(tracker).map(([hash, data]) => ({
    hash,
    used: data.used,
    success: data.success,
    error: data.error,
    shadowban: data.shadowban,
    ratio: data.used > 0 ? `${((data.success / data.used) * 100).toFixed(1)}%` : '0%'
  })).sort((a, b) => b.success - a.success);
}

module.exports = {
  logFingerprintResult,
  getFingerprintStats
};
