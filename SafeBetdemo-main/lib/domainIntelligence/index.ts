// Enterprise Domain Intelligence Platform — public API (Phase 3.5).
//
// ONE platform, attached to THE Digital Twin via
// getIntelligencePlatform().attach(twin). Consumers (Realtime, dashboards,
// reports, regulator views, the future Rules Engine) read the enriched
// runtime objects with intelligenceOf(object) — nobody calls pipelines
// directly, nobody gets a second object.

export {
  INTELLIGENCE_ENGINE_ID, INTELLIGENCE_STAGES,
  type IntelligencePipeline, type IntelligenceStageId,
  type StageOutput, type StageOutputs,
} from './contracts.ts';
export {
  DomainIntelligencePlatform, getIntelligencePlatform, intelligenceOf,
} from './platform.ts';
