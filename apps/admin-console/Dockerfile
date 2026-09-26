# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /workspace

# Enable pnpm via Corepack
RUN corepack enable pnpm && corepack prepare pnpm@9.15.9 --activate

# Copy workspace dependency manifests and Angular configuration
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json nx.json angular.json ./
COPY libs ./libs
COPY apps/admin-console ./apps/admin-console
COPY tools ./tools

# Install dependencies using frozen lockfile
RUN pnpm install --frozen-lockfile

# Build Angular 19 production bundle (esbuild application builder)
RUN pnpm nx build admin-console --configuration=production

# Stage 2: Hardened Unprivileged Serve
FROM nginxinc/nginx-unprivileged:alpine-slim
COPY --from=builder /workspace/dist/apps/admin-console/browser /usr/share/nginx/html
COPY apps/admin-console/nginx.conf /etc/nginx/conf.d/default.conf

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/ || exit 1

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
