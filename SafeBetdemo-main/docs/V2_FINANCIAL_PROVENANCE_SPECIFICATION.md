# Financial Provenance Specification (Milestone 4.5)

**ADR-006 (frozen) · No derived total without source provenance.**

## 1. Provenance chain
```
National Aggregate → Operator Projection → Accepted Event Platform Events →
Connector Submission → Source Record Reference → Operator Sandbox Source
```

## 2. Recorded provenance
- **Operator projection:** `sourceEventIds[]` (every contributing accepted event), `eventCount`,
  `projectionVersion`, `formula`, `currency`, `dataFreshness`.
- **Accepted event:** `provenanceRef` (`fin-event:<id>`), `sourceSequence`, source-system ref (carried on
  the event), tenant/operator/jurisdiction, currency.
- **National aggregate:** `includedOperators`, `excludedOperators` (+ reason), window, freshness.

## 3. Completeness guarantee
`sourceEventIds.length === eventCount` for every operator projection — no derived total exists without its
underlying accepted events (integrity `provenance-complete`, tested).

## 4. Traceability
Any reported total (national → operator → GGR) can be traced to the accepted events that produced it, then
to their source references. Adjustments (void/refund/correction) reference the original event; nothing is
deleted.

## 5. Exclusions
Rejected, duplicate, void, refund, and cross-currency records are excluded from totals **with a recorded
reason** — never silently dropped.

## 6. Deployment binding
Live source-system references + deployed event provenance are provided by the deployed connector/Event
Platform (C1 residual); the pilot carries synthetic source refs end-to-end.
