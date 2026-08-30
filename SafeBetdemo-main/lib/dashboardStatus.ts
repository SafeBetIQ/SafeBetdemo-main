// ─── Operator Dashboard status derivation (UAT-OP-3 P1-A / integrity flash) ──
//
// The dashboard header badge previously showed "Data integrity warning" whenever
// the reconciliation was not OK — including while the certified snapshot was still
// loading (reconcileOperatorKpi(null) returns ok:false). That produced a transient
// integrity-warning flash on every dashboard startup.
//
// This helper makes the states mutually exclusive and, crucially, distinguishes
// LOADING from an actual validated inconsistency:
//   loading (no kpi yet) -> 'loading'      (neutral; never an integrity warning)
//   loaded but no kpi     -> 'unavailable'  (honest "data unavailable", not zero)
//   loaded, kpi, checks fail -> 'integrity' (a REAL reconciliation discrepancy)
//   loaded, kpi, checks pass -> 'healthy'

export type DashboardStatus = 'loading' | 'unavailable' | 'integrity' | 'healthy';

export function dashboardStatus(opts: {
  loading: boolean;
  hasKpi: boolean;
  loadFailed: boolean;
  reconOk: boolean;
}): DashboardStatus {
  // While the certified snapshot is still being fetched, this is NOT an integrity
  // failure — it is simply not loaded yet.
  if (opts.loading && !opts.hasKpi) return 'loading';
  if (opts.loadFailed || !opts.hasKpi) return 'unavailable';
  if (!opts.reconOk) return 'integrity';
  return 'healthy';
}
