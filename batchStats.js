// batchStats.js
const fs = require('fs');
const path = require('path');

const STATS_DIR = path.join(__dirname, 'batch_stats');
if (!fs.existsSync(STATS_DIR)) fs.mkdirSync(STATS_DIR, { recursive: true });

function saveBatchStats({
  totalIntentadas,
  totalCreadas,
  totalShadowban,
  totalErrores,
  inicio,
  fin,
  errores = []
}) {
  const ahora = new Date();
  const nombreArchivo = `batch_${ahora.toISOString().replace(/[:]/g, '-').split('.')[0]}.json`;
  const duracionSegundos = Math.floor((fin - inicio) / 1000);
  const promedioPorCuenta = totalIntentadas > 0 ? Math.round(duracionSegundos / totalIntentadas) : 0;

  const stats = {
    timestamp: ahora.toISOString(),
    totalIntentadas,
    totalCreadas,
    totalShadowban,
    totalErrores,
    duracionSegundos,
    promedioPorCuenta,
    ratioExito: totalIntentadas > 0 ? `${((totalCreadas / totalIntentadas) * 100).toFixed(2)}%` : '0%',
    errores
  };

  fs.writeFileSync(path.join(STATS_DIR, nombreArchivo), JSON.stringify(stats, null, 2));
  console.log(`📊 Estadísticas guardadas en: batch_stats/${nombreArchivo}`);
}

module.exports = { saveBatchStats };
