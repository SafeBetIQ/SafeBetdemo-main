import { db } from '../client';
import { randomInt, pick, daysAgoRandom, log, logOk, logErr } from '../utils';

const EVENT_TYPES = [
  'player.risk_level_changed', 'player.flagged',
  'intervention.created', 'intervention.delivered',
  'session.ended_by_system',
  'exclusion.registered', 'exclusion.lifted', 'exclusion.breach_detected',
  'compliance.snapshot_created', 'report.generated',
  'user.login', 'user.logout', 'user.password_changed',
  'api_key.created', 'api_key.revoked',
  'casino.settings_updated',
] as const;

const CATEGORY_MAP: Record<string, string> = {
  'player.risk_level_changed': 'Player Management',
  'player.flagged': 'Player Management',
  'intervention.created': 'Interventions',
  'intervention.delivered': 'Interventions',
  'session.ended_by_system': 'Sessions',
  'exclusion.registered': 'Self-Exclusion',
  'exclusion.lifted': 'Self-Exclusion',
  'exclusion.breach_detected': 'Self-Exclusion',
  'compliance.snapshot_created': 'Compliance',
  'report.generated': 'Compliance',
  'user.login': 'Authentication',
  'user.logout': 'Authentication',
  'user.password_changed': 'Authentication',
  'api_key.created': 'API Management',
  'api_key.revoked': 'API Management',
  'casino.settings_updated': 'Casino Admin',
};

const ACTION_LABELS: Record<string, string> = {
  'player.risk_level_changed': 'Player risk level updated by system',
  'player.flagged': 'Player flagged for manual review',
  'intervention.created': 'Responsible gambling intervention created',
  'intervention.delivered': 'Intervention message delivered to player',
  'session.ended_by_system': 'Active session terminated by system policy',
  'exclusion.registered': 'Self-exclusion registration processed',
  'exclusion.lifted': 'Self-exclusion period ended',
  'exclusion.breach_detected': 'Self-exclusion breach detected at venue',
  'compliance.snapshot_created': 'Compliance data snapshot generated',
  'report.generated': 'Regulatory report generated and submitted',
  'user.login': 'User authenticated successfully',
  'user.logout': 'User session terminated',
  'user.password_changed': 'Account password updated',
  'api_key.created': 'New API key provisioned',
  'api_key.revoked': 'API key revoked',
  'casino.settings_updated': 'Casino configuration settings changed',
};

const USER_ROLES = [
  'casino_admin', 'compliance_officer', 'system', 'national_regulator', 'super_admin',
] as const;

const USER_EMAILS = [
  'demo.casino@safebetiq.com',
  'demo.admin@safebetiq.com',
  'demo.regulator@safebetiq.com',
  'system@safebetiq.com',
  'compliance@safebetiq.com',
] as const;

const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
const OUTCOMES = ['success', 'failure'] as const;

// Weight outcomes: ~85% success, ~15% failure
function pickOutcome(): string {
  return Math.random() < 0.85 ? 'success' : 'failure';
}

// Weight severities toward lower risk
function pickSeverity(): string {
  const r = Math.random();
  if (r < 0.45) return 'low';
  if (r < 0.75) return 'medium';
  if (r < 0.92) return 'high';
  return 'critical';
}

export async function seedAuditEvents(casinoIds: string[]): Promise<void> {
  log('Seeding audit_events...');
  const rows: Record<string, unknown>[] = [];

  for (const casinoId of casinoIds) {
    const count = randomInt(60, 120);
    for (let i = 0; i < count; i++) {
      const eventType = pick(EVENT_TYPES);
      rows.push({
        casino_id: casinoId,
        event_type: eventType,
        event_category: CATEGORY_MAP[eventType] ?? 'System',
        user_email: pick(USER_EMAILS),
        user_role: pick(USER_ROLES),
        action: ACTION_LABELS[eventType] ?? eventType,
        severity: pickSeverity(),
        outcome: pickOutcome(),
        metadata: {},
        created_at: daysAgoRandom(0, 365),
      });
    }
  }

  const { error } = await db.from('audit_events').insert(rows);
  if (error) {
    logErr(`audit_events (${rows.length} rows): ${error.message}`);
  } else {
    logOk(`${rows.length} audit events seeded into audit_events`);
  }
}

export async function resetAuditEvents(casinoIds: string[]): Promise<void> {
  if (casinoIds.length === 0) return;
  const { error } = await db.from('audit_events').delete().in('casino_id', casinoIds);
  if (error) logErr(`reset audit_events: ${error.message}`);
  else logOk('Demo audit events deleted from audit_events');
}
