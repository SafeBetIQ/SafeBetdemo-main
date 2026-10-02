// ─── SafeBet IQ — B5 Governance Evidence: server access + assembly (server-only) ──
//
// The governed server path for B5. Reuses the B1/B2/B4.1 fail-closed posture
// (verifyPrincipal → operator-role gate → resolveRpScope → principalMayAccessCasino →
// service_role), reads ONLY allowlisted/minimised data, maps the chain verifier to a
// safe status, assembles the deterministic pack, computes the pack SHA-256, and writes
// the MANDATORY governance_evidence.exported audit event (export fails if that insert
// fails). No DB migration; no mutation beyond the single governed audit event.

import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { verifyPrincipal, principalMayAccessCasino, type AuthenticatedPrincipal, type PrincipalClient } from '../security/principal.ts';
import { resolveRpScope } from './metrics.ts';
import { isAlertOperatorRole, alertScopeProfile } from './alerts.ts';
import {
  GOV_EVIDENCE_SCHEMA_VERSION, GOV_ALLOWLISTED_CATEGORIES, GOV_ALERT_TYPES, GOV_MAX_EXPORT_ROWS,
  GOV_TIMEZONE, GOV_SYNTHETIC_DISCLAIMER, GOV_PACK_SHA_NOTE, GOV_EXPORT_AUDIT_ACTION,
  mapTimeline, mapSnapshot, buildInterventionSummary, buildProtectionAlertSummary, emptyProtectionAlertSummary,
  mapChainVerifier, canonicalJson, eventCountsByAction,
  type GovPeriod, type RawAuditRow, type RawSnapshotRow, type GovernanceEvidencePack,
  type GovPackMetadata, type GovAuditTimelineItem,
} from './governanceEvidence.ts';

export interface GovAccessOk { ok: true; admin: SupabaseClient; scopeCasino: string; casinoName: string | null; principal: AuthenticatedPrincipal }
export interface GovAccessDeny { ok: false; status: number }
export type GovAccess = GovAccessOk | GovAccessDeny;

export async function resolveGovEvidenceAccess(req: Request, requestedCasinoId?: string): Promise<GovAccess> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return { ok: false, status: 503 };
  const admin = createClient(url, service, { auth: { persistSession: false } });

  const principal = await verifyPrincipal(admin as unknown as PrincipalClient, req.headers.get('authorization'), service);
  if (!principal) return { ok: false, status: 401 };
  if (principal.isServiceRole || !isAlertOperatorRole(principal.role)) return { ok: false, status: 403 }; // operators only; no regulator
  const profile = alertScopeProfile(principal.role);
  const scope = resolveRpScope(profile, principal.casinoId ?? undefined, requestedCasinoId);
  if ('deny' in scope) return { ok: false, status: scope.deny };
  const scopeCasino = scope.scopeCasino;

  const { data: casino, error } = await admin.from('casinos').select('id, name, jurisdiction, province').eq('id', scopeCasino).maybeSingle();
  if (error) return { ok: false, status: 503 };
  if (!casino) return { ok: false, status: 404 };
  if (!principalMayAccessCasino(principal, casino as { id: string; jurisdiction: string; province: string | null })) return { ok: false, status: 403 };
  return { ok: true, admin, scopeCasino, casinoName: (casino as { name?: string | null }).name ?? null, principal };
}

function loadRuntimeProvenance(): { environment: string | null; dataClass: string | null; sourceGitCommit: string | null; deploymentVersion: string | null } {
  try {
    const v = JSON.parse(readFileSync(join(process.cwd(), 'version.json'), 'utf8')) as Record<string, string>;
    return { environment: v.environment ?? null, dataClass: v.dataClass ?? null, sourceGitCommit: v.gitCommit ?? null, deploymentVersion: v.deploymentVersion ?? null };
  } catch {
    const env = process.env.NEXT_PUBLIC_SAFEBET_ENV ?? process.env.NEXT_PUBLIC_ENV ?? null;
    return { environment: env, dataClass: env && env !== 'production' ? 'synthetic' : null, sourceGitCommit: process.env.SAFEBET_GIT_COMMIT ?? null, deploymentVersion: process.env.SAFEBET_EB_VERSION ?? null };
  }
}

