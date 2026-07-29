// ─── Digital Twin extension points for Shared Domain Engines (Phase 3.4) ─────
//
// Phase 3.5 engines (Risk, Behaviour, Machine, Session, AI Decision,
// Intervention, Compliance) plug in HERE. An engine registers once and is
// invoked whenever a runtime object is created or refreshed; whatever it
// returns is stored under its engineId inside that object's `enrichments`
// slot. The engine enriches the SAME instance every other consumer holds —
// it can never create a replacement object, own state, or fork the flow.
//
// NO engine is implemented in this phase. This file is deliberately only
// the contract.

import type { TwinObject, TwinRegistry } from './registry.ts';

/**
 * Read-only view of the twin handed to engines: the SAME runtime objects
 * every other consumer holds. Engines read it; they never write through it.
 */
export interface EnrichmentContext {
  readonly registry: TwinRegistry;
}

export interface TwinEnrichmentEngine {
  /** Stable engine identifier, e.g. 'domain-intelligence'. Keys the enrichment slot. */
  readonly engineId: string;
  /**
   * Observe one just-created/just-refreshed runtime object and return the
   * enrichment to attach (or undefined to leave the slot untouched).
   * MUST be pure with respect to the twin: read the object (and, via the
   * context, sibling objects), return data.
   */
  enrich(object: TwinObject, context: EnrichmentContext): Record<string, unknown> | undefined;
}

export class ExtensionHost {
  private engines = new Map<string, TwinEnrichmentEngine>();
  private readonly context: () => EnrichmentContext;

  constructor(context: () => EnrichmentContext) {
    this.context = context;
  }

  register(engine: TwinEnrichmentEngine): void {
    if (this.engines.has(engine.engineId)) {
      throw new Error(`engine '${engine.engineId}' is already registered — there is ONE instance of every engine`);
    }
    this.engines.set(engine.engineId, engine);
  }

  unregister(engineId: string): void {
    this.engines.delete(engineId);
  }

  get registeredEngineIds(): string[] {
    return Array.from(this.engines.keys());
  }

  /** Run every registered engine against an updated runtime object. */
  apply(object: TwinObject): void {
    const context = this.context();
    this.engines.forEach(engine => {
      const enrichment = engine.enrich(object, context);
      if (enrichment !== undefined) {
        (object.enrichments as Record<string, unknown>)[engine.engineId] = Object.freeze({ ...enrichment });
      }
    });
  }

  dispose(): void {
    this.engines.clear();
  }
}

/** Read an engine's enrichment off any twin object. */
export function getEnrichment<T extends Record<string, unknown>>(
  object: TwinObject,
  engineId: string,
): Readonly<T> | undefined {
  return object.enrichments[engineId] as Readonly<T> | undefined;
}
