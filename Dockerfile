FROM node:20-alpine AS web-builder

WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM node:20-alpine AS backend-deps

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine

RUN apk add --no-cache dumb-init

WORKDIR /app

# Backend runtime dependencies and source
COPY --from=backend-deps /app/backend/node_modules ./backend/node_modules
COPY backend/ ./backend/

# Built frontend assets served by backend/server.js from ../web/dist
COPY --from=web-builder /app/web/dist ./web/dist

# Writable directories used by the backend
RUN mkdir -p backend/logs backend/uploads

ENV NODE_ENV=production
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 5000) + '/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

WORKDIR /app/backend
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
