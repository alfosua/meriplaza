# Static frontend (Web Components + demo). Served by nginx; no build step.
FROM docker.io/library/nginx:1.27-alpine
COPY web/ /usr/share/nginx/html/
# SPA-ish: fall back to demo.html is unnecessary; static files are served as-is.
EXPOSE 80
