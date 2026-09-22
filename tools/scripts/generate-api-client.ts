/**
 * generate-api-client.ts
 *
 * Pulls the OpenAPI 3.0 spec from the running Spring Boot backend
 * (http://localhost:8080/v3/api-docs) and generates a typed TypeScript client
 * into libs/api-client/src/generated/ using @hey-api/openapi-ts.
 *
 * Usage: pnpm run api:generate
 */
import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8080';
const OUTPUT_DIR = resolve(__dirname, '../../libs/api-client/src/generated');

const specUrl = `${BACKEND_URL}/v3/api-docs`;

console.log(`[api:generate] Fetching OpenAPI spec from ${specUrl}...`);

// Ensure output directory exists
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Write a temporary openapi-ts config
const configPath = resolve(OUTPUT_DIR, 'openapi-ts.json');
writeFileSync(
  configPath,
  JSON.stringify(
    {
      plugin: '@hey-api/openapi-ts',
      input: specUrl,
      output: OUTPUT_DIR,
      client: 'fetch',
      types: {
        immutableTypes: true,
      },
    },
    null,
    2,
  ),
);

try {
  execSync('npx @hey-api/openapi-ts -c ' + configPath, {
    stdio: 'inherit',
    cwd: resolve(__dirname, '../../'),
  });
  console.log('[api:generate] TypeScript client generated successfully.');
} catch (error) {
  console.error('[api:generate] Code generation failed. Ensure the backend is running on port 8080.');
  process.exit(1);
}
