# Phase 3.6 — Enterprise Policy & Rules Platform

**Status: COMPLETE & DEPLOYED** (2026-07-10, SafeBet Demo project `uexdjngogzunjxkpxwll`; production never touched)

ONE Enterprise Policy & Rules Platform is now the enterprise decision layer. It consumes the fully enriched Digital Twin, evaluates configuration-driven policies from any jurisdiction/operator/tenant through ONE evaluator, and returns decisions with provenance. It never calculates, never enriches, never owns runtime state, never performs AI/behaviour/risk analysis, and never executes — execution belongs to Enterprise Consumers (Phase 3.7).

---

## 1. Architecture

```
Casino Event
    ↓
Identity Resolution → Policy → Provider                    (3.1/A/B)
    ↓
ENTERPRISE EVENT PLATFORM          lib/eventPlatform        (3.2)
    ↓
ENTERPRISE PROJECTION PLATFORM     lib/projectionPlatform   (3.3, v2)
    ↓
ENTERPRISE CASINO DIGITAL TWIN     lib/digitalTwin          (3.4)
    ↓
ENTERPRISE DOMAIN INTELLIGENCE     lib/domainIntelligence   (3.5)
    ↓  the enriched twin (read-only)
ENTERPRISE POLICY & RULES          lib/policyPlatform       (3.6 — THIS)
    select applicable rules → evaluate conditions → DECISIONS
    ↓
Decision → Realtime → Dashboards → Reports → Operators → Regulators
```

| Layer | Owns |
|---|---|
| Event Platform | immutable events |
| Projection Platform | persisted runtime projections |
| Digital Twin | live runtime model |
| Domain Intelligence | intelligence (analysis/inference/classification/scoring) |
| **Policy & Rules** | **decisions only** |

## 2. Policy evaluation lifecycle

```
evaluate(twin, { jurisdiction })
  1. SELECT   enabled rules ∧ jurisdiction match ∧ operator (casinoId) match
  2. ITERATE  every runtime subject: players, sessions, machines, floors, casino
  3. VIEW     transient read-only facts: twin fields + intelligence stages
              (never returned, never stored — NOT a second runtime object)
  4. COMPARE  declarative conditions (eq/gt/gte/…/in/contains/exists, all/any/not)
              — comparisons only; a missing fact is FALSE, never invented
  5. DECIDE   emit PolicyDecision (advice + provenance), priority-ordered
```

The twin is untouched (test-asserted: enrichments byte-identical before/after). Evaluation is deterministic and pure.

## 3. Policy dependency graph

Policies depend on the flow **upstream** of them, never on each other:

```
twin facts (projected event facts) ──────────────┐
intelligence.session / machine ────────────────┐ │
intelligence.behaviour → risk → ai → intervention → compliance
                                                │ │
                              conditions read ◄─┴─┘   (policies NEVER recalculate;
                                                       absent intelligence ⇒ the rule
                                                       is silent, never re-derived)
```

## 4. Policy configuration model

A `PolicyRule` is plain JSON-serializable data — **policy change is a data change**:

```jsonc
{
  "policyId": "ZA-RG-001",
  "scope": "jurisdiction",           // jurisdiction | operator | responsible-gambling | compliance | platform
  "jurisdiction": "ZA",              // optional selector
  "casinoId": null,                  // optional operator selector
  "appliesTo": "player",             // player | session | machine | floor | casino
  "when": { "path": "intelligence.risk.dynamicRiskScore", "op": "gte", "value": 80 },
  "action": "INTERVENTION_REQUIRED", // one of 7 decision actions
  "priority": "critical",
  "reason": "…", "policyReference": "ZA National Gambling Act 7 of 2004, s.16",
  "executionRequired": true,
  "confidenceFrom": "intelligence.risk.riskConfidence",  // READ, never computed
  "enabled": true
}
```

Rules are validated on load (reject-never-repair, matching the Event Platform ethos). `PolicyRulesPlatform.configure(rules)` replaces the active set at runtime from ANY source — shipped packs, database, regulator feed, tenant settings. Shipped packs (pure data): RG baseline (5), Compliance (3), Operator (4), Platform (2, incl. AI-recommendation control + an `enabled:false` example), Jurisdictions (ZA 4, BW 2, KE 2) = 22 rules.

## 5. Jurisdiction model

- Selection by `EvaluationContext.jurisdiction` at evaluation time; jurisdiction rules apply only when codes match; platform/RG/compliance/operator baselines apply everywhere (jurisdictions tighten the floor, never weaken it)
- **Live packs:** ZA (National Gambling Board — intervention threshold 80, 120-min continuous play, critical-cohort NGB notification, intervention-effectiveness review), BW (Gambling Authority — stricter threshold 75, notification at 3 critical), KE (BCLB — escalation monitoring, high-risk notification)
- **Registered extension points (deliverable 17):** NA (Gambling Board of Namibia), NG (NLRC / state gaming boards), GH (Gaming Commission of Ghana), MU (Gambling Regulatory Authority Mauritius) — each goes live by supplying a `PolicyRule[]`; the evaluator, twin, and intelligence layers need **zero changes**. Test-verified that an unpacked jurisdiction still receives all baselines.

## 6. Casino operator model

