# Use an official Node.js runtime as base (slim image for smaller size)
FROM node:18-slim

# Prevent prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install Chromium (for puppeteer-core) and any needed dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    chromium-sandbox \
  && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package.json ./
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1
RUN npm install --omit=dev && npm cache clean --force

# Copy the application code
COPY server.js ./

# Set environment variable for puppeteer to find Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Expose the port (for local testing; Render automatically maps the port)
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
