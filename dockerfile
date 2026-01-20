FROM ghcr.io/puppeteer/puppeteer:21.5.0

# Variables de entorno para que Puppeteer no se queje en Docker
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /usr/src/app

# Copiar archivos del proyecto
COPY package*.json ./
RUN npm ci

COPY . .

# Exponer el puerto
EXPOSE 3000

# Comando de inicio
CMD [ "node", "server.js" ]
