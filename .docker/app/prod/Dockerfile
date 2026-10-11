FROM --platform=$BUILDPLATFORM node:26.7.0-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG ORPHEUS_WEB_BASE_PATH=/
RUN npm run api:check && npm run build

FROM nginx:1.28-alpine
ENV ORPHEUS_UPSTREAM=http://orpheus:8000
ENV NGINX_ENVSUBST_FILTER=^ORPHEUS_UPSTREAM$
COPY .docker/app/prod/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
RUN chown -R nginx:nginx /etc/nginx/conf.d /var/cache/nginx && \
    sed -i '/^user /d; s#^pid .*#pid /tmp/nginx.pid;#' /etc/nginx/nginx.conf
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
