// networkEmulator.js
module.exports = async function emulateNetwork(page, connectionType = '4g') {
  const client = await page.target().createCDPSession();

  // Parámetros base por tipo de red
  const profiles = {
    '4g': {
      offline: false,
      latency: 70,
      downloadThroughput: (5 * 1024 * 1024) / 8, // 5 Mbps
      uploadThroughput: (1.5 * 1024 * 1024) / 8  // 1.5 Mbps
    },
    '3g': {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8
    },
    'wifi': {
      offline: false,
      latency: 30,
      downloadThroughput: (12 * 1024 * 1024) / 8,
      uploadThroughput: (3 * 1024 * 1024) / 8
    },
    'ethernet': {
      offline: false,
      latency: 20,
      downloadThroughput: (20 * 1024 * 1024) / 8,
      uploadThroughput: (5 * 1024 * 1024) / 8
    }
  };

  const profile = profiles[connectionType] || profiles['4g'];

  try {
    await client.send('Network.enable');
    await client.send('Network.emulateNetworkConditions', {
      offline: profile.offline,
      latency: profile.latency,
      downloadThroughput: profile.downloadThroughput,
      uploadThroughput: profile.uploadThroughput,
      connectionType: connectionType.toUpperCase()
    });

    // Spoof de navigator.connection
    await page.evaluateOnNewDocument((type, rtt, down) => {
      Object.defineProperty(navigator, 'connection', {
        value: {
          effectiveType: type,
          rtt,
          downlink: down,
          saveData: false
        }
      });
    }, connectionType, profile.latency, profile.downloadThroughput / 1024 / 1024 * 8);
  } catch (err) {
    console.warn(`⚠️ No se pudo emular red: ${err.message}`);
  }
};
