# SafeBet Guardian — Database Rollback (ARCH-V4-PR2 §47)

Rollback distinguishes three layers:
- **Runtime rollback:** redeploy the Guardian API/workers at the last-good runtime SHA (PR1 `f9a26a2`) pointing at the OLD shared DB — valid ONLY if the new DB has not yet accepted authoritative writes.
- **Endpoint rollback:** repoint secrets/config back to the shared DB.
- **Data reconciliation:** if the dedicated DB HAS accepted authoritative post-cutover writes, rollback requires an explicit FREEZE + reconciliation plan (copy new-DB deltas back, or formally accept the new DB as source of truth). Do NOT casually roll back after new authoritative writes.

Non-destructive: the old Guardian tables are retained as LEGACY / READ-ONLY / ROLLBACK SOURCE; no Guardian data, evidence, custody, or audit history is deleted in PR2. Destructive cleanup is a later milestone.
