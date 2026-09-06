# SafeBet Guardian — Payment Reason Codes (ARCH-V4-C4)

Explicit reason codes support review; **not** criminal/legal findings. (`PaymentReasonCode`.)

| Reason code | Meaning (non-legal) |
|---|---|
| `NO_AUTHORITATIVE_REGISTRY_MATCH` | no authoritative registry match — NOT illegal |
| `MERCHANT_OPERATOR_MISMATCH` | merchant/declared operator inconsistent with registry |
| `MERCHANT_BRAND_MISMATCH` | declared brand resolves to a different operator than the licence |
| `LICENCE_RECORD_STALE` | matched licence verification stale |
| `SOURCE_CONFLICT` | registry sources disagree; human review |
| `UNKNOWN_PROVIDER_REFERENCE` | absent/ambiguous provider reference |
| `DOMAIN_REFERENCE_MISMATCH` | declared website not a known domain reference |
| `APP_REFERENCE_MISMATCH` | declared app not a known app reference |
| `MERCHANT_DESCRIPTOR_CHANGED` | merchant descriptor changed between observations |
| `PAYMENT_CHANNEL_CHANGED` | payment channel changed |
| `UNVERIFIED_PAYMENT_REFERENCE` | no operator/brand/licence reference declared |

Feed the explainable investigation priority; never a black-box score; never illegality/enforcement.
