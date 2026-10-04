FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ENV GENERATE_SOURCEMAP=false
# Sin <script> en línea en index.html: la CSP de nginx solo permite scripts de 'self'.
ENV INLINE_RUNTIME_CHUNK=false
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/build ./build
EXPOSE 3000
CMD ["serve", "-s", "build", "-l", "tcp://0.0.0.0:3000"]
