// ─── Certified financial posture SOURCE (PERF-REG-3) ─────────────────────────
// Every certified-financial consumer (operator live-floor, regulator operator-
// financial + CSV, evidence financial) reads the posture through THIS one helper,
// so all screens stay byte-identical by construction.
//
// It calls the rollup-backed RPC sbiq_certified_financial_posture_v2(p_casino),
// a drop-in for the projection_financial_posture VIEW: the RPC returns the EXACT
// same rowtype and semantics (proven parity) but answers shift/today/24h/MTD from
// complete pre-computed hourly rollup buckets + a small current-hour live tail,
// instead of scanning the full event log every request. Same certified RESULT,
// retrieved efficiently — the arithmetic is unchanged.
//
// The RPC is SECURITY DEFINER and granted only to service_role; these edge
// functions call it with the service client after their own authorization.

interface RpcClient {
  rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
}

/**
 * Fetch the certified financial posture row for one casino via the fast rollup
 * RPC. Returns the single posture row, or null (certified-unavailable / no row) —
 * never fabricated. Callers pass the casino id they have ALREADY authorised.
 */
export async function fetchCertifiedPosture(
  client: RpcClient,
  casinoId: string,
): Promise<Record<string, unknown> | null> {
  const { data } = await client.rpc('sbiq_certified_financial_posture_v2', { p_casino: casinoId });
  // The RPC returns `setof projection_financial_posture` (0 or 1 rows for one casino).
  const rows = Array.isArray(data) ? data : data == null ? [] : [data];
  return (rows[0] ?? null) as Record<string, unknown> | null;
}
