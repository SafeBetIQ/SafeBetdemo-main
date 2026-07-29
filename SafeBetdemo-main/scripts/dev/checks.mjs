// ─── SafeBet IQ demo launcher — pure helpers (v1.2.1) ────────────────────────
//
// Dependency-free, side-effect-free helpers for the one-command demo launcher.
// Kept pure so they are unit-testable. No secrets are ever handled or printed
// here. This is developer tooling only — it changes no enterprise behaviour.

export const REQUIRED_NODE_MAJOR = 20;
export const REQUIRED_NPM_MAJOR = 10;

/** Parse a .env file body into { KEY: value } (values never logged). */
export function parseEnv(text) {
  const out = {};
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

/** Major version from a string like 'v24.14.1' or '11.11.0'. */
export function major(version) {
  const m = /(\d+)/.exec(String(version ?? ''));
  return m ? Number(m[1]) : 0;
}

/** True if actual major ≥ required major. */
export function versionOk(version, requiredMajor) {
  return major(version) >= requiredMajor;
}

/** Redact a value for display: never show the secret, only presence + length. */
export function redact(value) {
  if (value === undefined || value === null || value === '') return '(missing)';
  return `set (${String(value).length} chars)`;
}

/** Classify an HTTP probe result for a reachability check. */
export function classifyHttp(status) {
  if (status === 0 || status === null || status === undefined) return 'down';
  if (status === 200) return 'ok';
  if (status === 401 || status === 403) return 'reachable';   // deployed + enforcing auth
  if (status >= 500) return 'down';
  return 'reachable';                                          // 400/404 = deployed, responded
}

const ICON = { ok: '✅', reachable: '🔒', down: '❌', warn: '⚠️', info: 'ℹ️', pass: '✅', fail: '❌' };
export function icon(state) { return ICON[state] ?? '•'; }

/** The full local URL catalogue (WS5). */
export function localUrls(appBase, fnBase) {
  return {
    'Application': {
      'Home': `${appBase}/`,
      'Login': `${appBase}/login`,
    },
    'Casino Portal': {
      'Dashboard': `${appBase}/casino/dashboard`,
      'Players': `${appBase}/casino/players`,
      'Interventions': `${appBase}/casino/interventions`,
      'AI Intelligence': `${appBase}/casino/ai-intelligence`,
      'Live Feed': `${appBase}/casino/live-feed`,
      'API Centre': `${appBase}/casino/api-centre`,
      'Integration (Connector Health)': `${appBase}/casino/integration`,
      'Onboarding Wizard': `${appBase}/casino/integration/onboarding`,
      'Onboarding Centre (v1.3)': `${appBase}/casino/onboarding`,
    },
    'Regulator Portal': {
      'Regulator Dashboard': `${appBase}/regulator/dashboard`,
      'Regulator Intelligence (National)': `${appBase}/regulator/intelligence`,
      'Investigation Workspace': `${appBase}/regulator/intelligence/investigation`,
      'Reports': `${appBase}/regulator/reports`,
    },
    'Administration / Operations': {
      'Customer Success (v1.3)': `${appBase}/admin/customer-success`,
      'Security': `${appBase}/admin/security`,
      'Audit': `${appBase}/admin/audit`,
      'Behavioural Risk Intelligence': `${appBase}/behavioral-risk-intelligence`,
    },
    'Enterprise API (Supabase-hosted)': {
      'Consumer Gateway': `${fnBase}/consumer-gateway`,
      'Regulator Portal': `${fnBase}/regulator-portal`,
      'Connector Ingest': `${fnBase}/connector-ingest`,
      'Identity Resolution': `${fnBase}/identity-resolution`,
      'Platform Ops (admin)': `${fnBase}/platform-ops`,
      'Digital Twin (ops)': `${fnBase}/digital-twin`,
      'Projection Platform (ops)': `${fnBase}/projection-platform`,
    },
  };
}

/** The certified layers a startup health check confirms (WS3). */
export const PLATFORM_LAYERS = [
  'Identity Resolution', 'Event Platform', 'Projection Platform', 'Digital Twin',
  'Domain Intelligence', 'Policy Platform', 'Consumer Platform', 'Connector Framework',
];

/** Render the startup dashboard (WS6). rows: [{label, state, detail}]. */
export function renderDashboard(meta, rows) {
  const line = '─'.repeat(58);
  const out = [];
  out.push('');
  out.push(`╭${line}╮`);
  out.push(`│  SafeBet IQ — Demo Environment` + ' '.repeat(27) + '│');
  out.push(`├${line}┤`);
  for (const [k, v] of Object.entries(meta)) {
    out.push(`│  ${k.padEnd(22)} ${String(v).padEnd(32).slice(0, 32)}│`);
  }
  out.push(`├${line}┤`);
  for (const r of rows) {
    const label = `${icon(r.state)} ${r.label}`.padEnd(34);
    out.push(`│  ${label} ${String(r.detail ?? '').padEnd(20).slice(0, 20)}│`);
  }
  out.push(`╰${line}╯`);
  return out.join('\n');
}

/** True when every required row passed (ok/reachable/pass). WS6 gate. */
export function allReady(rows) {
  return rows.filter(r => r.required !== false).every(r => ['ok', 'reachable', 'pass'].includes(r.state));
}

/** Friendly diagnostic (WS7): what / why / fix. */
export function diagnostic(title, why, fix) {
  return `\n${icon('fail')} ${title}\n   Why:  ${why}\n   Fix:  ${fix}`;
}
