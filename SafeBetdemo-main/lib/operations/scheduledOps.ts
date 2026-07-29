// ─── Enterprise Scheduled Operations (Phase 4.4, WS3) ────────────────────────
//
// Orchestrates EXISTING platform capabilities on a schedule. Creates no new
// workflow, state, or runtime model — every task calls a function the
// platform already owns (partition maintenance, health, projection rebuild).
// Intended to be driven by a scheduler (cron / edge invocation) via the
// platform-ops function.

import { emit } from '../observability/telemetry.ts';

export interface OpsClient {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

export interface TaskResult {
  task: string;
  ok: boolean;
  detail: Record<string, unknown>;
}

/**
 * Partition maintenance: ensure the current month + a forward buffer of
 * monthly event-log partitions exist. Idempotent (safe to run daily).
 */
export async function ensurePartitions(client: OpsClient, monthsAhead = 2): Promise<TaskResult> {
  const created: string[] = [];
  const base = Date.now();
  for (let i = 0; i <= monthsAhead; i++) {
    const ts = new Date(base);
    ts.setMonth(ts.getMonth() + i);
    const { data, error } = await client.rpc('sbiq_ensure_event_partition', { p_ts: ts.toISOString() });
    if (error) throw new Error(`ensure_event_partition failed: ${error.message}`);
    created.push(String(Array.isArray(data) ? data[0] : data));
  }
  emit('info', 'operations.scheduled', 'ensure_partitions', { partitions: created });
  return { task: 'ensure_partitions', ok: true, detail: { partitions: created } };
}

/** Health verification for one casino (reads sbiq_platform_health). */
export async function verifyHealth(client: OpsClient, casinoId: string): Promise<Record<string, unknown>> {
  const { data, error } = await client.rpc('sbiq_platform_health', { p_casino: casinoId });
  if (error) throw new Error(`platform_health failed: ${error.message}`);
  return (data ?? {}) as Record<string, unknown>;
}

/**
 * Projection integrity verification: compares distinct players in the log to
 * players projected. A mismatch means drift — the caller may trigger a
 * rebuild (the platform's own replay path). Read-only; recommends, never acts.
 */
export function assessProjectionIntegrity(health: Record<string, unknown>): TaskResult {
  const distinct = Number(health.distinct_players ?? 0);
  const projected = Number(health.players_projected ?? 0);
  const consistent = projected >= distinct;
  emit(consistent ? 'info' : 'warn', 'operations.scheduled', 'projection_integrity',
    { distinct_players: distinct, players_projected: projected, consistent });
  return {
    task: 'projection_integrity', ok: consistent,
    detail: { distinct_players: distinct, players_projected: projected, rebuild_advised: !consistent },
  };
}

/**
 * Archive preparation: report which months are archive-eligible before the
 * retention cutoff WITHOUT detaching (detach is an approved operational
 * action, executed separately via sbiq_archive_event_partitions_before).
 */
export async function archiveDryRun(client: OpsClient, retentionHotMonths: number): Promise<TaskResult> {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - retentionHotMonths);
  emit('info', 'operations.scheduled', 'archive_dry_run', { cutoff: cutoff.toISOString().slice(0, 10) });
  return { task: 'archive_dry_run', ok: true, detail: { cutoff_month: cutoff.toISOString().slice(0, 7), note: 'detach requires an approved operational action' } };
}
