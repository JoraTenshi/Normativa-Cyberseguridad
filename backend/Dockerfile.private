FROM node:24-bookworm-slim@sha256:51b1100cc2a83d370c6a60952e3f2989c8a43159d0e38586e090f3b3326efefd
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY app.js ./
COPY constants ./constants
COPY middleware ./middleware
COPY models ./models
COPY routes ./routes
COPY services ./services
COPY validation ./validation
COPY utils ./utils
COPY catalogo ./catalogo
COPY seed/schema_normativa.json ./seed/schema_normativa.json
COPY scripts/private ./scripts/private
ENV NODE_ENV=production
USER node
RUN node scripts/private/check-image.js
EXPOSE 5000
CMD ["node", "scripts/private/start.js"]
