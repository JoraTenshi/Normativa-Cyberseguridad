FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
# Versiones exactas del lockfile y sin dependencias de desarrollo (nodemon, supertest) en la imagen.
RUN npm ci --omit=dev

COPY . .

EXPOSE 5000

CMD ["node", "server.js"]
