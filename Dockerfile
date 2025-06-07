FROM node:20-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnss3 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libxss1 \
    xdg-utils \
    && curl -sSL https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

FROM node:20-slim
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /usr/bin/google-chrome-stable /usr/bin/
COPY --from=builder /usr/lib/x86_64-linux-gnu/ /usr/lib/x86_64-linux-gnu/
COPY --from=builder /usr/share/fonts/ /usr/share/fonts/
COPY --from=builder /etc/alternatives/ /etc/alternatives/

RUN ln -sf /usr/bin/google-chrome-stable /usr/bin/chromium \
 && ln -sf /usr/bin/google-chrome-stable /usr/bin/chromium-browser \
 && ln -sf /usr/bin/google-chrome-stable /usr/bin/google-chrome

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV NODE_ENV=production

COPY . .

EXPOSE 3000
CMD ["npm", "start"]
