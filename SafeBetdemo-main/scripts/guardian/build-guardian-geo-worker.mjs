#!/usr/bin/env node
// ─── SafeBet Guardian — domain worker Lambda build (ARCH-V4-C2) ───────────────
// Builds the SQS worker artifact from Guardian source + governed Shared contracts
// only, baking the exact Git SHA (four-way provenance). Produces:
//   products/guardian/dist-geo-worker/index.js + package.json + guardian-geo-worker.zip

import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PKG = path.join(ROOT, 'products', 'guardian');
const DIST = path.join(PKG, 'dist-geo-worker');
const ENTRY = path.join(PKG, 'bin', 'guardian-geo-worker.ts');

const sha = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim();
const builtAt = new Date().toISOString();
const deploymentVersion = `guardian-geo-worker-c5-${builtAt.replace(/[-:T]/g, '').slice(0, 12)}-${sha.slice(0, 7)}`;

mkdirSync(DIST, { recursive: true });
await build({
  entryPoints: [ENTRY], outfile: path.join(DIST, 'index.js'),
  bundle: true, platform: 'node', target: 'node20', format: 'cjs', legalComments: 'none',
  // pg is bundled; its optional native binding is excluded (pure-JS path used).
  // The AWS SDK v3 is provided by the Node 20 Lambda runtime → keep it external.
  external: ['pg-native', '@aws-sdk/*'],
  define: { __GUARDIAN_GIT_COMMIT__: JSON.stringify(sha), __GUARDIAN_DEPLOYMENT_VERSION__: JSON.stringify(deploymentVersion), __GUARDIAN_BUILT_AT__: JSON.stringify(builtAt) },
});
writeFileSync(path.join(DIST, 'package.json'), JSON.stringify({ type: 'commonjs' }));
try {
  execSync(`zip -j -q "${path.join(DIST, 'guardian-geo-worker.zip')}" "${path.join(DIST, 'index.js')}" "${path.join(DIST, 'package.json')}"`, { cwd: DIST });
} catch {
  execSync(`powershell -NoProfile -Command "Compress-Archive -Force -Path '${path.join(DIST, 'index.js')}','${path.join(DIST, 'package.json')}' -DestinationPath '${path.join(DIST, 'guardian-geo-worker.zip')}'"`);
}
console.log(JSON.stringify({ built: true, sourceSha: sha, deploymentVersion, handler: 'index.handler', runtime: 'nodejs20.x' }, null, 2));