const inRange = (v: string | null, startIso: string, endIso: string): boolean => {
  if (!v) return false; const t = Date.parse(v); return t >= Date.parse(startIso) && t < Date.parse(endIso);
};

export interface GovPackResult { pack: GovernanceEvidencePack; timelineTruncatedForPreview: boolean; fullTimelineCount: number; tooLarge: boolean }

/** Assemble the governed pack (shared by preview + export). Preview omits packId/SHA and
 *  returns only `previewPageSize` timeline items; export returns the complete timeline. */
export async function buildGovernancePack(
  access: GovAccessOk, period: GovPeriod, opts: { mode: 'preview' | 'export'; previewPageSize: number },
): Promise<GovPackResult> {
  const { admin, scopeCasino, casinoName, principal } = access;

  // ── allowlisted audit timeline (coarse category + period prefilter; exact-triple filter in JS) ──
  const { data: auditRows } = await admin
    .from('audit_events')
    .select('created_at,event_category,event_type,action,severity,outcome,user_role,resource_type')
    .eq('casino_id', scopeCasino)
    .in('event_category', GOV_ALLOWLISTED_CATEGORIES as string[])
    .gte('created_at', period.startIso).lt('created_at', period.endIsoExclusive)
    .order('created_at', { ascending: true }).order('event_id', { ascending: true })
    .limit(GOV_MAX_EXPORT_ROWS + 1);
  const fullTimeline: GovAuditTimelineItem[] = mapTimeline((auditRows ?? []) as RawAuditRow[]);
  const fullTimelineCount = fullTimeline.length;
  const tooLarge = opts.mode === 'export' && fullTimelineCount > GOV_MAX_EXPORT_ROWS;

  // ── compliance snapshots (own-casino, period) ──
  const { data: snapRows } = await admin
    .from('compliance_snapshots')
    .select('framework,total_controls,compliant,non_compliant,partial,not_assessed,compliance_score,snapshot_date')
    .eq('casino_id', scopeCasino)
    .gte('snapshot_date', period.startDate).lt('snapshot_date', period.endDate)
    .order('snapshot_date', { ascending: true }).order('framework', { ascending: true });
  const complianceSnapshots = ((snapRows ?? []) as RawSnapshotRow[]).map(mapSnapshot);

  // ── intervention occurrence (period by intervention_date) ──
  const { data: ivRows } = await admin
    .from('player_protection_interventions')
    .select('outcome,follow_up_required')
    .eq('casino_id', scopeCasino)
    .gte('intervention_date', period.startIso).lt('intervention_date', period.endIsoExclusive);
  const interventions = buildInterventionSummary((ivRows ?? []) as { outcome: string | null; follow_up_required: boolean | null }[]);

  // ── protection-alert activity by type (counts only, period by lifecycle timestamp) ──
  const { data: alertRows } = await admin
    .from('player_protection_alerts')
    .select('alert_type,generated_at,acknowledged_at,resolved_at')
    .eq('casino_id', scopeCasino);
  const alertAgg: Record<string, { alert_type: string; generated: number; acknowledged: number; resolved: number }> = {};
  for (const ty of GOV_ALERT_TYPES) alertAgg[ty] = { alert_type: ty, generated: 0, acknowledged: 0, resolved: 0 };
  for (const r of (alertRows ?? []) as { alert_type: string; generated_at: string | null; acknowledged_at: string | null; resolved_at: string | null }[]) {
    const a = alertAgg[r.alert_type]; if (!a) continue;
    if (inRange(r.generated_at, period.startIso, period.endIsoExclusive)) a.generated += 1;
    if (inRange(r.acknowledged_at, period.startIso, period.endIsoExclusive)) a.acknowledged += 1;
    if (inRange(r.resolved_at, period.startIso, period.endIsoExclusive)) a.resolved += 1;
  }
  const protectionAlerts = alertRows ? buildProtectionAlertSummary(Object.values(alertAgg)) : emptyProtectionAlertSummary();

  // ── chain integrity (own casino scope) ──
  let chainJson: unknown = { status: 'unavailable' };
  try { const { data, error } = await admin.rpc('sbiq_verify_audit_chain', { p_scope: scopeCasino }); if (!error) chainJson = data; } catch { /* UNAVAILABLE */ }
  const chainIntegrity = mapChainVerifier(chainJson);

  const prov = loadRuntimeProvenance();
  const syntheticDemo = (prov.dataClass === 'synthetic') || (prov.environment != null && prov.environment !== 'production');
  const generatedAt = new Date().toISOString();

  const packMetadata: GovPackMetadata = {
    schemaVersion: GOV_EVIDENCE_SCHEMA_VERSION, casinoName,  // display name only — never raw casino_id in the artifact
    periodStart: period.startDate, periodEndExclusive: period.endDate, timezone: GOV_TIMEZONE,
    generatedAt, generatedByRole: principal.role,
    environment: prov.environment, dataClass: prov.dataClass,
    sourceGitCommit: prov.sourceGitCommit, deploymentVersion: prov.deploymentVersion,
    syntheticDemo, disclaimer: syntheticDemo ? GOV_SYNTHETIC_DISCLAIMER : null,
  };

  const auditTimeline = opts.mode === 'preview' ? fullTimeline.slice(0, opts.previewPageSize) : fullTimeline;

  const pack: GovernanceEvidencePack = {
    schemaVersion: GOV_EVIDENCE_SCHEMA_VERSION,
    packMetadata,
    governanceSummary: {
      includedCategories: [...GOV_ALLOWLISTED_CATEGORIES],
      eventCountsByAction: eventCountsByAction(fullTimeline),
      complianceSnapshotCount: complianceSnapshots.length,
      chainIntegrityStatus: chainIntegrity.status,
      auditTimelineRecordCount: fullTimelineCount,
    },
    protectionAlerts, interventions, complianceSnapshots, auditTimeline, chainIntegrity,
  };

  return { pack, timelineTruncatedForPreview: opts.mode === 'preview' && fullTimelineCount > auditTimeline.length, fullTimelineCount, tooLarge };
}

