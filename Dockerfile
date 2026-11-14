# syntax=docker/dockerfile:1
# Coolify 用这个文件构建并运行站点：Node 构建出 dist/，nginx 提供静态文件。

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# 构建后预压缩大文件（数据库约 5.9 MB），nginx 用 gzip_static 直接发送，不必每次请求再压缩。
RUN npm run build \
 && find dist -type f \( -name '*.db' -o -name '*.wasm' -o -name '*.js' -o -name '*.css' \) -exec gzip -9 -k {} +

FROM nginx:stable-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
# 用 127.0.0.1 而不是 localhost：alpine 里 localhost 可能解析到 ::1，而 nginx 只监听 IPv4。
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
