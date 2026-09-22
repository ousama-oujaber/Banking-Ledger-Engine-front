import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync, statSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8080';
const OUTPUT_DIR = resolve(__dirname, '../../libs/api-client/src/generated');
const specUrl = `${BACKEND_URL}/v3/api-docs`;

console.log(`[api:generate] Fetching OpenAPI spec from ${specUrl}...`);

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Keep config for reference (not used for generation - direct CLI is more reliable)
const configContent = `export default {
  input: '${specUrl}',
  output: '${OUTPUT_DIR}',
  client: 'fetch',
  types: {
    immutableTypes: true,
  },
};\n`;

writeFileSync(resolve(OUTPUT_DIR, 'openapi-ts.config.ts'), configContent);

// Snapshot existing request.ts to restore if generator produces empty file (v0.50 bug)
const requestPathPre = resolve(OUTPUT_DIR, 'core/request.ts');
let previousRequestContent: string | null = null;
try {
  if (existsSync(requestPathPre) && statSync(requestPathPre).size > 0) {
    previousRequestContent = readFileSync(requestPathPre, 'utf-8');
  }
} catch {}

try {
  // Use direct CLI args instead of -c config (c12 loader flakes with "input not provided" on some pnpm setups)
  // This was verified to generate correct request.ts + typed interceptors via:
  //   npx @hey-api/openapi-ts --input http://localhost:8080/v3/api-docs --output <dir> --client fetch
  const binPath = resolve(__dirname, '../../node_modules/.pnpm/@hey-api+openapi-ts@0.50.0_typescript@5.6.3/node_modules/@hey-api/openapi-ts/bin/index.cjs');
  execSync(`node ${binPath} --input ${specUrl} --output ${OUTPUT_DIR} --client fetch`, {
    stdio: 'inherit',
    cwd: resolve(__dirname, '../../'),
  });
  console.log('[api:generate] TypeScript client generated successfully.');
} catch (error) {
  console.error('[api:generate] Code generation failed. Ensure the backend is running on port 8080.');
  process.exit(1);
}

// Post-generation validation: @hey-api/openapi-ts@0.50.0 known to generate empty request.ts
// with certain TypeScript/pnpm combos. Auto-detect and restore.
const requestPath = resolve(OUTPUT_DIR, 'core/request.ts');
const openApiPath = resolve(OUTPUT_DIR, 'core/OpenAPI.ts');
try {
  if (!existsSync(requestPath) || statSync(requestPath).size === 0) {
    console.error('[api:generate] ⚠️  Generated core/request.ts is empty (known v0.50 incompatibility).');
    if (previousRequestContent) {
      writeFileSync(requestPath, previousRequestContent);
      console.log('[api:generate] Restored previous request.ts from snapshot.');
    } else {
      console.error('[api:generate] No snapshot to restore. Build will fail until request.ts is manually fixed.');
      console.error('[api:generate] Fix: pin @hey-api/openapi-ts to ^0.51 or use manual fetch runtime.');
    }
  }
  if (existsSync(openApiPath)) {
    const content = readFileSync(openApiPath, 'utf-8');
    if (content.includes('interceptors: {\n\t};') || content.includes('interceptors: {}') || content.includes('interceptors: {\n};')) {
      console.error('[api:generate] ⚠️  Generated OpenAPI.ts has empty interceptors type ({}). Expected request/response typed Interceptors.');
      // Auto-fix interceptors type
      const fixed = content.replace(
        /interceptors:\s*\{\s*\};/,
        'interceptors: {\n\t\trequest: Interceptors<RequestInit>;\n\t\tresponse: Interceptors<Response>;\n\t};'
      );
      if (fixed !== content) {
        writeFileSync(openApiPath, fixed);
        console.log('[api:generate] Auto-fixed OpenAPI.ts interceptors type.');
      }
    }
  }
} catch {}
