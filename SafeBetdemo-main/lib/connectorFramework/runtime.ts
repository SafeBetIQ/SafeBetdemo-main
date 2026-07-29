// ─── Connector Runtime (v1.1) ────────────────────────────────────────────────
//
// Submits translated drafts through the ONE Enterprise Event Platform — the
// SAME certified ingestion path every producer uses. The runtime owns NO
// business logic and NO runtime state; it translates, forwards, and reports.
// Identity Resolution, validation, idempotency, projection, twin, intelligence
// and policy are all unchanged and downstream of this call.

import { getEventPlatform, EventValidationError, type EventStoreClient } from '../eventPlatform/index.ts';
import type { RpcClient } from '../playerIdentity/index.ts';
import { translateBatch } from './translate.ts';
import type {
  ConnectorContext, ConnectorRunSummary, ExternalRecord, MappingConfig,
} from './types.ts';

export interface ConnectorIngestOptions {
  config: MappingConfig;
  casinoId: string;
  jurisdiction?: string;
  tenantId?: string;
  /** Service-role client for the certified ingestion path. */
  client: EventStoreClient & RpcClient;
  ctx?: ConnectorContext;
}

/**
 * Ingest external records through a connector.
 * Pipeline: translate (adapter) → Enterprise Event Platform.ingestBatch.
 * The whole batch is attempted first; on a validation failure it falls back
 * to per-draft submission so ONE malformed record never rejects the batch.
 */
export async function runConnector(
  records: ExternalRecord[],
  opts: ConnectorIngestOptions,
): Promise<ConnectorRunSummary> {
  const startedAt = new Date().toISOString();
  const { config, casinoId, jurisdiction, tenantId, client, ctx } = opts;
  const producer = `connector:${config.connectorType}`;

  const { drafts, diagnostics, rejected } = translateBatch(records, config, ctx ?? {});

  let submitted = 0;
  let failed = 0;
  const ingestCtx = { casinoId, jurisdiction, tenantId, producer, client };

  if (drafts.length > 0) {
    try {
      await getEventPlatform().ingestBatch(drafts, ingestCtx);
      submitted = drafts.length;
    } catch (err) {
      if (!(err instanceof EventValidationError)) throw err;
      // Isolate the offender(s): submit each draft on its own.
      for (const draft of drafts) {
        try {
          await getEventPlatform().ingest(draft, ingestCtx);
          submitted += 1;
        } catch (e) {
          failed += 1;
          diagnostics.push({
            severity: 'error', code: 'INVALID_MAPPING',
            message: `Event Platform rejected a translated event: ${e instanceof Error ? e.message : String(e)}`,
            hint: 'review the mapping for this record type against API_REFERENCE §4.2',
          });
        }
      }
    }
  }

  return {
    connectorType: config.connectorType,
    connectorName: config.name,
    casinoId,
    received: records.length,
    translated: drafts.length,
    rejected,
    submitted,
    failed,
    diagnostics,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
}
