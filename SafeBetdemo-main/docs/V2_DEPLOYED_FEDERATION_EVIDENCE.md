# V2 — Deployed Federation Pipeline Evidence (Milestone 4.6B)

**Result: NOT ACHIEVED over deployed boundaries (architecturally out of HTTP scope by frozen design). C1 gains no deployed evidence.**

## 1. Required vs Reality
The brief asks to run source → connector → HMAC contribution → Event Platform → persistence → projection →
matching → decision → SB-NAT registry → correlation → national policy → regulator query **over deployed
boundaries**. In the frozen architecture (ADR-006) the entire federation pipeline is a **regulator-plane
library with no HTTP surface** — it is imported by no operator/app/edge path. This was re-confirmed on the live
server: all federation probe routes returned **404**.

## 2. Why It Was Not (and Must Not Be) Exposed
Giving the pipeline a deployed HTTP surface would require wiring federation into an operator/app route —
breaching the isolation invariant and the frozen architecture, which the brief explicitly forbids
("Do not redesign architecture", "No architecture deviation occurred"). Correctly, **no such surface was
added**.

## 3. What Stands (in-process, 4.6A)
The full pipeline was validated **in-process** in 4.6A through the composition's actual boundaries: SB-NAT
minted (`SB-NAT-ZA-<hex>`), correlation twin over 2 operators, full provenance, tenant/jurisdiction isolation,
operator read denial, no PII, restart durability. That evidence is **in-process**, not deployed, and is not
restated as deployed here.

## 4. Honest Status
No **deployed** federation pipeline evidence. **C1 remains PARTIALLY CLOSED.** Deployed evidence is obtainable
only via a managed runtime **and** a deliberate, separately-authorised decision about whether the federation
service is ever fronted by a (regulator-plane) transport — which is a Phase 4.7+/architecture-governance
question, not a 4.6 change.
