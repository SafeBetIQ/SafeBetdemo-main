// ─── Enterprise Domain Intelligence Platform — contracts (Phase 3.5) ─────────
//
// ONE platform, multiple intelligence pipelines. A pipeline is a PURE
// analysis stage: (runtime object, context, earlier stages' output) → its
// own output. Pipelines own analysis, inference, classification, scoring
// and recommendations — NOTHING else. They hold no state, persist nothing,
// emit no events, and never see a mutable surface: they read the SAME twin
// objects everyone else holds and return data.
//
// Stage order is a fixed dependency chain (session → machine → behaviour →
// risk → ai → intervention → compliance); each stage may read every earlier
// stage's output for the same object via `stages`.

import type { EnrichmentContext, TwinObject } from '../digitalTwin/index.ts';

export const INTELLIGENCE_ENGINE_ID = 'domain-intelligence';

/** The fixed pipeline order — later stages consume earlier ones. */
export const INTELLIGENCE_STAGES = [
  'session',
  'machine',
  'behaviour',
  'risk',
  'ai',
  'intervention',
  'compliance',
] as const;

export type IntelligenceStageId = (typeof INTELLIGENCE_STAGES)[number];

/** Output of one stage for one object. */
export type StageOutput = Record<string, unknown>;

/** Everything earlier stages produced for the SAME object in this pass. */
export type StageOutputs = Partial<Record<IntelligenceStageId, StageOutput>>;

export interface IntelligencePipeline {
  readonly stageId: IntelligenceStageId;
  /** Stages whose output this one consumes (order-validated at attach). */
  readonly consumes: IntelligenceStageId[];
  /**
   * Analyse one runtime object. Return this stage's output, or undefined
   * when the stage has nothing to say about this kind of object.
   */
  analyse(object: TwinObject, ctx: EnrichmentContext, stages: StageOutputs): StageOutput | undefined;
}

// ─── Shared analysis arithmetic ───────────────────────────────────────────────

export function minutesSince(iso: string | null, now: number): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.round(((now - t) / 60_000) * 10) / 10);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
