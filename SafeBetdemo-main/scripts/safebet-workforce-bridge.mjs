#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// SafeBet IQ AI Workforce Bridge client.
//
// An INFORMATION + ADVICE connection ONLY between the SafeBet IQ development repo
// and the separate SafeBet IQ AI Workforce application. It NEVER executes code,
// deploys, changes databases/AWS, sends messages, or reads production secrets.
//
// Security:
//   * Reads the bridge key ONLY from the CLAUDE_BRIDGE_KEY environment variable.
//   * NEVER prints, logs, or writes the key. All output is passed through a
//     redactor before printing.
//   * HTTPS only, bounded timeout, non-200 handled, response JSON validated.
//   * Content submitted with a report is redacted for common secret patterns.
//   * Returns a non-zero exit status on any failure, with a distinct code per kind.
//
// Usage:
//   node scripts/safebet-workforce-bridge.mjs context
//   node scripts/safebet-workforce-bridge.mjs advice --question "..." [--objective "..."]
//   node scripts/safebet-workforce-bridge.mjs report --file report.md --id <stableId> \
//        --title "..." --type "Development report"
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';

const ENDPOINT = 'https://api-v2.appdeploy.ai/app/9a05a9cc81dc5a7de8/api/claude-bridge';
const TIMEOUT_MS = 20000;
const MAX_ATTEMPTS = 3;               // bounded; never retries indefinitely

// Exit codes for distinct outcomes.
const EXIT = { ok: 0, generic: 1, config: 2, unavailable: 3, auth: 4, rejected: 5, invalid: 6, usage: 7 };

// Redact common secret shapes before ANYTHING is printed or submitted.
const REDACTORS = [
  [/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]'],
  [/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, '[REDACTED_JWT]'],
  [/AKIA[0-9A-Z]{16}/g, '[REDACTED_AWS_ACCESS_KEY]'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]'],
  [/\b(CLAUDE_BRIDGE_KEY|SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE_KEY|DB_PASSWORD|DATABASE_URL|AWS_SECRET_ACCESS_KEY|AWS_ACCESS_KEY_ID|[A-Z0-9_]*PASSWORD|[A-Z0-9_]*SECRET|[A-Z0-9_]*API_?KEY|[A-Z0-9_]*PRIVATE_?KEY)\s*[:=]\s*("[^"]*"|'[^']*'|\S+)/gi, '$1=[REDACTED]'],
];
function redact(input) {
  let out = typeof input === 'string' ? input : JSON.stringify(input, null, 2);
  // Defensive: never let the actual key value appear, even if it slipped into text.
  const key = process.env.CLAUDE_BRIDGE_KEY;
  if (key && key.length >= 8) out = out.split(key).join('[REDACTED]');
  for (const [re, rep] of REDACTORS) out = out.replace(re, rep);
  return out;
}
function say(msg) { process.stdout.write(redact(msg) + '\n'); }
// Signal failure by throwing; main() prints it and sets process.exitCode. We avoid
// process.exit() on any path that has performed a fetch, because calling exit() while
// an HTTP socket handle is closing crashes libuv on Windows (async.c assertion) even
// after a successful response. Letting the loop drain gives a clean, correct exit code.
class BridgeError extends Error { constructor(kind, code, msg) { super(msg); this.kind = kind; this.code = code; } }
function fail(kind, code, msg) { throw new BridgeError(kind, code, redact(msg)); }

// ── Args ─────────────────────────────────────────────────────────────────────
async function main() {
  const [, , action, ...rest] = process.argv;
  const opt = (name) => {
    const i = rest.indexOf(`--${name}`);
    return i >= 0 && i + 1 < rest.length ? rest[i + 1] : undefined;
  };
  if (!action || !['context', 'advice', 'report'].includes(action)) {
    fail('usage-error', EXIT.usage, 'action must be one of: context | advice | report');
  }

  // Key: env only; never printed.
  const KEY = process.env.CLAUDE_BRIDGE_KEY;
  if (!KEY) {
    fail('config-error', EXIT.config,
      'CLAUDE_BRIDGE_KEY is not configured. Set it in the environment only (never in files, commits, or logs), then retry. Aborting bridge request.');
  }

  async function postOnce(body) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ac.signal,
      });
      const text = await res.text();
      return { status: res.status, text };
    } finally {
      clearTimeout(timer);
    }
  }

  // Bounded retry ONLY for transient network/timeout/5xx (never for auth/rejection).
  async function post(body) {
    let lastErr;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let r;
      try {
        r = await postOnce(body);
      } catch (e) {
        lastErr = e;
        if (attempt < MAX_ATTEMPTS) { await new Promise((s) => setTimeout(s, 500 * attempt)); continue; }
        fail('bridge-unavailable', EXIT.unavailable, e?.name === 'AbortError' ? 'request timed out' : (e?.message || 'network error'));
      }
      if (r.status === 401 || r.status === 403) fail('auth-failed', EXIT.auth, `bridge returned ${r.status} (check CLAUDE_BRIDGE_KEY)`);
      if (r.status >= 500 && attempt < MAX_ATTEMPTS) { await new Promise((s) => setTimeout(s, 500 * attempt)); continue; }
      if (r.status < 200 || r.status >= 300) fail('report-rejected', EXIT.rejected, `bridge returned ${r.status}: ${r.text.slice(0, 300)}`);
      let json;
      try { json = JSON.parse(r.text); } catch { fail('invalid-response', EXIT.invalid, 'response was not valid JSON'); }
      return json;
    }
    fail('bridge-unavailable', EXIT.unavailable, lastErr?.message || 'exhausted retries');
  }

  if (action === 'context') {
    const json = await post({ action: 'context' });
    say('[bridge] context: received organisational memory');
    say(json);
    process.exitCode = EXIT.ok;
    return;
  }

  if (action === 'advice') {
    const question = opt('question');
    const objective = opt('objective') ?? '';
    if (!question) fail('usage-error', EXIT.usage, 'advice requires --question "..."');
    const json = await post({ action: 'advice', question, objective });
    say('[bridge] advice: received workforce guidance');
    say(json);
    process.exitCode = EXIT.ok;
    return;
  }

  // report
  const file = opt('file');
  const reportId = opt('id');
  const title = opt('title') ?? 'SafeBet IQ completion report';
  const reportType = opt('type') ?? 'Development report';
  if (!file || !reportId) fail('usage-error', EXIT.usage, 'report requires --file <path> and --id <stableReportId>');
  let content;
  try { content = readFileSync(file, 'utf8'); } catch (e) { fail('usage-error', EXIT.usage, `cannot read --file: ${e?.message}`); }
  const safeContent = redact(content);   // redact secrets before submission
  const json = await post({
    action: 'report', reportId, title, reportType, source: 'Claude',
    sourceDate: new Date().toISOString(), content: safeContent,
  });
  if (json && json.updated === true) {
    say(`[bridge] successful-update: report ${reportId} accepted (updated: true)`);
    process.exitCode = EXIT.ok;
    return;
  }
  fail('report-rejected', EXIT.rejected, `report not confirmed updated: ${JSON.stringify(json).slice(0, 300)}`);
}

// Never call process.exit() after a fetch (Windows libuv crashes if a socket handle
// is mid-close). main() sets process.exitCode and returns; the loop drains cleanly.
main().catch((e) => {
  const be = e instanceof BridgeError ? e : new BridgeError('error', EXIT.generic, e?.message || 'unexpected error');
  process.stderr.write(`[bridge] ${be.kind}: ${redact(be.message)}\n`);
  process.exitCode = be.code;
});
