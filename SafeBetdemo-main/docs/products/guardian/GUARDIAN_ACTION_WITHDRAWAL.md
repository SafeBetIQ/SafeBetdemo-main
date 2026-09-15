# SafeBet Guardian — Action Withdrawal & Expiry (ARCH-V4-C9)

## Withdrawal before dispatch (§28)
If the C8 authorisation is withdrawn before synthetic publication, the orchestration becomes
`WITHDRAWN` and **no provider request is generated** (`orchestration_withdrawal` phase
`BEFORE_DISPATCH`, state `WITHDRAWN_NO_DISPATCH`).

## Withdrawal after dispatch (§29)
If withdrawn after synthetic publication, a withdrawal/cancellation request state is appended
(`orchestration_withdrawal` phase `AFTER_DISPATCH`, state `CANCELLATION_REQUESTED`). The
original provider request is **not** erased (append-only). Guardian does not claim the
cancellation was accepted unless the synthetic provider confirms it
(`CANCELLATION_CONFIRMED_BY_PROVIDER`).

## Authorisation expiry (§30)
If the authorisation expires **before** dispatch -> `ORCHESTRATION_BLOCKED`
(`AUTHORISATION_EXPIRED`; proven live — no provider request). If it expires **after** provider
publication, the chronology is preserved and handled per policy; Guardian does not fabricate a
provider rollback.

## No scope widening (§44)
C9 creates no authorisation authority and cannot widen the authorised scope. Any material scope
change -> `SCOPE_MUTATED` -> return to C8 for a new authorisation.
