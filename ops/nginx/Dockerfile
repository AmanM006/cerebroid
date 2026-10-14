# Web image: builds the React app, then serves it with nginx, which also proxies
# /api, /health and /ready to the API container so the browser sees one origin
# (the refresh cookie is SameSite=Strict and scoped to /api/v1/auth).

FROM node:22-alpine AS build
WORKDIR /src
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# Unprivileged variant: runs as a non-root user and listens on 8080.
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY ops/nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY ops/nginx/security_headers.inc /etc/nginx/conf.d/security_headers.inc
COPY --from=build /src/dist /usr/share/nginx/html
EXPOSE 8080
