// shadowbanChecker.js
const fetch = require('node-fetch');
const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });

async function shadowbanChecker(username) {
  try {
    const urlAPI = `https://www.instagram.com/web/search/topsearch/?query=${encodeURIComponent(username)}`;
    const response = await fetch(urlAPI, { agent, timeout: 15000 });
    const json = await response.json();

    const match = json.users.find(user => user.user.username.toLowerCase() === username.toLowerCase());

    if (match) {
      console.log(`✅ @${username} aparece en búsqueda pública (NO shadowban)`);
      return true;
    } else {
      console.warn(`⚠️ @${username} NO aparece en búsqueda pública. Verificando perfil...`);

      // Segundo chequeo: perfil público
      const profileURL = `https://www.instagram.com/${username}/`;
      const profileRes = await fetch(profileURL, { agent, timeout: 15000 });
      const profileHTML = await profileRes.text();

      if (profileRes.status === 404 || profileHTML.includes('Sorry, this page isn\'t available')) {
        console.error(`❌ @${username} NO existe públicamente (perfil 404 o invisible)`);
        return false;
      }

      console.log(`✅ @${username} tiene perfil visible pero está oculto en búsqueda (shadowban parcial)`);
      return 'partial'; // existe pero no aparece en búsqueda
    }

  } catch (error) {
    console.error(`❌ Error en shadowbanChecker: ${error.message}`);
    return false;
  }
}

module.exports = { shadowbanChecker };
