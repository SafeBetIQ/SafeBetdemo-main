// ─── ARCH-V4-A2 — Financial Rollup Worker (dedicated, isolated) ──────────────
// Consumes a queue message and orchestrates the EXISTING authoritative incremental
// financial rollup by invoking the certified DB function
// `public.sbiq_financial_rollup_refresh(p_max_buckets)` via PostgREST. It does NOT
// re-implement or change GGR arithmetic, certified semantics, source_as_of, or the
// freshness contract — it only moves SCHEDULING + ORCHESTRATION + RETRY/DLQ +
// CONCURRENCY-BOUNDING + OBSERVABILITY off shared pg_cron/OLTP scheduling onto a
// durable queue + dedicated worker (Architecture Authority §9).
//
// Idempotency: the DB function is watermark/dirty-bucket incremental and guarded by
// pg advisory xact lock, so a duplicated queue delivery cannot double-count — a
// re-run recomputes the same buckets. Reserved concurrency = 1 enforces a single
// effective writer. Failures throw → SQS retry → DLQ (no silent loss, no watchdog
// recursion). The service-role key is read from Secrets Manager and NEVER logged.

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import https from 'node:https';

const REGION = process.env.AWS_REGION || 'eu-west-1';
const SECRET_ID = process.env.SUPABASE_SECRET_ID;            // Secrets Manager id/ARN
const SUPABASE_URL = process.env.SUPABASE_URL;               // public, non-secret
const MAX_BUCKETS = parseInt(process.env.MAX_BUCKETS || '500', 10);
const RPC = 'sbiq_financial_rollup_refresh';
const NAMESPACE = 'SafeBet/FinancialRollup';

let cachedKey = null;
async function getServiceKey() {
  if (cachedKey) return cachedKey;
  const sm = new SecretsManagerClient({ region: REGION });
  const r = await sm.send(new GetSecretValueCommand({ SecretId: SECRET_ID }));
  const s = r.SecretString ?? '';
  let key = s;
  try { const o = JSON.parse(s); key = o.service_role_key || o.SUPABASE_SERVICE_ROLE_KEY || o.key || s; } catch { /* raw string */ }
  if (!key) throw new Error('service key missing from secret');
  cachedKey = key;
  return key;
}

function callRollup(key) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ p_max_buckets: MAX_BUCKETS });
    const url = new URL(`/rest/v1/rpc/${RPC}`, SUPABASE_URL);
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 90_000,
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve({ status: res.statusCode, body: data });
        else reject(new Error(`rollup RPC HTTP ${res.statusCode}: ${String(data).slice(0, 200)}`));
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('rollup RPC timeout')));
    req.write(payload);
    req.end();
  });
}

async function emit(cw, MetricName, Value, Unit = 'Count') {
  try { await cw.send(new PutMetricDataCommand({ Namespace: NAMESPACE, MetricData: [{ MetricName, Value, Unit }] })); }
  catch (e) { console.warn(JSON.stringify({ msg: 'metric_emit_failed', MetricName, error: String(e.message || e) })); }
}

export const handler = async (event) => {
  const cw = new CloudWatchClient({ region: REGION });
  const records = Array.isArray(event?.Records) && event.Records.length ? event.Records : [{ messageId: `manual-${Date.now()}`, body: '{}' }];

  for (const rec of records) {
    const correlationId = rec.messageId || `manual-${Date.now()}`;
    const receiveCount = Number(rec?.attributes?.ApproximateReceiveCount || 1);
    let body = {};
    try { body = rec.body ? JSON.parse(rec.body) : {}; } catch { /* non-JSON message body */ }
    const t0 = Date.now();
    console.log(JSON.stringify({ msg: 'rollup_start', correlationId, receiveCount, maxBuckets: MAX_BUCKETS }));

    // Safe synthetic failure path for the DLQ/retry drill — never touches financial data.
    if (body.forceFail === true) {
      await emit(cw, 'RollupFailure', 1);
      console.error(JSON.stringify({ msg: 'rollup_forced_failure', correlationId, receiveCount }));
      throw new Error('synthetic forced failure (DLQ drill) — no financial mutation performed');
    }

    try {
      const key = await getServiceKey();
      const r = await callRollup(key);
      const durationMs = Date.now() - t0;
      let result; try { result = JSON.parse(r.body); } catch { result = String(r.body).slice(0, 200); }
      console.log(JSON.stringify({ msg: 'rollup_success', correlationId, receiveCount, durationMs, result }));
      await emit(cw, 'RollupSuccess', 1);
      await emit(cw, 'RollupDurationMs', durationMs, 'Milliseconds');
      await emit(cw, 'RollupReceiveCount', receiveCount);
    } catch (e) {
      const durationMs = Date.now() - t0;
      console.error(JSON.stringify({ msg: 'rollup_failure', correlationId, receiveCount, durationMs, error: String(e.message || e) }));
      await emit(cw, 'RollupFailure', 1);
      throw e; // → SQS visibility timeout → redelivery → DLQ after maxReceiveCount
    }
  }
  return { ok: true, processed: records.length };
};
