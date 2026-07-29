// ─── Enterprise Monitoring & Alerting (Phase 4.4, WS4) ───────────────────────
//
// Pure evaluation of platform health against operational thresholds. Owns no
// state, performs no I/O — it reads a health snapshot (from
// sbiq_platform_health) and the operating profile, and returns structured
// alerts. Alerts fire ONLY on meaningful operational conditions (lag,
// ingestion stall, projection drift), never on business content.

import type { OperationalProfile } from './mode.ts';

export type AlertSeverity = 'ok' | 'warning' | 'critical';

export interface HealthSnapshot {
  casino_id: string;
  events_in_log: number;
  distinct_players: number;
  players_projected: number;
  sessions_projected: number;
  machines_projected: number;
  last_event_at: string | null;
  projection_lag_seconds: number | null;
  max_row_version: number;
}

export interface OperationalAlert {
  code: string;
  severity: AlertSeverity;
  casinoId: string;
  detail: Record<string, unknown>;
  message: string;
}

/** Highest severity across a set of alerts. */
export function overallSeverity(alerts: OperationalAlert[]): AlertSeverity {
  if (alerts.some(a => a.severity === 'critical')) return 'critical';
  if (alerts.some(a => a.severity === 'warning')) return 'warning';
  return 'ok';
}

/**
 * Evaluate one casino's health snapshot into operational alerts.
 * Thresholds come from the operating profile — the SAME facts yield stricter
 * alerts in production than in demonstration, without changing any data.
 */
export function evaluateHealth(snapshot: HealthSnapshot, profile: OperationalProfile): OperationalAlert[] {
  const alerts: OperationalAlert[] = [];
  const casinoId = snapshot.casino_id;

  // 1. Projection lag — the read side falling behind the event log.
  const lag = snapshot.projection_lag_seconds;
  if (typeof lag === 'number') {
    if (lag >= profile.lagCriticalSeconds) {
      alerts.push({ code: 'PROJECTION_LAG_CRITICAL', severity: 'critical', casinoId,
        detail: { lag_seconds: lag, threshold: profile.lagCriticalSeconds },
        message: `Projection lag ${Math.round(lag)}s exceeds critical threshold ${profile.lagCriticalSeconds}s` });
    } else if (lag >= profile.lagWarnSeconds) {
      alerts.push({ code: 'PROJECTION_LAG_WARNING', severity: 'warning', casinoId,
        detail: { lag_seconds: lag, threshold: profile.lagWarnSeconds },
        message: `Projection lag ${Math.round(lag)}s exceeds warning threshold ${profile.lagWarnSeconds}s` });
    }
  }

  // 2. Projection drift — distinct players in the log not fully projected.
  //    (After a healthy apply/rebuild these are equal.)
  if (snapshot.events_in_log > 0 && snapshot.players_projected < snapshot.distinct_players) {
    alerts.push({ code: 'PROJECTION_DRIFT', severity: 'warning', casinoId,
      detail: { distinct_players: snapshot.distinct_players, players_projected: snapshot.players_projected },
      message: `Projection drift: ${snapshot.distinct_players} players in log, ${snapshot.players_projected} projected — rebuild advised` });
  }

  // 3. Ingestion stall — a live casino with projections but no recent events.
  if (snapshot.players_projected > 0 && snapshot.last_event_at) {
    const ageSeconds = (Date.now() - new Date(snapshot.last_event_at).getTime()) / 1000;
    if (ageSeconds >= profile.lagCriticalSeconds * 4) {
      alerts.push({ code: 'INGESTION_STALL', severity: 'warning', casinoId,
        detail: { last_event_age_seconds: Math.round(ageSeconds) },
        message: `No events for ${Math.round(ageSeconds)}s on an active casino — check the producer` });
    }
  }

  return alerts;
}
