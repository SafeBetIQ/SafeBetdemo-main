// ─── SafeBet Guardian — Geo observation worker logic (ARCH-V4-C5) ─────────────
// Pure, idempotent. Synthetic fixtures only; NO real user location, NO ISP subscriber
// lookup, NO bank geography, NO device tracking, NO enforcement.
//
// PRIVACY GATE: a message carrying any PERSON-LEVEL location field is REJECTED as a
// poison message (schema/validation rejection) — Guardian Geo Intelligence never
// ingests individual/consumer location data.

import type { RegistrySnapshot } from '../registry/types.ts';
import { SYNTHETIC_REGISTRY } from '../registry/snapshot.ts';
import { SYNTHETIC_GEO_FIXTURES } from './fixtures.ts';
import { analyseGeo } from './intelligence.ts';
import type { GeoIntelligenceResult } from './types.ts';

export interface GeoObservationMessage {
  product: 'GUARDIAN';
  schemaVersion: string;
  eventType: 'guardian.geo.observe';
  jurisdiction: string;
  correlationId: string;
  idempotencyKey: string;
  occurredAt: string;
  fixtureGeoReference: string;        // reference to a SYNTHETIC fixture — never real location data
}

/** Person-level fields that must NEVER appear in a Geo message. Presence → rejection. */
export const PROHIBITED_PERSON_FIELDS = [
  'player_id', 'playerId', 'customer_id', 'customerId', 'subscriber_id', 'subscriberId',
  'device_ad_id', 'deviceAdId', 'advertising_id', 'mobile_number', 'mobileNumber', 'msisdn',
  'bank_customer_id', 'cardholder', 'ip_address', 'ipAddress', 'ip_history', 'browsing_history',
  'browsingHistory', 'precise_location', 'preciseLocation', 'person_location', 'personLocation',
  'lat', 'lng', 'latitude', 'longitude', 'geo_coordinates', 'wifi_probe',
] as const;

export class GeoPoisonMessageError extends Error {
  constructor(message: string) { super(message); this.name = 'GeoPoisonMessageError'; }
}
export class GeoPersonDataRejectedError extends GeoPoisonMessageError {
  constructor(field: string) { super(`person-level location field rejected: ${field}`); this.name = 'GeoPersonDataRejectedError'; }
}

export interface GeoWorkerOutput { ok: boolean; duplicate: boolean; idempotencyKey: string; result: GeoIntelligenceResult | null }

/** Reject any message object that contains a prohibited person-level field (deep, one level). */
export function assertNoPersonData(msg: Record<string, unknown>): void {
  const keys = new Set(Object.keys(msg ?? {}).map((k) => k.toLowerCase()));
  for (const f of PROHIBITED_PERSON_FIELDS) {
    if (keys.has(f.toLowerCase())) throw new GeoPersonDataRejectedError(f);
  }
}

export class GuardianGeoWorker {
  private readonly seen = new Map<string, GeoWorkerOutput>();
  private readonly registry: RegistrySnapshot;
  constructor(registry: RegistrySnapshot = SYNTHETIC_REGISTRY) { this.registry = registry; }

  process(msg: GeoObservationMessage): GeoWorkerOutput {
    if (msg?.product !== 'GUARDIAN' || msg?.eventType !== 'guardian.geo.observe') throw new GeoPoisonMessageError('not a Guardian geo-observation message');
    assertNoPersonData(msg as unknown as Record<string, unknown>); // PRIVACY GATE (scenario 14)
    if (!msg.idempotencyKey || !msg.jurisdiction) throw new GeoPoisonMessageError('missing idempotencyKey/jurisdiction');
    const fx = SYNTHETIC_GEO_FIXTURES[msg.fixtureGeoReference];
    if (!fx) throw new GeoPoisonMessageError(`unknown synthetic geo fixture: ${msg.fixtureGeoReference}`);
    if (fx.jurisdiction !== msg.jurisdiction) throw new GeoPoisonMessageError('fixture jurisdiction mismatch');

    const prior = this.seen.get(msg.idempotencyKey);
    if (prior) return { ...prior, duplicate: true };
    const result = analyseGeo(this.registry, fx, { observationId: `GOBS-${msg.idempotencyKey}` });
    const out: GeoWorkerOutput = { ok: true, duplicate: false, idempotencyKey: msg.idempotencyKey, result };
    this.seen.set(msg.idempotencyKey, out);
    return out;
  }

  processedCount(): number { return this.seen.size; }
}

export const GUARDIAN_GEO_QUEUE = 'guardian-geo-observation' as const;
export const GUARDIAN_GEO_DLQ = 'guardian-geo-observation-dlq' as const;
