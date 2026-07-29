// ── Liveness probe (ORR-1A / WS4) ────────────────────────────────────────────
// Lightweight, dependency-free health endpoint for the Elastic Beanstalk load
// balancer / CloudWatch health check. It performs NO data access so the health
// path cannot cascade a downstream (Supabase) hiccup into instance recycling —
// this is a *liveness* check (is the web tier up?), not a readiness/deep check.
// It is operational infrastructure only: no business logic, no UI, no data.

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'safebet-iq',
    ts: new Date().toISOString(),
  });
}
