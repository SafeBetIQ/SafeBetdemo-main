// ── SafeBet IQ — B5 Governance Evidence: PREVIEW (read-only, NOT an export) ────
//
// GET /api/casino/governance-evidence/preview?start=YYYY-MM-DD&end=YYYY-MM-DD[&casino_id=]
// Governed, own-casino, read-only. Uses the IDENTICAL minimisation/allowlist code as
// export. Returns summaries + ONE timeline page; omits packId / pack SHA / full timeline;
// emits NO governance_evidence.exported audit event. Anon→401, bad role→403, cross-casino→404.

import { NextResponse } from 'next/server';
import { resolveGovEvidenceAccess, buildGovernancePack } from '@/lib/responsibleProfitability/governanceEvidenceServer';
import { validateGovPeriod, isPeriodError, GOV_PREVIEW_PAGE_SIZE } from '@/lib/responsibleProfitability/governanceEvidence';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const deny = (status: number) => NextResponse.json({ ok: false, error: 'Not available.' }, { status });

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const access = await resolveGovEvidenceAccess(req, params.get('casino_id') ?? undefined);
  if (!access.ok) return deny(access.status);

  const period = validateGovPeriod(params.get('start'), params.get('end'));
  if (isPeriodError(period)) return NextResponse.json({ ok: false, error: period.error, code: period.code }, { status: 400 });

  const { pack, timelineTruncatedForPreview, fullTimelineCount } =
    await buildGovernancePack(access, period, { mode: 'preview', previewPageSize: GOV_PREVIEW_PAGE_SIZE });

  return NextResponse.json(
    { ok: true, preview: true, previewPageSize: GOV_PREVIEW_PAGE_SIZE, timelineTruncatedForPreview, fullTimelineCount, pack },
    { headers: { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' } },
  );
}

export async function POST() { return deny(404); }
