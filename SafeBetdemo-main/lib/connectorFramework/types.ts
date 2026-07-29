// ─── Enterprise Casino Integration — Connector Framework (v1.1) ──────────────
//
// Connectors are ADAPTERS ONLY. They translate an external casino system's
// records into the certified CasinoEventDraft contract and submit them
// through the ONE Enterprise Event Platform. They introduce NO business
// logic, NO parallel ingestion path, and NO runtime state — every event
// enters through the certified enterprise flow (Constitution 1), identity is
// resolved by the Identity Resolution Service exactly as for any other
// producer, and the Event Platform remains the single, authoritative
// validator (reject-never-repair).
//
// A connector = a declarative MappingConfig + the shared pure translator.
// "Integration" is configuration, not code.

import type { CasinoEventDraft } from '../eventPlatform/index.ts';

/** Supported connector source categories (declarative profiles). */
export const CONNECTOR_TYPES = [
  'loyalty',            // player loyalty / CRM systems
  'slot-management',    // slot machine management systems
  'table-management',   // table game management systems
  'casino-management',  // casino management systems (CMS)
  'cash-desk',          // cash desk / cage systems
  'rg-system',          // existing responsible-gambling systems
  'generic-api',        // third-party APIs
  'batch-file',         // batch/file imports (CSV/JSON rows)
] as const;
export type ConnectorType = (typeof CONNECTOR_TYPES)[number];

/** One external record — a plain object from the source system. */
export type ExternalRecord = Record<string, unknown>;

/**
 * Declarative mapping from an external record to a CasinoEventDraft.
 * No behaviour — field names, an event-type map, and normalisation hints.
 */
export interface MappingConfig {
  connectorType: ConnectorType;
  /** Human label, e.g. 'Bally CMS – Sandton'. */
  name: string;

  /** Which external fields carry which identifiers / core values. */
  fields: {
    /** External field holding the raw player reference → casinoPlayerRef. */
    playerRef?: string;
    /** External field holding an already-resolved SB-PLR id (rare). */
    safeBetPlayerId?: string;
    sessionId?: string;
    /** Machine id field; tables map into the same machine-id space. */
    machineId?: string;
    tableId?: string;
    /** External timestamp field (ISO-8601, epoch seconds, or epoch millis). */
    occurredAt: string;
    /** External field holding the source event code (mapped via eventTypeMap). */
    eventType?: string;
  };

  /** External event code → SafeBet event vocabulary. */
  eventTypeMap?: Record<string, string>;
  /** Event type when the feed implies a single type (e.g. a bet feed). */
  defaultEventType?: string;

  /** External field → payload key (e.g. { amount: 'bet_amount' }). */
  payload?: Record<string, string>;
  /** External field → payload.metadata key (e.g. machine_type, casino_floor_location). */
  metadata?: Record<string, string>;

  /** Naive local timestamps: fixed UTC offset in minutes (e.g. +120 for SAST). */
  offsetMinutes?: number;
  /** Prefix to normalise bare machine/table numbers (e.g. 'M-'). */
  machinePrefix?: string;
  /** External field holding a stable per-event id → idempotencyKey. */
  idempotencyKeyField?: string;
}

/** Severity of a data-quality diagnostic. */
export type DiagnosticSeverity = 'error' | 'warning' | 'info';

/** An actionable diagnostic for a casino administrator. */
export interface DataQualityDiagnostic {
  severity: DiagnosticSeverity;
  code:
    | 'MISSING_IDENTITY' | 'MISSING_TIMESTAMP' | 'TIMESTAMP_ANOMALY'
    | 'UNMAPPED_EVENT_TYPE' | 'MISSING_EVENT_TYPE' | 'UNKNOWN_MACHINE'
    | 'INVALID_MAPPING' | 'EMPTY_RECORD';
  field?: string;
  message: string;
  /** What the administrator should do about it. */
  hint: string;
}

/** Result of translating ONE external record. */
export interface TranslationResult {
  draft: CasinoEventDraft | null;             // null when a fatal diagnostic blocks it
  diagnostics: DataQualityDiagnostic[];
}

/** Optional context a connector may consult during translation (read-only). */
export interface ConnectorContext {
  /** Known machine ids for UNKNOWN_MACHINE diagnostics (optional). */
  knownMachineIds?: ReadonlySet<string>;
}

/** Summary of one connector run (operational telemetry — not runtime state). */
export interface ConnectorRunSummary {
  connectorType: ConnectorType;
  connectorName: string;
  casinoId: string;
  received: number;
  translated: number;      // drafts produced
  rejected: number;        // records blocked by fatal data-quality diagnostics
  submitted: number;       // drafts accepted by the Event Platform
  failed: number;          // drafts rejected by Event Platform validation
  diagnostics: DataQualityDiagnostic[];
  startedAt: string;
  finishedAt: string;
}
