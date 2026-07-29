// Enterprise Casino Integration — Connector Framework public API (v1.1).
//
// Connectors are adapters that translate external casino data into the
// certified CasinoEventDraft contract and submit it through the ONE
// Enterprise Event Platform. Integration is configuration, not code.

export {
  CONNECTOR_TYPES,
  type ConnectorType, type ExternalRecord, type MappingConfig,
  type DataQualityDiagnostic, type DiagnosticSeverity,
  type TranslationResult, type ConnectorContext, type ConnectorRunSummary,
} from './types.ts';
export { translateRecord, translateBatch, normalizeTimestamp } from './translate.ts';
export { runConnector, type ConnectorIngestOptions } from './runtime.ts';
export { validateMappingConfig, ConnectorConfigError } from './validation.ts';
export { BUILT_IN_PROFILES } from './connectors.ts';
