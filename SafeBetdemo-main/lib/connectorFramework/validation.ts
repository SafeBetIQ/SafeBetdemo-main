// ─── Connector mapping validation (v1.1) ─────────────────────────────────────
//
// Validates a MappingConfig before it is used — catching mis-configuration at
// onboarding rather than at runtime. Reject-never-repair, matching the
// enterprise validation ethos. Pure; no I/O.

import { EVENT_TYPE_SET } from '../eventPlatform/index.ts';
import { CONNECTOR_TYPES, type MappingConfig } from './types.ts';

export class ConnectorConfigError extends Error {
  readonly violations: string[];
  constructor(violations: string[]) {
    super(`connector configuration invalid: ${violations.join('; ')}`);
    this.name = 'ConnectorConfigError';
    this.violations = violations;
  }
}

/** Validate a mapping config. Throws ConnectorConfigError on any violation. */
export function validateMappingConfig(config: unknown): MappingConfig {
  const v: string[] = [];
  if (!config || typeof config !== 'object') throw new ConnectorConfigError(['config must be an object']);
  const c = config as Partial<MappingConfig>;

  if (!c.connectorType || (CONNECTOR_TYPES as readonly string[]).indexOf(c.connectorType) === -1) {
    v.push(`connectorType '${String(c.connectorType)}' is not a supported connector type`);
  }
  if (typeof c.name !== 'string' || c.name.length === 0) v.push('name is required');
  if (!c.fields || typeof c.fields !== 'object') {
    v.push('fields mapping is required');
  } else {
    if (typeof c.fields.occurredAt !== 'string' || c.fields.occurredAt.length === 0) {
      v.push('fields.occurredAt is required (the external timestamp field)');
    }
    if (!c.fields.playerRef && !c.fields.safeBetPlayerId) {
      v.push('fields.playerRef or fields.safeBetPlayerId is required (identity source)');
    }
    if (!c.fields.eventType && !c.defaultEventType) {
      v.push('fields.eventType or defaultEventType is required (event classification)');
    }
  }
  // Every target in eventTypeMap must be a valid SafeBet event type.
  for (const [src, target] of Object.entries(c.eventTypeMap ?? {})) {
    if (!EVENT_TYPE_SET.has(target)) {
      v.push(`eventTypeMap['${src}'] → '${target}' is not a SafeBet event type`);
    }
  }
  if (c.defaultEventType && !EVENT_TYPE_SET.has(c.defaultEventType)) {
    v.push(`defaultEventType '${c.defaultEventType}' is not a SafeBet event type`);
  }
  if (c.offsetMinutes !== undefined && (typeof c.offsetMinutes !== 'number' || Math.abs(c.offsetMinutes) > 14 * 60)) {
    v.push('offsetMinutes must be a number within ±840 (±14h)');
  }

  if (v.length > 0) throw new ConnectorConfigError(v);
  return config as MappingConfig;
}
