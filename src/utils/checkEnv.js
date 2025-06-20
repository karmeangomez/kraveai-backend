// src/utils/checkEnv.js
function checkEnvironment() {
  const requiredVars = ['IONOS_USER', 'IONOS_PASS'];
  const missing = [];

  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  });

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }

  console.log('✅ Environment configured properly');
}

export default checkEnvironment;
