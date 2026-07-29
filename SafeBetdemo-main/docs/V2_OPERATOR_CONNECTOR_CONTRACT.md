# Operator Connector Contract (Milestone 4.4)

**ADR-006 (frozen) · Vendor-neutral · No credential/secret exposed.**

## 1. Config (`ConnectorConfig`)
connectorId · operatorId · tenantId · jurisdiction · connectorVersion · sourceType · supportedAttributes ·
rateLimit `{ maxBatch, maxPerWindow, windowMs, maxConcurrent }` · retryPolicy `{ maxRetries, baseDelayMs }`.

## 2. Runtime state
lifecycle status · checkpoint · sequence state · health · suspension · last success/failure · audit ref.

## 3. Lifecycle states + transitions
`provisioned → validating → active → degraded → suspended → revoked/failed/retired` (see
`CONNECTOR_TRANSITIONS`). Starts **disabled**; activation explicit; revoked/retired terminal.

## 4. Public surface (narrow)
`activate` · `sync` · `suspend`/`reactivate`/`revoke`/`retire` (admin-authorised) · `health` ·
`reconcile` · `deadLetterQueue` · `currentCheckpoint` · `status` · `auditTrail`. **No** federation-read
method; **no** credential/secret getter.

## 5. Vendor-neutrality
Operator-specific adapters plug in behind `SandboxSource` (read) + the SB-PLR resolver; the connector
core is source-agnostic. No global shared connector identity — each connector is one operator/tenant.

## 6. Prohibited
Query SB-NAT / national identities / matching candidates / decisions / cross-operator intelligence /
national policy · access another operator's data · write downstream · switch tenant · expose secrets.
