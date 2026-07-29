// ─── Financial Projection Platform (Milestone 4.5) ───────────────────────────
//
// Derives operator + national financial totals by REPLAYING accepted Event
// Platform events (the authoritative source). It is deterministic and fully
// rebuildable; it NEVER accepts a directly-inserted total. All money is integer
// minor units. GGR = Σ stake(settled non-void/refund) − Σ payout(won).

import type { JurisdictionCode } from '../types.ts';
import { type FinancialEventPlatform } from './eventPlatform.ts';
import {
  type FinancialAccessContext, type AcceptedFinancialEvent, type WagerState,
  PROJECTION_VERSION, GGR_FORMULA, FinancialAccessError,
} from './model.ts';

export interface OperatorProjection {
  operatorId: string; tenantId: string; jurisdiction: JurisdictionCode; currency: string;
  projectionVersion: string; formula: string;
  sessions: number; wagers: number;
  turnoverMinor: number; winsPaidMinor: number; lossesMinor: number;
  voidsCount: number; refundsMinor: number; ggrMinor: number;
  eventCount: number; byProduct: Record<string, number>;
  dataFreshness: string | null; sourceEventIds: string[];
}

export interface NationalAggregate {
  jurisdiction: JurisdictionCode; currency: string; projectionVersion: string;
  includedOperators: string[]; excludedOperators: { operatorId: string; reason: string }[];
  operatorCount: number; nationalGgrMinor: number; nationalTurnoverMinor: number; nationalWinsPaidMinor: number;
  window: { from: string | null; to: string | null }; dataFreshness: string | null;
}

interface WagerAgg { state: WagerState; stakeMinor: number; payoutMinor: number; product: string; }

/** Deterministically rebuild an operator projection from its accepted events. */
function projectOperator(events: AcceptedFinancialEvent[]): OperatorProjection {
  const first = events[0];
  const wagers = new Map<string, WagerAgg>();
  let sessions = 0; let refundsMinor = 0; const stamps: string[] = [];
  for (const e of events) {
    stamps.push(e.acceptedAt);
    if (e.eventType === 'session-started') sessions++;
    else if (e.eventType === 'wager-placed' && e.wagerId) wagers.set(e.wagerId, { state: 'placed', stakeMinor: e.amountMinor ?? 0, payoutMinor: 0, product: e.product ?? 'default' });
    else if (e.eventType === 'wager-settled' && e.wagerId) { const w = wagers.get(e.wagerId); if (w) { w.state = e.settlementResult === 'won' ? 'won' : 'lost'; if (e.settlementResult === 'won') w.payoutMinor = e.amountMinor ?? 0; } }
    else if (e.eventType === 'wager-voided' && e.wagerId) { const w = wagers.get(e.wagerId); if (w) w.state = 'voided'; }
    else if (e.eventType === 'refund-recorded' && e.wagerId) { const w = wagers.get(e.wagerId); if (w) w.state = 'refunded'; refundsMinor += e.amountMinor ?? 0; }
    else if (e.eventType === 'financial-correction' && e.wagerId) { const w = wagers.get(e.wagerId); if (w) w.state = 'corrected'; }
  }
  let turnoverMinor = 0; let winsPaidMinor = 0; let lossesMinor = 0; let voidsCount = 0;
  const byProduct: Record<string, number> = {};
  for (const w of Array.from(wagers.values())) {
    if (w.state === 'won' || w.state === 'lost') {
      turnoverMinor += w.stakeMinor;
      if (w.state === 'won') winsPaidMinor += w.payoutMinor; else lossesMinor += w.stakeMinor;
      byProduct[w.product] = (byProduct[w.product] ?? 0) + (w.stakeMinor - (w.state === 'won' ? w.payoutMinor : 0));
    } else if (w.state === 'voided') voidsCount++;
  }
  const ggrMinor = turnoverMinor - winsPaidMinor;
  const sortedStamps = stamps.slice().sort();
  return {
    operatorId: first.sourceOperatorId, tenantId: first.tenantId, jurisdiction: first.jurisdiction, currency: first.currency,
    projectionVersion: PROJECTION_VERSION, formula: GGR_FORMULA,
    sessions, wagers: wagers.size, turnoverMinor, winsPaidMinor, lossesMinor, voidsCount, refundsMinor, ggrMinor,
    eventCount: events.length, byProduct, dataFreshness: sortedStamps.length ? sortedStamps[sortedStamps.length - 1] : null,
    sourceEventIds: events.map((e) => e.eventId).sort(),
  };
}

export class FinancialProjectionPlatform {
  private readonly now: () => string;
  constructor(now: () => string = () => new Date().toISOString()) { this.now = now; }

  /** Rebuild all operator projections from accepted events (deterministic). */
  operatorProjections(platform: FinancialEventPlatform, ctx: FinancialAccessContext): OperatorProjection[] {
    const all = platform.acceptedEvents(ctx);
    const byOp = new Map<string, AcceptedFinancialEvent[]>();
    for (const e of all) { const k = `${e.sourceOperatorId}|${e.tenantId}`; if (!byOp.has(k)) byOp.set(k, []); byOp.get(k)!.push(e); }
    return Array.from(byOp.values()).map(projectOperator).sort((a, b) => a.operatorId.localeCompare(b.operatorId));
  }

  operatorProjection(platform: FinancialEventPlatform, ctx: FinancialAccessContext, operatorId: string): OperatorProjection | undefined {
    return this.operatorProjections(platform, ctx).find((p) => p.operatorId === operatorId);
  }

  /** National aggregate over eligible operator projections (regulator-only; single currency). */
  national(platform: FinancialEventPlatform, ctx: FinancialAccessContext, jurisdiction: JurisdictionCode): NationalAggregate {
    if (ctx.plane !== 'regulator') throw new FinancialAccessError('national aggregate is regulator-only');
    const ops = this.operatorProjections(platform, ctx).filter((p) => p.jurisdiction === jurisdiction);
    const currency = ops[0]?.currency ?? 'ZAR';
    const included: string[] = []; const excluded: { operatorId: string; reason: string }[] = [];
    let ggr = 0; let turnover = 0; let wins = 0; const stamps: string[] = [];
    for (const p of ops) {
      if (p.currency !== currency) { excluded.push({ operatorId: p.operatorId, reason: `currency ${p.currency} ≠ ${currency} (not summed)` }); continue; }
      included.push(p.operatorId); ggr += p.ggrMinor; turnover += p.turnoverMinor; wins += p.winsPaidMinor;
      if (p.dataFreshness) stamps.push(p.dataFreshness);
    }
    const sorted = stamps.slice().sort();
    return {
      jurisdiction, currency, projectionVersion: PROJECTION_VERSION,
      includedOperators: included.sort(), excludedOperators: excluded,
      operatorCount: included.length, nationalGgrMinor: ggr, nationalTurnoverMinor: turnover, nationalWinsPaidMinor: wins,
      window: { from: sorted[0] ?? null, to: sorted[sorted.length - 1] ?? null }, dataFreshness: sorted[sorted.length - 1] ?? null,
    };
  }
}
