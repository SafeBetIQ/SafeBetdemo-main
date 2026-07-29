// ─── Built-in connector profiles (v1.1) ──────────────────────────────────────
//
// Declarative MappingConfig templates for the supported source categories.
// These are DATA — starting points an operator adopts and overrides in
// configuration. They contain no behaviour. A casino integrates by choosing a
// profile and mapping its field names; common integrations need zero code.

import type { MappingConfig } from './types.ts';

/** Player loyalty / CRM — identity + VIP/session signals. */
export const LOYALTY_PROFILE: MappingConfig = {
  connectorType: 'loyalty', name: 'Loyalty / CRM (template)',
  fields: { playerRef: 'member_id', sessionId: 'visit_id', occurredAt: 'event_time', eventType: 'event' },
  eventTypeMap: { card_in: 'CARD_INSERT', card_out: 'CARD_REMOVED', vip: 'VIP_ACTIVITY', self_exclude: 'SELF_EXCLUSION' },
  idempotencyKeyField: 'event_id',
};

/** Slot machine management — spins/bets + machine lifecycle. */
export const SLOT_MANAGEMENT_PROFILE: MappingConfig = {
  connectorType: 'slot-management', name: 'Slot Management (template)',
  fields: { playerRef: 'player_card', sessionId: 'session', machineId: 'machine', occurredAt: 'ts', eventType: 'type' },
  eventTypeMap: { allocate: 'MACHINE_ALLOCATED', spin: 'BET_PLACED', jackpot: 'JACKPOT', idle: 'MACHINE_IDLE', fault: 'MACHINE_FAULT' },
  payload: { wager: 'bet_amount', win: 'win_amount', game: 'game_type' },
  metadata: { machine_type: 'machine_type', zone: 'casino_floor_location' },
  machinePrefix: 'M-', idempotencyKeyField: 'txn_id',
};

/** Table game management — hands/bets on table positions. */
export const TABLE_MANAGEMENT_PROFILE: MappingConfig = {
  connectorType: 'table-management', name: 'Table Management (template)',
  fields: { playerRef: 'player_ref', sessionId: 'shoe_session', tableId: 'table', occurredAt: 'time', eventType: 'action' },
  eventTypeMap: { seat: 'MACHINE_ALLOCATED', hand: 'HAND_PLAYED', bet: 'BET_PLACED', leave: 'CARD_REMOVED' },
  payload: { stake: 'bet_amount', payout: 'win_amount', game: 'game_type' },
  metadata: { table_type: 'machine_type', pit: 'casino_floor_location' },
  machinePrefix: 'T-', idempotencyKeyField: 'hand_id',
};

/** Casino management system (CMS) — session + revenue lifecycle. */
export const CASINO_MANAGEMENT_PROFILE: MappingConfig = {
  connectorType: 'casino-management', name: 'Casino Management System (template)',
  fields: { playerRef: 'patron', sessionId: 'session_id', machineId: 'device_id', occurredAt: 'occurred', eventType: 'event_code' },
  eventTypeMap: { SESSION_OPEN: 'SESSION_START', SESSION_CLOSE: 'SESSION_END', WAGER: 'BET_PLACED', CASHOUT: 'CASH_OUT' },
  payload: { amount: 'bet_amount', won: 'win_amount', game: 'game_type', balance: 'balance_after' },
  idempotencyKeyField: 'record_id',
};

/** Cash desk / cage — deposits / withdrawals / cash-out. */
export const CASH_DESK_PROFILE: MappingConfig = {
  connectorType: 'cash-desk', name: 'Cash Desk / Cage (template)',
  fields: { playerRef: 'account', occurredAt: 'time', eventType: 'kind' },
  eventTypeMap: { deposit: 'DEPOSIT', withdrawal: 'WITHDRAWAL', cashout: 'CASH_OUT' },
  payload: { amount: 'bet_amount', method: 'method' },
  idempotencyKeyField: 'receipt_no',
};

/** Existing responsible-gambling system — risk flags / interventions. */
export const RG_SYSTEM_PROFILE: MappingConfig = {
  connectorType: 'rg-system', name: 'Responsible Gambling System (template)',
  fields: { playerRef: 'subject', occurredAt: 'raised_at', eventType: 'signal' },
  eventTypeMap: { risk_flag: 'RISK_FLAG', alert: 'RISK_ALERT', intervention: 'INTERVENTION_TRIGGERED', exclusion: 'SELF_EXCLUSION' },
  payload: { score: 'risk_score', flags: 'risk_flags', reason: 'reason' },
  idempotencyKeyField: 'signal_id',
};

/** Generic third-party API — fully field-mapped by the operator. */
export const GENERIC_API_PROFILE: MappingConfig = {
  connectorType: 'generic-api', name: 'Generic API (template)',
  fields: { playerRef: 'playerRef', sessionId: 'sessionId', machineId: 'machineId', occurredAt: 'occurredAt', eventType: 'eventType' },
  idempotencyKeyField: 'id',
};

/** Batch file import (CSV/JSON rows) — a single event type per file feed. */
export const BATCH_FILE_PROFILE: MappingConfig = {
  connectorType: 'batch-file', name: 'Batch File Import (template)',
  fields: { playerRef: 'player', machineId: 'machine', occurredAt: 'timestamp' },
  defaultEventType: 'BET_PLACED',
  payload: { amount: 'bet_amount', win: 'win_amount', game: 'game_type' },
  machinePrefix: 'M-', idempotencyKeyField: 'row_id',
};

export const BUILT_IN_PROFILES: Record<string, MappingConfig> = {
  loyalty: LOYALTY_PROFILE,
  'slot-management': SLOT_MANAGEMENT_PROFILE,
  'table-management': TABLE_MANAGEMENT_PROFILE,
  'casino-management': CASINO_MANAGEMENT_PROFILE,
  'cash-desk': CASH_DESK_PROFILE,
  'rg-system': RG_SYSTEM_PROFILE,
  'generic-api': GENERIC_API_PROFILE,
  'batch-file': BATCH_FILE_PROFILE,
};
