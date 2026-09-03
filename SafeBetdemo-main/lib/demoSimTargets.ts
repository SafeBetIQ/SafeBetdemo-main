// Demo live-simulator per-casino activity profiles + target clamp logic.
// This MIRRORS the SQL in sbiq_demo_live_tick / sbiq_demo_sim_config so the
// contract (differentiated, bounded, freshness-respecting, no name conditionals)
// is unit-testable. The database config table is the runtime source of truth.

export interface CasinoSimProfile {
  casinoId: string;
  name: string;
  registeredApprox: number;   // approximate registered synthetic players
  baselineActiveTarget: number;
  showcaseActiveTarget: number;
}

// Data-driven (a table, not name conditionals). Differentiated per casino.
export const DEMO_SIM_PROFILES: CasinoSimProfile[] = [
  { casinoId: 'cc000002-0000-0000-0000-000000000002', name: 'Hollywoodbets', registeredApprox: 28000, baselineActiveTarget: 60, showcaseActiveTarget: 300 },
  { casinoId: 'cc000003-0000-0000-0000-000000000003', name: 'Betway',        registeredApprox: 22000, baselineActiveTarget: 50, showcaseActiveTarget: 250 },
  { casinoId: 'a1b2c3d4-0000-0000-0000-000000000001', name: 'Prestige',      registeredApprox: 18000, baselineActiveTarget: 40, showcaseActiveTarget: 180 },
  { casinoId: 'cc000001-0000-0000-0000-000000000001', name: 'SunBet',        registeredApprox: 14500, baselineActiveTarget: 28, showcaseActiveTarget: 120 },
  { casinoId: 'cc000004-0000-0000-0000-000000000004', name: 'Gold Rush',     registeredApprox: 10500, baselineActiveTarget: 20, showcaseActiveTarget: 90 },
  // Royal Palace stays the smallest operator by ACTIVE PLAYER COUNT (fewest
  // registered). ARCH-V3-A1 lifts its event-derived daily GGR into the Demo
  // presentation band via a higher synthetic STAKE range (bet_min/bet_max in
  // sbiq_demo_sim_config), NOT more players — so this active-target mirror is
  // unchanged. No GGR is hard-coded; revenue still arises from wager/win events.
  { casinoId: 'cc000005-0000-0000-0000-000000000005', name: 'Royal Palace',  registeredApprox: 8500,  baselineActiveTarget: 14, showcaseActiveTarget: 70 },
];

// Clamp a target the same way sbiq_demo_live_tick does: cap at 20% (baseline) /
// 40% (showcase) of observed, and floor at min(10, observed).
export function clampActiveTarget(target: number, observed: number, showcase: boolean): number {
  if (observed <= 0) return 0;
  const capped = Math.min(target, Math.round(observed * (showcase ? 0.4 : 0.2)));
  return Math.max(capped, Math.min(10, observed));
}
