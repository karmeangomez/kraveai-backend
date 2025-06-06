{
  "name": "kraveai-backend",
  "version": "1.0.0",
  "description": "Backend de KraveAI con scraping, login proxy, IA y Telegram",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "install-chromium": "echo 'Chromium se instala vía Docker'"
  },
  "dependencies": {
    "axios": "^1.7.2",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "fs-extra": "^11.2.0",
    "puppeteer-core": "^22.10.0",
    "puppeteer-extra": "^3.3.6",
    "puppeteer-extra-plugin-stealth": "^2.11.2",
    "@sparticuz/chromium": "^133.0.0",
    "telegraf": "^4.16.3",
    "user-agents": "^1.1.0",
    "proxy-chain": "^0.4.9",
    "https-proxy-agent": "^7.0.2"
  }
}
