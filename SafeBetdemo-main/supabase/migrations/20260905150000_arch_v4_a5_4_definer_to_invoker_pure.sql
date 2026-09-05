-- ─── ARCH-V4-A5.4 — SECURITY DEFINER -> INVOKER for 3 PURE functions ─────────
-- Execution-mode hardening (Authority §11.1 / §20.2). These 3 SECURITY DEFINER
-- functions are PURE computation — they access NO tables, perform NO writes, read
-- no auth/identity context, and are NOT used as RLS predicates. For a pure function
-- the execution role cannot affect the result, so DEFINER elevation is entirely
-- unnecessary; SECURITY INVOKER removes an unjustified privileged execution context
-- with zero behavioural change (proven: identical deterministic output before/after).
--   mask_email(text)   — string masking only
--   mask_phone(text)   — string masking only
--   hash_identity(text)— current_setting(pepper) + digest() (pgcrypto), no table access
--
-- This changes ONLY the security mode. Grants, SET search_path, owner, volatility,
-- and body are unchanged (no grant broadening; existing A5.3 access restrictions
-- remain authoritative). Reversible: `alter function <sig> security definer;`.

alter function public.mask_email(text) security invoker;
alter function public.mask_phone(text) security invoker;
alter function public.hash_identity(text) security invoker;
