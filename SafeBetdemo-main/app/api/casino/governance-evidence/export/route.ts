// ── SafeBet IQ — B5 Governance Evidence: EXPORT (audited download) ────────────
//
// POST /api/casino/governance-evidence/export  body: { start, end, format:'json'|'csv'[, casino_id] }
// Governed, own-casino. Builds the complete governed pack, assigns packId + pack SHA-256,
// then writes the MANDATORY governance_evidence.exported audit event — the artifact is
// returned ONLY if that audit insert succeeds (fail-closed). JSON = full structured pack;
// CSV = governed audit timeline only (+ safe metadata rows). No migration, no PII.

import { NextResponse } from 'next/server';
import {
  resolveGovEvidenceAccess, buildGovernancePack, finaliseExportPack, writeExportAudit,
} from '@/lib/responsibleProfitability/governanceEvidenceServer';
import {
  validateGovPeriod, isPeriodError, buildTimelineCsv, GOV_SYNTHETIC_DISCLAIMER, GOV_TIMEZONE, GOV_MAX_EXPORT_ROWS,
} from '@/lib/responsibleProfitability/governanceEvidence';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const deny = (status: number) => NextResponse.json({ ok: false, error: 'Not available.' }, { status });
const bad = (code: string, error: string) => NextResponse.json({ ok: false, code, error }, { status: 400 });

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { body = {}; }
  for (const k of Object.keys(body)) if (!['start', 'end', 'format', 'casino_id'].includes(k)) return bad('UNEXPECTED_FIELD', `unexpected field: ${k}`);

  const format = body.format === 'csv' ? 'csv' : body.format === 'json' ? 'json' : null;
  if (!format) return bad('FORMAT', 'format must be "json" or "csv"');

  const access = await resolveGovEvidenceAccess(req, typeof body.casino_id === 'string' ? body.casino_id : undefined);
  if (!access.ok) return deny(access.status);

  const period = validateGovPeriod(typeof body.start === 'string' ? body.start : null, typeof body.end === 'string' ? body.end : null);
  if (isPeriodError(period)) return NextResponse.json({ ok: false, error: period.error, code: period.code }, { status: 400 });

  const { pack: base, tooLarge } = await buildGovernancePack(access, period, { mode: 'export', previewPageSize: 0 });
  if (tooLarge) return bad('EXPORT_TOO_LARGE', `export exceeds the ${GOV_MAX_EXPORT_ROWS}-row governed limit; narrow the period`);

  const pack = finaliseExportPack(base);

  // MANDATORY audit BEFORE returning the artifact — fail-closed.
  const audited = await writeExportAudit(access, pack, format);
  if (!audited) return NextResponse.json({ ok: false, error: 'export could not be audited; aborted', code: 'AUDIT_FAILED' }, { status: 503 });

  // Filename carries NO casino_id — period + server-generated packId fragment only.
  const fnameBase = `safebet-iq-governance-evidence-${period.startDate}-to-${period.endDate}-${(pack.packId ?? '').slice(0, 8)}`;
  const common = { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' } as Record<string, string>;

  if (format === 'json') {
    return new NextResponse(JSON.stringify(pack, null, 2), {
      status: 200,
      headers: { ...common, 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="${fnameBase}.json"` },
    });
  }

  const meta: string[][] = [
    ['# SafeBet IQ — Governance Evidence (audit timeline)'],
    [`# casino: ${access.casinoName ?? ''}`],   // display name only; no casino_id in the artifact
    [`# period_start_inclusive: ${period.startDate}`],
    [`# period_end_exclusive: ${period.endDate}`],
    [`# timezone: ${GOV_TIMEZONE}`],
    [`# generated_at: ${pack.packMetadata.generatedAt}`],
    [`# generated_by_role: ${pack.packMetadata.generatedByRole}`],
    [`# schema_version: ${pack.schemaVersion}`],
    [`# pack_sha256: ${pack.packIntegrity?.packSha256 ?? ''}`],
    ...(pack.packMetadata.syntheticDemo ? [[`# ${GOV_SYNTHETIC_DISCLAIMER}`]] : []),
  ];
  const csv = buildTimelineCsv(pack.auditTimeline, meta);
  return new NextResponse(csv, {
    status: 200,
    headers: { ...common, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${fnameBase}.csv"` },
  });
}

export async function GET() { return deny(404); }
