# SafeBet Guardian — Payment Intelligence (ARCH-V4-C4)

Provider-neutral merchant / payment-channel intelligence. **Synthetic only.** Flow: payment/
merchant subject → normalise → synthetic channel evidence → resolve operator/brand/licence via
the **C1 contract**, and domain/app references via the **C2/C3 reference contracts** → structured
**non-legal, non-enforcement** result → human review.

## Safety invariants (encoded + tested; DB CHECKs)
> PAYMENT CHANNEL OBSERVED ≠ ILLEGAL · MERCHANT NOT MATCHED ≠ ILLEGAL · BANK/PSP ASSOCIATION ≠
> LEGAL FINDING · HIGH REVIEW PRIORITY ≠ ENFORCEMENT · DETECTION ≠ PAYMENT ACTION.
Every result carries **`isIllegalDetermination:false`** AND **`isEnforcementAuthorised:false`**; the
`payment_registry_comparison` table has DB CHECKs forbidding both flags being true. No
block/freeze/terminate. No `PAYMENT_REFERRAL`/enforcement/provider-response state machine (future).

## Privacy / minimisation
**No PAN, no CVV, no real bank/card/customer transaction data.** Only provider-neutral tokens/
references/descriptors + synthetic aggregates. Provider-neutral vocabulary (PAYMENT_SERVICE_PROVIDER
/BANKING_PROVIDER/ACQUIRER/PAYMENT_PLATFORM/WALLET_PROVIDER; channels CARD/BANK_TRANSFER/EFT/WALLET/
VOUCHER/MOBILE_PAYMENT/CRYPTO_REFERENCE/OTHER/UNKNOWN). No named bank/PSP; no partnership claim.

## Governed cross-module contracts (no raw base-table coupling)
- Registry: `resolveLegalReference` (C1). Domain: `resolveDomainReference` + `guardian.domain_reference`
  view (C2). App: `resolveAppReference` + `guardian.app_reference` view (C3). The payment worker holds
  SELECT on the **contract views only** — never `domain_subject`/`mobile_app_subject` base tables.

## Durable path + persistence
SQS `guardian-payment-observation` → worker `safebet-guardian-payment-worker` → DLQ (own queue;
`ReportBatchItemFailures`, maxReceiveCount 2) + CloudWatch alarm. Persists via the dedicated
least-privilege role `guardian_payment_worker` (payment tables + audit_context + the 2 contract views;
no public/IQ, no C2/C3 base tables). Proven live: persist (governed DOMAIN→DOM-SYNTH-0003 + APP→
APP-SYNTH-0003 links via views), duplicate-suppression, wrong-jurisdiction→DLQ, poison→DLQ, 0 illegal/enforce.

## API (Guardian Lambda, AWS_IAM — no anonymous access)
`GET /payments|/merchants?jurisdiction=` · `GET /payments/:ref` · `POST /payments/observe`. Every
response carries `isIllegalDetermination:false` + `isEnforcementAuthorised:false`; unknown/real
reference → 404 (no real data accessed).

## Out of scope at C4
No payment enforcement / `PAYMENT_REFERRAL` / provider-response states; no geo intelligence; no AI
legal/payment decision; no real bank/PSP/provider integration; no real payment data; no production.
