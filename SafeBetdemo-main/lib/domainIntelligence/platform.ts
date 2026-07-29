// ─── Enterprise Domain Intelligence Platform (Phase 3.5) ─────────────────────
//
// THE enterprise intelligence layer. ONE platform — registered with the
// Digital Twin as ONE enrichment engine — containing the seven intelligence
// pipelines in a fixed dependency chain:
//
//   session → machine → behaviour → risk → ai → intervention → compliance
//
// Every pass analyses ONE runtime object (the SAME instance every consumer
// holds), each stage reading earlier stages' output for that object, and
// the combined result is stored under enrichments['domain-intelligence'].
// The platform owns analysis, inference, classification, scoring and
// recommendations — and NOTHING else: no events, no projections, no runtime
// state, no persistence, no distribution, no presentation. It consumes the
// Digital Twin, enriches the Digital Twin, and returns control to the flow.
//
// Future Rules Engine: consumes intelligenceOf(object) — it plugs in AFTER
// this platform as another reader of the same enriched twin, never a
// replacement.

import {
  getEnrichment,
  type CasinoDigitalTwin, type EnrichmentContext,
  type TwinEnrichmentEngine, type TwinObject,
} from '../digitalTwin/index.ts';
import {
  INTELLIGENCE_ENGINE_ID, INTELLIGENCE_STAGES,
  type IntelligencePipeline, type IntelligenceStageId, type StageOutputs,
} from './contracts.ts';
import { sessionIntelligence } from './pipelines/session.ts';
import { machineIntelligence } from './pipelines/machine.ts';
import { behaviourIntelligence } from './pipelines/behaviour.ts';
import { riskIntelligence } from './pipelines/risk.ts';
import { aiIntelligence } from './pipelines/ai.ts';
import { interventionIntelligence } from './pipelines/intervention.ts';
import { complianceIntelligence } from './pipelines/compliance.ts';

export class DomainIntelligencePlatform implements TwinEnrichmentEngine {
  readonly engineId = INTELLIGENCE_ENGINE_ID;
  private readonly pipelines: IntelligencePipeline[];

  constructor(now: () => number = Date.now) {
    this.pipelines = [
      sessionIntelligence(now),
      machineIntelligence(now),
      behaviourIntelligence(now),
      riskIntelligence(),
      aiIntelligence(),
      interventionIntelligence(),
      complianceIntelligence(),
    ];
    this.validateChain();
  }

  /** Every pipeline may only consume stages that run BEFORE it. */
  private validateChain(): void {
    const seen = new Set<IntelligenceStageId>();
    this.pipelines.forEach((pipeline, i) => {
      if (pipeline.stageId !== INTELLIGENCE_STAGES[i]) {
        throw new Error(`intelligence chain order violated: expected '${INTELLIGENCE_STAGES[i]}', got '${pipeline.stageId}'`);
      }
      pipeline.consumes.forEach(dep => {
        if (!seen.has(dep)) {
          throw new Error(`intelligence stage '${pipeline.stageId}' consumes '${dep}' which has not run yet`);
        }
      });
      seen.add(pipeline.stageId);
    });
  }

  get stageIds(): IntelligenceStageId[] {
    return this.pipelines.map(p => p.stageId);
  }

  /**
   * TwinEnrichmentEngine entry: run the pipeline chain over ONE runtime
   * object. Pure analysis — the returned record is attached by the twin's
   * extension host to the SAME instance.
   */
  enrich(object: TwinObject, context: EnrichmentContext): Record<string, unknown> | undefined {
    const stages: StageOutputs = {};
    let produced = false;
    this.pipelines.forEach(pipeline => {
      const output = pipeline.analyse(object, context, stages);
      if (output !== undefined) {
        stages[pipeline.stageId] = output;
        produced = true;
      }
    });
    if (!produced) return undefined;
    return { ...stages, analysedAt: new Date().toISOString() };
  }

  /**
   * Join the enterprise flow: register as the twin's ONE intelligence
   * engine and enrich the current model immediately. Returns a detach.
   */
  attach(twin: CasinoDigitalTwin): () => void {
    twin.registerEngine(this);
    twin.reenrich();
    return () => twin.unregisterEngine(this.engineId);
  }
}

/** Read the intelligence enrichment off any runtime object. */
export function intelligenceOf(object: TwinObject): StageOutputs | undefined {
  return getEnrichment(object, INTELLIGENCE_ENGINE_ID) as StageOutputs | undefined;
}

let defaultPlatform: DomainIntelligencePlatform | undefined;

/** THE application-wide Enterprise Domain Intelligence Platform. */
export function getIntelligencePlatform(): DomainIntelligencePlatform {
  if (!defaultPlatform) defaultPlatform = new DomainIntelligencePlatform();
  return defaultPlatform;
}
