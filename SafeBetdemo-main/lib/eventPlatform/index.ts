// Enterprise Event Platform — public API (Phase 3.2).
//
// Producers import ONLY from here and call getEventPlatform().ingest /
// ingestBatch. Everything else — validation, enrichment, persistence,
// distribution — is the platform's internal lifecycle.

export {
  ENVELOPE_SCHEMA_VERSION,
  EVENT_TYPES,
  EVENT_TYPE_SET,
  type CasinoEventType,
  type CasinoEventEnvelope,
  type CasinoEventDraft,
} from './envelope.ts';
export { EventValidationError } from './validation.ts';
export type { EventStoreClient } from './persistence.ts';
export { EventPlatform, getEventPlatform, type IngestContext } from './platform.ts';
