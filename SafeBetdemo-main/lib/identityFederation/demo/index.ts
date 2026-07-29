// ─── National Demonstration Dataset v2.0 — public API (ADR-006 · 3.7) ────────
//
// Deterministic, fully synthetic, regulator-ready demonstration data that drives
// the REAL Version 2.0 pipeline. In-memory demo infrastructure only — imports no
// operator/application/Supabase runtime; production is never touched.

export {
  generateNationalDemonstrationDataset, resetAndReseedDemonstrationDataset,
  DATASET_VERSION, SEED_VERSION, DEMO_JURISDICTION, DEMO_CLOCK, DEMO_OPERATORS, DEMO_REGULATOR,
  type GenerateOptions, type NationalDemonstrationDataset, type NationalMetrics,
  type OperatorProfile, type OperatorMetric, type SbNatSummary, type ScenarioResult,
  type ReconciliationReport, type ReconciliationCheck,
} from './dataset.ts';
