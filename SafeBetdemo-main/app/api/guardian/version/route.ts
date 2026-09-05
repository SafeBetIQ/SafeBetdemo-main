// ── SafeBet Guardian — version / provenance probe (ARCH-V4-C0) ───────────────
// Guardian's OWN version endpoint. Reads Guardian's OWN provenance manifest
// (guardian-version.json) if present, so a Guardian deployment SHA is never
// confused with the SafeBet IQ runtime SHA. Degrades to explicit fallbacks (never
// fabricates, never borrows IQ provenance). No secrets, no data access.

import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import path from 'path';
import { guardianVersion, type GuardianVersion } from '@/products/guardian/src/index.ts';

export const dynamic = 'force-dynamic';

function readGuardianProvenance(): Partial<GuardianVersion> {
  try {
    return JSON.parse(readFileSync(path.join(process.cwd(), 'guardian-version.json'), 'utf8')) as Partial<GuardianVersion>;
  } catch {
    return {};
  }
}

export function GET() {
  return NextResponse.json(guardianVersion(readGuardianProvenance()));
}
