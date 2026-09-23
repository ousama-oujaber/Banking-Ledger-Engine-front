import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const OUTPUT_DIR = resolve(__dirname, '../../libs/api-client/src/generated');
const CACHED_SPEC_PATH = resolve(__dirname, '../../libs/api-client/openapi.json');

// Parse CLI flags or env variables
const args = process.argv.slice(2);
const cliUrlArg = args.find((a) => a.startsWith('--url='))?.split('=')[1];
const cliFileArg = args.find((a) => a.startsWith('--file='))?.split('=')[1];
const BACKEND_URL = cliUrlArg ?? process.env.BACKEND_URL ?? 'http://localhost:8080';
const specUrl = `${BACKEND_URL.replace(/\/+$/, '')}/v3/api-docs`;

let effectiveInput: string = specUrl;

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 1. Determine input source (Live Backend or Cached Snapshot Fallback)
if (cliFileArg) {
  effectiveInput = resolve(process.cwd(), cliFileArg);
  console.log(`[api:generate] Using explicit schema file: ${effectiveInput}`);
} else {
  console.log(`[api:generate] Probing backend OpenAPI spec at ${specUrl}...`);
  try {
    const curlOutput = execSync(`curl -s -f -m 4 ${specUrl}`, { encoding: 'utf-8' });
    if (curlOutput && curlOutput.trim().startsWith('{')) {
      writeFileSync(CACHED_SPEC_PATH, curlOutput);
      console.log(`[api:generate] ✓ Live OpenAPI spec fetched and cached to ${CACHED_SPEC_PATH}`);
      effectiveInput = specUrl;
    }
  } catch {
    if (existsSync(CACHED_SPEC_PATH)) {
      console.warn(
        `[api:generate] ⚠️  Backend at ${specUrl} is unreachable. Falling back to cached schema: ${CACHED_SPEC_PATH}`,
      );
      effectiveInput = CACHED_SPEC_PATH;
    } else {
      console.error(
        `[api:generate] ❌ Backend is unreachable and no cached openapi.json exists. Ensure backend is running.`,
      );
      process.exit(1);
    }
  }
}

// 2. Snapshot existing request.ts to restore if generator produces empty file (v0.50 bug)
const requestPath = resolve(OUTPUT_DIR, 'core/request.ts');
let previousRequestContent: string | null = null;
try {
  if (existsSync(requestPath) && statSync(requestPath).size > 0) {
    previousRequestContent = readFileSync(requestPath, 'utf-8');
  }
} catch {}

// 3. Resolve @hey-api/openapi-ts binary portably
let binPath: string;
try {
  const pkgJsonPath = require.resolve('@hey-api/openapi-ts/package.json');
  binPath = resolve(dirname(pkgJsonPath), 'bin/index.cjs');
} catch {
  binPath = 'npx @hey-api/openapi-ts';
}

console.log(`[api:generate] Generating TypeScript SDK from ${effectiveInput}...`);

try {
  const cmd = binPath.startsWith('npx')
    ? `${binPath} --input "${effectiveInput}" --output "${OUTPUT_DIR}" --client fetch`
    : `node "${binPath}" --input "${effectiveInput}" --output "${OUTPUT_DIR}" --client fetch`;

  execSync(cmd, {
    stdio: 'inherit',
    cwd: resolve(__dirname, '../../'),
  });
  console.log('[api:generate] ✓ TypeScript client generated successfully.');
} catch (error) {
  console.error('[api:generate] ❌ Code generation command failed.');
  process.exit(1);
}

// 4. Post-generation validation & auto-fix
try {
  if (!existsSync(requestPath) || statSync(requestPath).size === 0) {
    console.warn('[api:generate] ⚠️  Generated core/request.ts is empty. Restoring from snapshot.');
    if (previousRequestContent) {
      writeFileSync(requestPath, previousRequestContent);
      console.log('[api:generate] ✓ Restored core/request.ts from snapshot.');
    }
  }

  const openApiPath = resolve(OUTPUT_DIR, 'core/OpenAPI.ts');
  if (existsSync(openApiPath)) {
    const content = readFileSync(openApiPath, 'utf-8');
    if (
      content.includes('interceptors: {\n\t};') ||
      content.includes('interceptors: {}') ||
      content.includes('interceptors: {\n};')
    ) {
      const fixed = content.replace(
        /interceptors:\s*\{\s*\};/,
        'interceptors: {\n\t\trequest: Interceptors<RequestInit>;\n\t\tresponse: Interceptors<Response>;\n\t};',
      );
      if (fixed !== content) {
        writeFileSync(openApiPath, fixed);
        console.log('[api:generate] ✓ Auto-fixed OpenAPI.ts typed interceptors.');
      }
    }
  }
} catch (err) {
  console.warn('[api:generate] Post-generation check encountered non-fatal warning:', err);
}