export function sha256Hex(s: string): string { return createHash('sha256').update(Buffer.from(s, 'utf8')).digest('hex'); }

/** Finalise an EXPORT pack: assign packId + pack SHA-256 (over canonical JSON without packIntegrity). */
export function finaliseExportPack(pack: GovernanceEvidencePack): GovernanceEvidencePack {
  const packId = randomUUID();
  const withId: GovernanceEvidencePack = { ...pack, packId };
  const sha = sha256Hex(canonicalJson(withId));   // packIntegrity not yet present → excluded by construction
  return { ...withId, packIntegrity: { packSha256: sha, algorithm: 'SHA-256', note: GOV_PACK_SHA_NOTE } };
}

/** MANDATORY export audit (existing chain; no migration). Returns true iff the insert succeeded. */
export async function writeExportAudit(access: GovAccessOk, pack: GovernanceEvidencePack, format: 'json' | 'csv'): Promise<boolean> {
  const packId = pack.packId!;
  const { error } = await access.admin.from('audit_events').insert({
    event_id: `gov:${packId}`,
    event_type: GOV_EXPORT_AUDIT_ACTION,
    event_category: 'responsible_gambling',
    action: GOV_EXPORT_AUDIT_ACTION,
    resource_type: 'governance_evidence',
    resource_id: packId,
    user_id: access.principal.userId,
    user_role: access.principal.role,
    casino_id: access.scopeCasino,
    severity: 'info',
    outcome: 'success',
    metadata: {
      period_start: pack.packMetadata.periodStart,
      period_end_exclusive: pack.packMetadata.periodEndExclusive,
      format,
      included_categories: pack.governanceSummary.includedCategories,
      record_count: pack.governanceSummary.auditTimelineRecordCount,
      pack_sha256: pack.packIntegrity?.packSha256 ?? null,
      schema_version: pack.schemaVersion,
    },
  });
  return !error;
}
