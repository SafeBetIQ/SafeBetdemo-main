# Operator Connector Sandbox Runbook (Milestone 4.4)

**ADR-006 (frozen) · NON-PRODUCTION only. Do NOT connect to a production casino.**

## 1. Provision
1. Provision a connector credential bound to **one** operator/tenant/jurisdiction (`ConnectorAuthenticator.provision`).
2. Construct `OperatorConnector` with the config, authenticator, credential, sandbox source, 4.2 crypto
   provider, SB-PLR resolver, 4.3 Event Platform, and a checkpoint store. It starts **disabled** (`provisioned`).

## 2. Activate (explicit)
`connector.activate()` — validates authentication + binding, then transitions to `active` (audited).

## 3. Run
`connector.sync()` — reads a bounded batch from the checkpoint cursor, resolves SB-PLR, hashes before the
boundary, submits hash-only contributions, advances the checkpoint after safe processing, and returns a
`SyncSummary`. Repeat on a schedule/worker (deployment binding).

## 4. Monitor
`connector.health()` (lifecycle, last read/submit/ack, checkpoint, pending retries, dead-letters, auth
status, rate-limited, circuit-open, last error) and `connector.reconcile()` (balanced accounting).

## 5. Recover
On restart, construct a new connector over the same checkpoint store → resumes at the saved cursor. On
backpressure (circuit open / degraded), resolve the transient cause and `sync()` again.

## 6. Suspend / reactivate / revoke (authorised admin)
`suspend(ctx)` → stop; `reactivate(ctx, true)` → resume (approved review); `revoke(ctx)` → permanent deny
(new identity required); `retire(ctx)` → terminal.

## 7. Disablement
Suspend or revoke immediately stops submissions. The connector cannot run unless explicitly activated.

## 8. Deployment model + boundaries
Pilot = local in-process component. **No** production casino DB/API, credentials, endpoints, or real data.
Managed deployment (container/worker), external vendor sandbox, durable checkpoint/secret storage, and
monitoring/alarms are **deployment bindings** (C5 residual + C2/C4/C7).
