'use client';

// Single primary data hook for the Super Admin Overview. Replaces the page's
// ~8-call fan-out with ONE request to /api/admin/overview (core), plus ONE bounded
// DEFERRED request for the heavy financial section. Uses the lock-free token read
// (no getSession() on the happy path), starts immediately, dedupes/cancels
// in-flight requests, polls once (paused when hidden), and keeps prior data
// visible during refresh. The server enforces super_admin every request.

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, readAccessTokenFast } from '@/lib/supabase';
import { shouldPoll } from '@/lib/demoSimHealthClient';
import { isValidOverview } from '@/lib/adminOverviewContract';

export interface AdminOverview {
  schema_version: string;
  as_of: string;
  environment: { name: string; non_production: boolean; synthetic_data: boolean };
  platform: Record<string, unknown>;
  risk: Record<string, unknown>;
  governance: Record<string, unknown>;
  simulator: Record<string, unknown>;
  alerts: Record<string, unknown>;
  casinos: Array<Record<string, unknown>>;
  financial: Record<string, unknown> | null;
  registered_status?: Record<string, unknown> | null;
}

const POLL_MS = 45000;

async function authedFetch(path: string, signal: AbortSignal): Promise<Response | null> {
  let token = readAccessTokenFast();
  const call = (t: string) => fetch(path, { headers: { authorization: `Bearer ${t}` }, cache: 'no-store', signal });
  let res = token ? await call(token) : null;
  if (!res || res.status === 401) {
    const { data } = await supabase.auth.getSession();     // rare: refresh once
    token = data.session?.access_token ?? null;
    if (!token) return null;
    res = await call(token);
  }
  return res;
}

export function useAdminOverview() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [financial, setFinancial] = useState<Record<string, unknown> | null>(null);
  const [financialLoading, setFinancialLoading] = useState(false);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error' | 'unavailable'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [correlationId, setCorrelationId] = useState<string | null>(null);
  const inflight = useRef<AbortController | null>(null);
  const firstDone = useRef(false);

  const load = useCallback(async (opts?: { fresh?: boolean; isRefresh?: boolean }) => {
    inflight.current?.abort();
    const ac = new AbortController();
    inflight.current = ac;
    const cid = crypto.randomUUID();
    if (opts?.isRefresh) setRefreshing(true);
    else if (!firstDone.current) setPhase('loading');
    try {
      const res = await authedFetch(`/api/admin/overview${opts?.fresh ? '?fresh=1' : ''}`, ac.signal);
      if (!res) { if (!firstDone.current) { setPhase('error'); setCorrelationId(cid); } return; }
      if (res.status === 404 || res.status === 403) { setPhase('unavailable'); return; }
      if (!res.ok) { if (!firstDone.current) { setPhase('error'); setCorrelationId(cid); } return; }
      const json = await res.json();
      if (!isValidOverview(json)) { if (!firstDone.current) { setPhase('error'); setCorrelationId(cid); } return; }
      setData(json as AdminOverview);
      setPhase('ready'); setCorrelationId(null); firstDone.current = true;

      // Deferred, non-blocking financial section (heavy ~5s server query, cached).
      setFinancialLoading(true);
      authedFetch(`/api/admin/overview?section=financial${opts?.fresh ? '&fresh=1' : ''}`, ac.signal)
        .then(async (fr) => { if (fr?.ok) { const j = await fr.json(); setFinancial(j.financial ?? null); } })
        .catch(() => { /* keep core; financial optional */ })
        .finally(() => setFinancialLoading(false));
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;      // superseded — keep prior data
      if (!firstDone.current) { setPhase('error'); setCorrelationId(cid); }
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      if (shouldPoll(document.hidden, firstDone.current)) load({ isRefresh: true });
    }, POLL_MS);
    const onVis = () => { if (!document.hidden && firstDone.current) load({ isRefresh: true }); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVis);
      inflight.current?.abort();
    };
  }, [load]);

  const [registeredRefreshing, setRegisteredRefreshing] = useState(false);
  const refreshRegistered = useCallback(async (): Promise<{ ok: boolean; reason?: string }> => {
    if (registeredRefreshing) return { ok: false, reason: 'in_progress' };   // prevent duplicate
    setRegisteredRefreshing(true);
    try {
      const ac = new AbortController();
      const res = await (async () => {
        let token = readAccessTokenFast();
        const call = (t: string) => fetch('/api/admin/overview/refresh-registered-counts', {
          method: 'POST', headers: { authorization: `Bearer ${t}` }, cache: 'no-store', signal: ac.signal,
        });
        let r = token ? await call(token) : null;
        if (!r || r.status === 401) { const { data } = await supabase.auth.getSession(); token = data.session?.access_token ?? null; if (!token) return null; r = await call(token); }
        return r;
      })();
      if (!res || !res.ok) return { ok: false, reason: 'failed' };
      await res.json();
      await load({ fresh: true });   // pull the new certified count
      return { ok: true };
    } catch { return { ok: false, reason: 'error' }; }
    finally { setRegisteredRefreshing(false); }
  }, [registeredRefreshing, load]);

  return {
    data, financial, financialLoading, phase, refreshing, correlationId,
    asOf: data?.as_of ?? null,
    registeredStatus: data?.registered_status ?? null,
    registeredRefreshing, refreshRegistered,
    retry: () => load({ fresh: true }),
    refresh: () => load({ isRefresh: true }),
  };
}
