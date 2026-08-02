# Imagen base Node.js 22 ligera
FROM node:22-slim

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de manifiesto e instalar dependencias
COPY package.json package-lock.json* bun.lock* ./
RUN npm install

# Copiar todo el código fuente
COPY . .

# Crear las carpetas de persistencia y enlazar public/uploads a data/uploads
RUN mkdir -p /app/data/uploads /app/public && \
    rm -rf /app/public/uploads && \
    ln -s /app/data/uploads /app/public/uploads

# Construir la aplicación (frontend con Vite + backend con esbuild)
RUN npm run build

# Exponer el puerto por defecto
EXPOSE 3000

# Variables de entorno por defecto en contenedor
ENV NODE_ENV=production
ENV PORT=3000

# Iniciar el servidor
CMD ["npm", "start"]
