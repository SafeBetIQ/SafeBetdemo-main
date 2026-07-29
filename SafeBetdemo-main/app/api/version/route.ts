// ── Version / release-provenance probe ───────────────────────────────────────
// Read-only, dependency-free endpoint that reports the SAFE deployment metadata
// of the running build so a release can be positively identified in the live
// environment. It performs NO data access and exposes NO secrets — only the
// build/release provenance fields below.
//
// Provenance values are injected at BUILD time into a generated `version.json`
// at the deployment root (see the CodeBuild buildspec `post_build` step, which
// writes gitCommit, buildId, deploymentVersion, builtWithNode and deployedAt
// from the actual build). At runtime this route reads that file; if it is
// absent (e.g. local `next dev`), it degrades to `NEXT_PUBLIC_*` / build-id
// fallbacks and marks the unknown fields explicitly rather than fabricating.

import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

type VersionInfo = {
  service: string;
  environment: string;
  environmentClass: string;
  dataClass: string;
  gitCommit: string;
  buildId: string;
  deploymentVersion: string;
  builtWithNode: string;
  deployedAt: string;
};

function readGeneratedVersion(): Partial<VersionInfo> {
  try {
    const raw = readFileSync(path.join(process.cwd(), 'version.json'), 'utf8');
    return JSON.parse(raw) as Partial<VersionInfo>;
  } catch {
    return {};
  }
}

// Runtime fallback for buildId when version.json is absent: Next writes the
// build id to .next/BUILD_ID at build time and ships it in the bundle.
function readBuildId(): string {
  try {
    return readFileSync(path.join(process.cwd(), '.next', 'BUILD_ID'), 'utf8').trim();
  } catch {
    return 'unknown';
  }
}

export function GET() {
  const gen = readGeneratedVersion();
  const info: VersionInfo = {
    service: 'safebet-iq',
    environment: gen.environment ?? process.env.NEXT_PUBLIC_ENV ?? 'unknown',
    environmentClass: gen.environmentClass ?? 'non-production',
    dataClass: gen.dataClass ?? 'synthetic',
    gitCommit: gen.gitCommit ?? 'unknown',
    buildId: gen.buildId ?? readBuildId(),
    deploymentVersion: gen.deploymentVersion ?? 'unknown',
    builtWithNode: gen.builtWithNode ?? 'unknown',
    deployedAt: gen.deployedAt ?? 'unknown',
  };
  return NextResponse.json(info, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
