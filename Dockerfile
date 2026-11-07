# syntax=docker/dockerfile:1
# Release operators can supply an approved tag@sha256:digest for both stages.
ARG NODE_IMAGE=node:24-bookworm-slim
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/package.json
COPY backend/package.json ./backend/package.json
RUN npm ci --no-audit --no-fund
COPY frontend/ ./frontend/
RUN npm run build

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    API_BACKEND_HOST=0.0.0.0 \
    API_BACKEND_PORT=5000 \
    AI_PROXY_ENABLED=false \
    SERVE_FRONTEND=true
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/package.json
COPY backend/package.json ./backend/package.json
RUN npm ci --workspace backend --omit=dev --ignore-scripts --no-audit --no-fund \
    && npm cache clean --force
COPY --chown=node:node backend/ ./backend/
COPY --from=build --chown=node:node /app/frontend/dist/ ./frontend/dist/
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:5000/readyz',{signal:AbortSignal.timeout(3000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
STOPSIGNAL SIGTERM
CMD ["node", "backend/server.js"]
