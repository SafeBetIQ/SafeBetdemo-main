// ── SafeBet Guardian — liveness probe (ARCH-V4-C0) ───────────────────────────
// Guardian's OWN health endpoint, independent of SafeBet IQ's /api/health. No data
// access, no SafeBet IQ dependency. product=GUARDIAN. Foundation surface only.

import { NextResponse } from 'next/server';
import { guardianHealth } from '@/products/guardian/src/index.ts';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(guardianHealth('guardian-api'));
}