Operator rules use `scope: 'operator'`; without `casinoId` they are operator defaults (VIP handling OP-004, hot machines OP-001, idle-machine review OP-002, floor capacity OP-003); with `casinoId` they bind to one operator — test-verified that a foreign operator's rules never fire.

## 7. Decision model

`PolicyDecision`: `decisionId`, `policyId`, `scope`, `jurisdiction`, `subject {kind,id,casinoId}`, `action` (INTERVENTION_REQUIRED · MONITORING_REQUIRED · REGULATOR_NOTIFICATION_REQUIRED · MACHINE_REVIEW_REQUIRED · COMPLIANCE_REVIEW_REQUIRED · RESPONSIBLE_GAMBLING_ACTION_REQUIRED · OPERATIONAL_RECOMMENDATION), `priority`, `reason`, `policyReference`, `confidence` (read from intelligence via `confidenceFrom`), `executionRequired`, `evaluatedAt`. Returned as a `DecisionSet` (casino, jurisdiction, counts, priority-ordered decisions). **The clean decision interface for Phase 3.7**: `getPolicyPlatform().evaluate(twin, { jurisdiction })`.

## 8. Files created

- `lib/policyPlatform/conditions.ts` — declarative condition language + evaluator + validation
- `lib/policyPlatform/model.ts` — rule/decision/scope/action model + rule validation
- `lib/policyPlatform/facts.ts` — transient read-only fact views (twin fields + intelligence)
- `lib/policyPlatform/evaluation.ts` — the evaluation lifecycle
- `lib/policyPlatform/config/{responsibleGambling,jurisdictions,operator,compliance,platformPolicies,index}.ts` — shipped configuration packs (pure data)
- `lib/policyPlatform/platform.ts` — THE platform (`configure`, `evaluate`, singleton)
- `lib/policyPlatform/index.ts` — public API
- `tests/policyPlatform.test.mjs` — 13 tests

## 9. Files modified

- `supabase/functions/digital-twin/index.ts` — `action=decisions[&jurisdiction=…]` exposing the decision interface

Nothing else. **No database changes** — the platform persists nothing; configuration is injected data.

## 10–11. Tests executed / passed

`node --test tests/*.test.mjs` → **101 tests, 101 pass, 0 fail** (88 pre-existing across all platforms — zero regressions — plus 13 new). New coverage: condition ops/nesting/missing-fact semantics, reject-never-repair validation, ONE-platform singleton, **configuration change without code change**, exact ZA decision set with priority ordering, provenance completeness + confidence read from intelligence, jurisdiction pack selection (ZA/BW/KE/NA-baseline-only), operator casino scoping, twin untouched by evaluation, **no recalculation when intelligence is absent**, no execution/persistence/analysis surface, determinism, registered extension points.

## 12. Performance considerations

- Evaluation is pure in-memory comparison: O(subjects × applicable rules); demo scale (79 subjects × 17 ZA rules) evaluates in one edge invocation with no I/O
- Rule selection filters once per pass; fact views are shallow spreads created per subject and discarded
- No caching needed at current scale; a per-object memo keyed by `lastEventAt` is the natural optimization if rule sets grow to hundreds

## 13–14. Updated diagrams

Enterprise flow: §1. Policy architecture (lifecycle + dependency graph): §2–3.

## 15. Evidence: ONE continuous enterprise platform

- `lib/policyPlatform` imports only `lib/digitalTwin` + `lib/domainIntelligence` public APIs; zero references to `casino_event_log`, projections, supabase, or any store; zero writes anywhere
- One evaluator for all scopes — no jurisdiction forks, no per-operator engines, no second rules engine (the Identity Policy layer from 3.1B remains the identity decision point; this platform deliberately does not duplicate it)
- The flow remains: Event → Projection → Twin → Intelligence → **Policy → Decision** → consumers; nothing re-enters, nothing forks

## 16. Evidence: decisions without duplicating state or intelligence (live, demo project)

- `digital-twin?action=decisions&jurisdiction=ZA` → `policiesEvaluated: 17, subjectsEvaluated: 79, decisions: 43` across 4 action types (22 RG actions incl. session-duration breaks, 12 compliance reviews, 2 monitoring, 7 operational), each with policy reference and confidence
- Same casino under `jurisdiction=BW` → 33 decisions, **zero ZA rules fired**, baselines identical — jurisdiction switching is pure configuration selection over the same twin and the same intelligence
- Test-asserted: evaluation leaves enrichments byte-identical; with intelligence detached, dependent rules go silent and the platform does not compute replacements

## 17. Future policy extension points

`JURISDICTION_EXTENSION_POINTS`: **NA** (Gambling Board of Namibia), **NG** (National Lottery Regulatory Commission / state boards), **GH** (Gaming Commission of Ghana), **MU** (Gambling Regulatory Authority). Also extendable by configuration alone: per-operator rule sets (`casinoId`), tenant feature policies (`scope: platform`), regulator-fed rule sources via `configure()`, and new decision actions/subjects by extending the validated vocabularies.

---

**Phase gate for 3.7 (Enterprise Consumers):** dashboards, reports, Realtime and APIs consume `twin.snapshot()`, `intelligenceOf(object)`, and `getPolicyPlatform().evaluate(twin, ctx)` — presentation and execution only, on top of one continuous enterprise flow.
