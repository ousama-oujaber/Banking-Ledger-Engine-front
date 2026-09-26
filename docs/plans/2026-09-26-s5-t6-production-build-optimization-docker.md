# Sprint 5 Task 6 (S5-T6): Production Build Optimization, Bundle Analysis & Docker Containerization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver enterprise-grade production build optimization (bundle chunking, tree-shaking, size budgets) and multi-stage unprivileged Docker containerization with production Nginx configurations for both `customer-portal` and `admin-console`.

**Architecture:** 
1. Multi-stage Docker builds using `node:22-alpine` for reproducible, isolated compilation via `pnpm` and `nx`, combined with `nginxinc/nginx-unprivileged:alpine-slim` for non-root, hardened static delivery.
2. Production Nginx configurations featuring SPA client-side fallback (`try_files $uri $uri/ /index.html`), Brotli/Gzip compression, immutable asset caching (`Cache-Control: public, max-age=31536000, immutable`), strict security headers, and an internal `/api/` reverse proxy.
3. Build optimization with Vite manual chunking for React (`vendor-react`, `vendor-query`) and Angular 19 esbuild budgets (`@angular/build:application`) to prevent bundle bloat and maximize browser caching.
4. Docker Compose orchestration (`docker-compose.frontend.yml`) for seamless local and staging multi-container execution.

**Tech Stack:** Docker, Nginx (unprivileged), Vite 6/Rollup, Angular 19 Application Builder (esbuild), Nx 20, pnpm 9, TypeScript 5.

---

### Task 1: Root Docker Build Context Optimization (`.dockerignore`)

**Files:**
- Create: `.dockerignore`

**Step 1: Write `.dockerignore`**
Exclude local development clutter, package managers, testing artifacts, and Git metadata from Docker build context to ensure sub-second context transfers.

```dockerignore
node_modules
dist
dist-*
build
coverage
.nx/cache
.nx/workspace-data
.angular/cache
.git
.gitignore
*.log
npm-debug.log*
yarn-debug.log*
pnpm-debug.log*
.idea
.vscode
*.swp
*.swo
.DS_Store
Thumbs.db
.env
.env.local
.env.*.local
project-doc
playwright-report
test-results
e2e
```

**Step 2: Verify Docker context exclusion**
Run: `tar -czf - --exclude-from=.dockerignore . | wc -c`
Expected: Small archive (< 15MB) confirming `node_modules` and `dist` are excluded.

---

### Task 2: Customer Portal (React/Vite) Build Optimization & Bundle Chunking

**Files:**
- Modify: `apps/customer-portal/vite.config.ts`
- Modify: `package.json`

**Step 1: Update `apps/customer-portal/vite.config.ts`**
Configure manual chunking for vendor packages to separate stable React and TanStack Query libraries from application code, improving HTTP/2 parallel loading and long-term cache hits.

```typescript
build: {
  outDir: '../../dist/apps/customer-portal',
  emptyOutDir: true,
  sourcemap: false,
  minify: 'esbuild',
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react': ['react', 'react-dom', 'react-router-dom'],
        'vendor-query': ['@tanstack/react-query'],
      },
    },
  },
}
```

**Step 2: Add production build & analyze script in `package.json`**
Add `"build:prod"` and `"build:customer"` convenience scripts.

**Step 3: Run production build and verify bundle output**
Run: `pnpm nx build customer-portal --configuration=production`
Expected: Output in `dist/apps/customer-portal/` with distinct vendor chunks (`vendor-react`, `vendor-query`, and app chunk) without bundling errors.

---

### Task 3: Admin Console (Angular 19) Build Optimization & Budget Enforcement

**Files:**
- Modify: `angular.json`
- Modify: `apps/admin-console/project.json`

**Step 1: Update `angular.json`**
Configure bundle budgets and stats output options in production configuration to guard against accidental bundle regressions:
- Initial bundle budget: warning at 500kB, error at 1.5MB.
- Component style budget: warning at 6kB, error at 12kB.

```json
"production": {
  "optimization": true,
  "outputHashing": "all",
  "sourceMap": false,
  "namedChunks": false,
  "extractLicenses": true,
  "budgets": [
    {
      "type": "initial",
      "maximumWarning": "500kB",
      "maximumError": "1.5MB"
    },
    {
      "type": "anyComponentStyle",
      "maximumWarning": "6kB",
      "maximumError": "12kB"
    }
  ]
}
```

**Step 2: Run production build and verify bundle compliance**
Run: `pnpm nx build admin-console --configuration=production`
Expected: Successful build with all chunks well within budget limits in `dist/apps/admin-console/browser/`.

