// ─── Synthetic Operator Contribution Harness (Milestone 4.3) ─────────────────
//
// A CONTROLLED, TEST/SANDBOX-ONLY harness that simulates operators submitting
// hash-only federation contributions THROUGH the actual Event Platform boundary,
// using the real Phase 4.2 cryptographic provider. It is NOT a live connector,
// performs NO external writes, and refuses to run unless explicitly enabled.

import type { JurisdictionCode, AttributeType } from '../types.ts';
import { type FederationCryptoProvider } from '../crypto/index.ts';
import { InMemorySbPlrDirectory } from './identity.ts';
import { type FederationEventPlatform, type ContributionServiceContext, type SubmitResult } from './eventPlatform.ts';
import { FEDERATION_CONTRIBUTION_EVENT_TYPE, EVENT_SCHEMA_VERSION } from './model.ts';

export interface SyntheticContributionOptions {
  eventId?: string;
  sourceSequence?: number;
  expiryAt?: string | null;
  pepperVersion?: string;               // explicit version (dual-version transition tests)
  sourceSystemRef?: string;
}

export interface HarnessOptions {
  platform: FederationEventPlatform;
  crypto: FederationCryptoProvider;
  directory: InMemorySbPlrDirectory;
  enabled: boolean;                     // MUST be true (test/sandbox only)
  now?: () => string;
}

export class SyntheticOperatorHarness {
  private readonly platform: FederationEventPlatform;
  private readonly crypto: FederationCryptoProvider;
  private readonly directory: InMemorySbPlrDirectory;
  private readonly now: () => string;
  private counter = 0;

  constructor(opts: HarnessOptions) {
    if (!opts.enabled) throw new Error('SyntheticOperatorHarness is disabled outside test/sandbox mode');
    this.platform = opts.platform; this.crypto = opts.crypto; this.directory = opts.directory;
    this.now = opts.now ?? (() => new Date().toISOString());
  }

  /** Register a synthetic, Identity-Resolution-active SB-PLR (federation never creates SB-PLR). */
  registerPlayer(sbPlr: string, tenantId: string, operatorId: string, jurisdiction: JurisdictionCode): void {
    this.directory.register({ sbPlr, tenantId, operatorId, jurisdiction, status: 'active' });
  }

  /** Produce a hash-only contribution via the 4.2 provider and submit it through the Event Platform. */
  contribute(operatorId: string, tenantId: string, jurisdiction: JurisdictionCode, sbPlr: string, attributeType: AttributeType, syntheticValue: string, opts: SyntheticContributionOptions = {}): SubmitResult {
    const h = opts.pepperVersion
      ? this.crypto.hashAttributeVersion(jurisdiction, attributeType, syntheticValue, opts.pepperVersion)
      : this.crypto.hashAttribute(jurisdiction, attributeType, syntheticValue);
    const eventId = opts.eventId ?? `evt-${++this.counter}`;
    const event = {
      eventId, eventType: FEDERATION_CONTRIBUTION_EVENT_TYPE, eventSchemaVersion: EVENT_SCHEMA_VERSION,
      eventTimestamp: this.now(), sourceOperatorId: operatorId, tenantId, jurisdiction, sbPlr, attributeType,
      digest: h.hash, hmacAlgorithm: h.stamp.algorithm, pepperVersion: h.pepperKeyVersion,
      normalisationVersion: h.stamp.normalisationVersion, canonicalFormatVersion: h.stamp.canonicalFormatVersion,
      contributionSchemaVersion: h.stamp.contributionSchemaVersion, sourceSystemRef: opts.sourceSystemRef ?? `src:${operatorId}:${eventId}`,
      sourceSequence: opts.sourceSequence, idempotencyKey: `idem:${tenantId}:${sbPlr}:${attributeType}:${h.pepperKeyVersion}`,
      traceId: `trace:${eventId}`, expiryAt: opts.expiryAt ?? null,
    };
    const ctx: ContributionServiceContext = { plane: 'contribution-service', operatorId, tenantId, jurisdiction };
    return this.platform.submit(ctx, event);
  }

  /** Submit an arbitrary raw event (adversarial / malformed-payload tests). */
  submitRaw(ctx: ContributionServiceContext, event: Record<string, unknown>): SubmitResult {
    return this.platform.submit(ctx, event);
  }
}
