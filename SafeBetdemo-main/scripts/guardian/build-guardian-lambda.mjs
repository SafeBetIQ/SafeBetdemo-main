#!/usr/bin/env node
// ─── SafeBet Guardian — independent Lambda build (ARCH-V4-C0.1) ───────────────
//
// Builds Guardian's OWN deployable artifact from Guardian source + the governed
// Shared Platform Foundation contracts ONLY. The exact Git source SHA is baked
// into the bundle (esbuild `define`) so the artifact carries its provenance —
// enabling Git = build = deploy = live /version parity. Produces:
//   products/guardian/dist/index.js   (CJS bundle, Lambda handler index.handler)
//   products/guardian/dist/guardian-version.json
//   products/guardian/dist/guardian-lambda.zip
//
//   node scripts/guardian/build-guardian-lambda.mjs
//
// Does NOT depend on SafeBet IQ pages/routes. Node 20 target. No secrets.

import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PKG = path.join(ROOT, 'products', 'guardian');
const DIST = path.join(PKG, 'dist');
const ENTRY = path.join(PKG, 'bin', 'guardian-lambda.ts');

const sha = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim();
const builtAt = new Date().toISOString();
const deploymentVersion = `guardian-demo-c0.1-${builtAt.replace(/[-:T]/g, '').slice(0, 12)}-${sha.slice(0, 7)}`;

mkdirSync(DIST, { recursive: true });

await build({
  entryPoints: [ENTRY],
  outfile: path.join(DIST, 'index.js'),
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  legalComments: 'none',
  // Bake provenance into the artifact.
  define: {
    __GUARDIAN_GIT_COMMIT__: JSON.stringify(sha),
    __GUARDIAN_DEPLOYMENT_VERSION__: JSON.stringify(deploymentVersion),
    __GUARDIAN_BUILT_AT__: JSON.stringify(builtAt),
  },
});

const versionManifest = { product: 'GUARDIAN', service: 'safebet-guardian', gitCommit: sha, deploymentVersion, builtAt, environment: 'demo', dataClass: 'synthetic' };
writeFileSync(path.join(DIST, 'guardian-version.json'), JSON.stringify(versionManifest, null, 2));

// The Guardian package.json declares "type":"module"; the esbuild output is CJS.
// Scope the bundle as CommonJS so `index.handler` resolves under both Node here
// and in Lambda (the zip carries this package.json).
writeFileSync(path.join(DIST, 'package.json'), JSON.stringify({ type: 'commonjs' }));

// Zip the handler + its CJS scope marker. Prefer `zip`; fall back to PowerShell.
try {
  execSync(`zip -j -q "${path.join(DIST, 'guardian-lambda.zip')}" "${path.join(DIST, 'index.js')}" "${path.join(DIST, 'package.json')}"`, { cwd: DIST });
} catch {
  execSync(`powershell -NoProfile -Command "Compress-Archive -Force -Path '${path.join(DIST, 'index.js')}','${path.join(DIST, 'package.json')}' -DestinationPath '${path.join(DIST, 'guardian-lambda.zip')}'"`);
}

const bundleHash = createHash('sha256').update(readFileSync(path.join(DIST, 'index.js'))).digest('hex');
console.log(JSON.stringify({
  built: true, sourceSha: sha, deploymentVersion, builtAt,
  bundleSha256: bundleHash,
  artifact: path.relative(ROOT, path.join(DIST, 'guardian-lambda.zip')),
  handler: 'index.handler', runtime: 'nodejs20.x',
}, null, 2));