---

### Task 4: Hardened Production Nginx Configurations

**Files:**
- Modify: `apps/customer-portal/nginx.conf`
- Create: `apps/admin-console/nginx.conf`

**Step 1: Update `apps/customer-portal/nginx.conf`**
Configure unprivileged Nginx (port 8080) with:
- Gzip compression for text, scripts, stylesheets, and SVG.
- Security response headers (`X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`, `Referrer-Policy`).
- Cache-Control headers: 1-year immutable for hashed static assets; `no-cache, no-store, must-revalidate` for `index.html`.
- SPA routing fallback: `try_files $uri $uri/ /index.html`.
- API proxy pass to backend with header forwarding.

**Step 2: Create `apps/admin-console/nginx.conf`**
Mirror the hardened Nginx configuration tailored for the Angular 19 client application on port 8080.

---

### Task 5: Multi-Stage Dockerfile Containerization

**Files:**
- Modify: `apps/customer-portal/Dockerfile`
- Create: `apps/admin-console/Dockerfile`

**Step 1: Update `apps/customer-portal/Dockerfile`**
Ensure deterministic, frozen-lockfile build using Node 22 Alpine, copy required monorepo libs, build customer-portal, and copy static dist files into `nginxinc/nginx-unprivileged:alpine-slim` with healthcheck.

```dockerfile
# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /workspace
RUN corepack enable pnpm

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json nx.json ./
COPY libs ./libs
COPY apps/customer-portal ./apps/customer-portal
COPY tools ./tools

RUN pnpm install --frozen-lockfile
RUN pnpm nx build customer-portal --configuration=production

# Stage 2: Hardened Unprivileged Serve
FROM nginxinc/nginx-unprivileged:alpine-slim
COPY --from=builder /workspace/dist/apps/customer-portal /usr/share/nginx/html
COPY apps/customer-portal/nginx.conf /etc/nginx/conf.d/default.conf

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/ || exit 1

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
```

**Step 2: Create `apps/admin-console/Dockerfile`**
Implement the equivalent multi-stage build for Angular 19, copying from `/workspace/dist/apps/admin-console/browser` into `/usr/share/nginx/html`.

```dockerfile
# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /workspace
RUN corepack enable pnpm

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json nx.json angular.json ./
COPY libs ./libs
COPY apps/admin-console ./apps/admin-console
COPY tools ./tools

RUN pnpm install --frozen-lockfile
RUN pnpm nx build admin-console --configuration=production

# Stage 2: Hardened Unprivileged Serve
FROM nginxinc/nginx-unprivileged:alpine-slim
COPY --from=builder /workspace/dist/apps/admin-console/browser /usr/share/nginx/html
COPY apps/admin-console/nginx.conf /etc/nginx/conf.d/default.conf

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/ || exit 1

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
```

---

### Task 6: Unified Docker Compose Deployment

**Files:**
- Create: `docker-compose.frontend.yml`

**Step 1: Create `docker-compose.frontend.yml`**
Define container services for both frontends with custom host ports:
- `customer-portal`: Host port `3000` -> Container port `8080`
- `admin-console`: Host port `4200` -> Container port `8080`
- Configured health checks, restart policies, and bridge networking.

---

### Task 7: Build Verification, Container Smoke Tests & Monorepo Validation

**Files:**
- All monorepo projects

**Step 1: Test production builds of all projects**
Run: `pnpm nx run-many --target=build --all --configuration=production`
Expected: 100% successful builds for both applications.

**Step 2: Build Docker images locally**
Run:
- `docker build -f apps/customer-portal/Dockerfile -t ble-customer-portal:latest .`
- `docker build -f apps/admin-console/Dockerfile -t ble-admin-console:latest .`
Expected: Successful container image generation.

**Step 3: Run container smoke tests**
Start containers on temporary ports and verify:
- HTTP 200 on `/`
- Correct security headers returned (`X-Frame-Options`, `X-Content-Type-Options`)
- Non-root user execution (`whoami` -> `nginx` or UID 101)

**Step 4: Execute Monorepo Regression Quality Suite**
- `pnpm test` (all 34 unit test suites must remain green)
- `pnpm typecheck` (zero TypeScript errors)
- `pnpm test:e2e` (all 16 Playwright E2E tests pass)
- `pnpm format` (format check)

---

### Task 8: Git Commit, Push & Merge
- Commit message: `feat(build): implement production build optimization, bundle chunking, and Docker containerization (S5-T6)`
- Push to `develop`
- Merge into `main` and push to remote
