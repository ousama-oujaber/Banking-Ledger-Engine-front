# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /workspace
RUN corepack enable pnpm
RUN pnpm install -g pnpm@9

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json nx.json ./
COPY libs ./libs
COPY apps/customer-portal ./apps/customer-portal
COPY tools ./tools

RUN pnpm install --frozen-lockfile

COPY apps/customer-portal/vite.config.ts apps/customer-portal/vite.config.ts
RUN pnpm nx build customer-portal --configuration=production

# Stage 2: Serve
FROM nginxinc/nginx-unprivileged:alpine-slim
COPY --from=builder /workspace/dist/apps/customer-portal /usr/share/nginx/html
COPY apps/customer-portal/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
