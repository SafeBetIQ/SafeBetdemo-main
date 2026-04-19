import { QueryResultRow } from 'pg';
import { queryWithTenant } from './db';
import { createLogger } from './logger';

const log = createLogger('audit');

// ---------------------------------------------------------------------------
// Action constants — exhaustive list of auditable events.
// Keep values SCREAMING_SNAKE_CASE so they're unambiguous in regulator exports.
// ---------------------------------------------------------------------------
export const AUDIT_ACTIONS = {
  // Auth
  USER_LOGIN:                  'USER_LOGIN',
  USER_LOGIN_FAILED:           'USER_LOGIN_FAILED',
  TOKEN_VERIFIED:              'TOKEN_VERIFIED',

  // Players
  PLAYER_CREATED:              'PLAYER_CREATED',
  PLAYER_UPDATED:              'PLAYER_UPDATED',
  PLAYER_SUSPENDED:            'PLAYER_SUSPENDED',

  // Risk
  RISK_SCORE_COMPUTED:         'RISK_SCORE_COMPUTED',
  RISK_SCORE_RETRIEVED:        'RISK_SCORE_RETRIEVED',

  // Interventions
  INTERVENTION_TRIGGERED:      'INTERVENTION_TRIGGERED',
  INTERVENTION_ACKNOWLEDGED:   'INTERVENTION_ACKNOWLEDGED',
  INTERVENTION_DISMISSED:      'INTERVENTION_DISMISSED',
  INTERVENTION_ESCALATED:      'INTERVENTION_ESCALATED',

  // Compliance
  COMPLIANCE_EVENT_LOGGED:     'COMPLIANCE_EVENT_LOGGED',
  SELF_EXCLUSION_APPLIED:      'SELF_EXCLUSION_APPLIED',
  KYC_STATUS_UPDATED:          'KYC_STATUS_UPDATED',
  DATA_EXPORT_REQUESTED:       'DATA_EXPORT_REQUESTED',

  // Admin
  ADMIN_ACTION:                'ADMIN_ACTION',
} as const;

export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS];

// ---------------------------------------------------------------------------
// Entity types — matches the table names the action relates to.
// ---------------------------------------------------------------------------
export type AuditEntityType =
  | 'player'
  | 'session'
  | 'bet'
  | 'risk_score'
  | 'intervention'
  | 'compliance_event'
  | 'auth'
  | 'system';

// ---------------------------------------------------------------------------
// Metadata is sanitised before storage:
//   • No raw passwords
//   • No full PII (email is acceptable for compliance; no SSN/banking details)
//   • No tokens or secrets
// ---------------------------------------------------------------------------
export interface AuditMetadata {
  [key: string]: string | number | boolean | null | undefined | AuditMetadata;
}

export interface LogAuditParams {
  casinoId:   string;
  userId:     string;         // Cognito sub of the actor
  action:     AuditAction;
  entityType: AuditEntityType;
  entityId?:  string;         // UUID of the affected row
  metadata?:  AuditMetadata;
}

interface AuditRow extends QueryResultRow {
  id: string;
}

// ---------------------------------------------------------------------------
// logAudit — fire-and-forget safe.
//
// The hash chain (prev_hash → hash) is computed by the database trigger
// (set_audit_hash) on INSERT, so the application does not need to manage
// it.  This keeps the Node.js side simple and prevents race conditions
// from concurrent Lambdas trying to read and set the same prev_hash.
//
// Usage:
//   await logAudit({
//     casinoId:   claims.casinoId,
//     userId:     claims.sub,
//     action:     AUDIT_ACTIONS.PLAYER_CREATED,
//     entityType: 'player',
//     entityId:   player.id,
//     metadata:   { email: player.email, country: player.country_code },
//   });
// ---------------------------------------------------------------------------
export async function logAudit(params: LogAuditParams): Promise<void> {
  const { casinoId, userId, action, entityType, entityId, metadata } = params;

  try {
    await queryWithTenant<AuditRow>(
      casinoId,
      `INSERT INTO audit_logs
         (casino_id, user_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        casinoId,
        userId,
        action,
        entityType,
        entityId ?? null,
        metadata ? JSON.stringify(metadata) : null,
      ],
      `audit.${action}`,
    );
  } catch (err: unknown) {
    // Audit failures must NEVER silently swallow — log loudly but do not
    // crash the business operation.  The Lambda will still return 200 to
    // the caller; ops must alert on audit write failures.
    log.error('AUDIT WRITE FAILED', err, { casinoId, userId, action, entityType, entityId });
  }
}

// ---------------------------------------------------------------------------
// verifyChain — returns tampered rows for a tenant.
// Call from a regulator-facing endpoint or a scheduled Lambda.
// An empty array means the chain is intact.
// ---------------------------------------------------------------------------
interface ChainRow extends QueryResultRow {
  id:            string;
  created_at:    string;
  action:        string;
  stored_hash:   string;
  expected_hash: string;
  tampered:      boolean;
}

export async function verifyAuditChain(
  casinoId: string,
): Promise<ChainRow[]> {
  const result = await queryWithTenant<ChainRow>(
    casinoId,
    `SELECT id, created_at, action, stored_hash, expected_hash, tampered
     FROM   verify_audit_chain($1)
     WHERE  tampered = true`,
    [casinoId],
    'audit.verifyChain',
  );
  return result.rows;
}
