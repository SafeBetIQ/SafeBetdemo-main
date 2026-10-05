// ── SafeBet IQ — B6: correct (supersede) an alert↔intervention link ───────────
//
// POST /api/casino/protection-alerts/{id}/links/{linkId}/supersede  body:{ intervention_id }
// Governed, own-casino. Inserts a REPLACEMENT link (carrying supersedes_link_id); the DB
// trigger atomically supersedes the prior active link and emits one audit event. No
// generic UPDATE/DELETE endpoint; no caller-supplied actor/timestamps/superseded fields.
// Append-only: the corrected link is retained as history.

import { NextResponse } from 'next/server';
import { resolveAlertAccess } from '@/lib/responsibleProfitability/alertsServer';
import { resolveAlert, supersedeLink } from '@/lib/responsibleProfitability/traceabilityServer';
import { parseLinkBody } from '@/lib/responsibleProfitability/traceability';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const deny = (status: number) => NextResponse.json({ ok: false, error: 'Not available.' }, { status });
const bad = (code: string, error: string) => NextResponse.json({ ok: false, code, error }, { status: 400 });

export async function POST(req: Request, ctx: { params: Promise<{ id: string; linkId: string }> }) {
  const { id: alertId, linkId } = await ctx.params;

  let body: unknown = null;
  try { body = await req.json(); } catch { body = null; }
  const parsed = parseLinkBody(body);
  if (!parsed.ok) return bad(parsed.code, parsed.error);

  const requestedCasino = new URL(req.url).searchParams.get('casino_id') ?? undefined;
  const access = await resolveAlertAccess(req, requestedCasino);
  if (!access.ok) return deny(access.status);
  const { admin, scopeCasino, principal } = access;

  const alert = await resolveAlert(admin, scopeCasino, alertId);
  if (!alert.ok) return deny(alert.status);

  const outcome = await supersedeLink(admin, scopeCasino, alertId, linkId, parsed.interventionId, principal);
  switch (outcome.kind) {
    case 'superseded':
      return NextResponse.json({ ok: true, link: { id: outcome.link.id, interventionId: outcome.link.intervention_id }, supersededLinkId: linkId },
        { status: 201, headers: { 'Cache-Control': 'no-store, private' } });
    case 'idempotent':
      return NextResponse.json({ ok: true, idempotent: true, link: { id: outcome.link.id, interventionId: outcome.link.intervention_id } },
        { headers: { 'Cache-Control': 'no-store, private' } });
    case 'not_found':
      return deny(404);
    case 'not_linkable':
      return NextResponse.json({ ok: false, code: 'INTERVENTION_NOT_LINKABLE', error: 'that replacement intervention is not linkable for this alert' }, { status: 404 });
    case 'conflict':
      return NextResponse.json({ ok: false, code: 'SUPERSEDE_CONFLICT', error: 'this correction conflicts with an existing active link or a concurrent change; no change was made' }, { status: 409 });
    default:
      return deny(outcome.status);
  }
}

export async function GET() { return deny(404); }
