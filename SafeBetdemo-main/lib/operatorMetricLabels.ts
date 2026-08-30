// ─── Canonical operator activity/population metric labels (UAT-OP-5 P1-1) ────
//
// Four operator screens showed different populations under the same "Active
// Players" label. The VALUES are each valid — this module gives each distinct
// semantic ONE canonical label + one-line definition so the same concept reads
// the same everywhere and different concepts read differently. It changes only
// wording, never the underlying values or arithmetic.
//
//  players_active_now  -> "Active Now"       (freshness-window live count)
//  active_players /
//    observed roster    -> "Observed Players" (distinct players seen this snapshot)
//  open_sessions        -> "Open Sessions"
//  monitored roster     -> "Monitored Players"

export const OPERATOR_METRIC_LABELS = {
  activeNow: 'Active Now',
  observedPlayers: 'Observed Players',
  openSessions: 'Open Sessions',
  monitoredPlayers: 'Monitored Players',
} as const;

export const OPERATOR_METRIC_DEFS: Record<keyof typeof OPERATOR_METRIC_LABELS, string> = {
  activeNow: 'Players active within the current freshness window (live right now).',
  observedPlayers: 'Distinct players observed on the floor in this certified snapshot.',
  openSessions: 'Sessions currently open (active + idle + stale).',
  monitoredPlayers: 'Players under active responsible-gambling monitoring.',
};
