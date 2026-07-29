// ─── Contribution Projector (Milestone 4.3) ──────────────────────────────────
//
// Deterministic transform of ACCEPTED Event Platform contributions into the
// certified Matching Engine input (`FederationContribution[]`). It excludes
// rejected (never accepted), revoked, and expired contributions; avoids duplicate
// projection; preserves operator attribution + cryptographic-version provenance;
// and is fully rebuildable from the accepted log. It makes NO federation decision,
// mints NO SB-NAT, and interprets NO policy. Cross-version contributions never
// match (different pepper version → different digest).

import type { JurisdictionCode, FederationContribution, AttributeHash } from '../types.ts';
import {
  type ContributionAuditSink, InMemoryContributionAuditSink, sealContributionAudit,
} from './model.ts';
import { type FederationEventPlatform, type ContributionServiceContext } from './eventPlatform.ts';

export interface ProjectionResult {
  contributions: FederationContribution[];
  /** sbPlr → the accepted event ids that formed its evidence (provenance). */
  provenance: Map<string, string[]>;
}

export interface ProjectorOptions { auditSink?: ContributionAuditSink; now?: () => string; }

export class ContributionProjector {
  private readonly auditSink: ContributionAuditSink;
  private readonly now: () => string;
  constructor(opts: ProjectorOptions = {}) {
    this.auditSink = opts.auditSink ?? new InMemoryContributionAuditSink();
    this.now = opts.now ?? (() => new Date().toISOString());
  }

  /**
   * Project the accepted contributions for a jurisdiction into Matching Engine
   * input. Deterministic + rebuildable. Excludes revoked/expired. Groups by
   * (operator, SB-PLR); one FederationContribution per operator identity.
   */
  matchingContributions(platform: FederationEventPlatform, ctx: ContributionServiceContext, jurisdiction: JurisdictionCode, asOf?: string): ProjectionResult {
    const at = asOf ?? this.now();
    const accepted = platform.acceptedContributions(ctx)
      .filter((r) => r.jurisdiction === jurisdiction)
      .filter((r) => !platform.isRevoked(r.eventId))                     // revoked excluded
      .filter((r) => !r.expiryAt || r.expiryAt > at)                     // expired excluded
      .sort((a, b) => a.sourceOperatorId.localeCompare(b.sourceOperatorId) || a.sbPlr.localeCompare(b.sbPlr) || a.attributeType.localeCompare(b.attributeType) || a.eventId.localeCompare(b.eventId));

    const byKey = new Map<string, FederationContribution>();
    const provenance = new Map<string, string[]>();
    const seenAttr = new Set<string>();                                 // avoid duplicate projection per (op,sbPlr,attr,digest)

    for (const r of accepted) {
      const dedup = `${r.sourceOperatorId}|${r.sbPlr}|${r.attributeType}|${r.digest}`;
      if (seenAttr.has(dedup)) continue;
      seenAttr.add(dedup);
      const gk = `${r.sourceOperatorId}|${r.sbPlr}`;
      if (!byKey.has(gk)) byKey.set(gk, { jurisdiction, casinoId: r.sourceOperatorId, sbPlr: r.sbPlr, attributes: [], contributedAt: r.acceptedAt });
      const attr: AttributeHash = { attributeType: r.attributeType, hash: r.digest, pepperKeyVersion: r.pepperVersion };
      byKey.get(gk)!.attributes.push(attr);
      const pk = `${r.sbPlr}`;
      if (!provenance.has(pk)) provenance.set(pk, []);
      provenance.get(pk)!.push(r.eventId);
    }

    const contributions = Array.from(byKey.values());
    this.auditSink.append(sealContributionAudit({ at, action: 'projection-completed', eventId: null, jurisdiction, tenantId: null, sourceOperatorId: null, sbPlr: null, detail: `projected ${contributions.length} contribution(s) from ${accepted.length} accepted event(s)` }));
    return { contributions, provenance };
  }

  /** Record a matching-handoff audit event (called after the certified engine runs). */
  recordMatchingHandoff(jurisdiction: JurisdictionCode, candidateCount: number): void {
    this.auditSink.append(sealContributionAudit({ at: this.now(), action: 'matching-handoff-completed', eventId: null, jurisdiction, tenantId: null, sourceOperatorId: null, sbPlr: null, detail: `handoff produced ${candidateCount} candidate(s)` }));
  }

  auditTrail(): readonly ReturnType<ContributionAuditSink['list']>[number][] { return this.auditSink.list(); }
}

/** Reconstruct a candidate's contribution provenance (accepted event ids for both SB-PLRs). */
export function candidateProvenance(provenance: Map<string, string[]>, sbPlrA: string, sbPlrB: string): string[] {
  return Array.from(new Set([...(provenance.get(sbPlrA) ?? []), ...(provenance.get(sbPlrB) ?? [])])).sort();
}
