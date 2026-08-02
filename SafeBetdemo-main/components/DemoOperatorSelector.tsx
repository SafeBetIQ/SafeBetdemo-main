'use client';

// ─── Demo Operator Selector ──────────────────────────────────────────────────
// Six synthetic casino cards + a regulator entry. Clicking a card performs a
// SECURE server-side Demo login: the browser sends ONLY the immutable slug to
// /api/demo-auth/login (never an email, password, role, casino id, or redirect).
// The server authenticates with server-only credentials, verifies role + tenant
// scope, audits, and returns the session the localStorage Supabase client needs
// to establish the authenticated session. The password is never displayed,
// populated, or returned to the browser. Rendered only in the non-production
// demo environment; absent from production builds. No Super Admin option.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, ShieldCheck, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DEMO_OPERATORS, DEMO_REGULATOR_SLUG } from '@/lib/demoOperators';

export function DemoOperatorSelector() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (process.env.NEXT_PUBLIC_ENV === 'production') return null;

  async function enter(slug: string, label: string) {
    setError('');
    setBusy(slug);
    try {
      const res = await fetch('/api/demo-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ demoAccount: slug }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok || !data?.session) {
        setError('The Demo account could not be opened. Please try again.');
        setBusy(null);
        return;
      }
      // Establish the browser session (localStorage) — same mechanism as normal login.
      const { error: sessErr } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      if (sessErr) {
        setError('The Demo account could not be opened. Please try again.');
        setBusy(null);
        return;
      }
      router.replace(typeof data.redirect === 'string' ? data.redirect : '/');
    } catch {
      setError('The Demo account could not be opened. Please try again.');
      setBusy(null);
    }
  }

  const disabled = busy !== null;

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-2">
        <Building2 className="h-3.5 w-3.5 text-[#7ED321]" />
        <h3 className="text-sm font-semibold text-white">Choose a Demo Operator</h3>
      </div>
      <p className="text-[10px] text-white/30 mb-3">
        Synthetic demonstration operator profiles. No commercial affiliation or endorsement is implied.
        One click signs you in securely — no password is shown or required.
      </p>

      {error && (
        <div role="alert" className="mb-3 rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-[11px] text-red-300">
          {error}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-2">
        {DEMO_OPERATORS.map((op) => (
          <div key={op.slug} className="rounded-lg border border-white/10 bg-white/[0.03] p-3 flex flex-col">
            <p className="text-xs font-semibold text-white">{op.casino}</p>
            <span className="mt-0.5 inline-flex w-fit items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-300">
              Synthetic Demo
            </span>
            <p className="mt-1.5 text-[10px] text-white/45 leading-snug">{op.profile}</p>
            <p className="mt-1 text-[10px] text-[#7ED321]/80 font-medium">{op.registeredScale}</p>
            <p className="text-[10px] text-white/35">{op.posture}</p>
            <button
              type="button"
              disabled={disabled}
              onClick={() => enter(op.slug, op.casino)}
              className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-[#7ED321]/40 bg-[#7ED321]/10 px-2 py-1.5 text-[11px] font-semibold text-[#7ED321] hover:bg-[#7ED321]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy === op.slug ? (
                <><Loader2 className="h-3 w-3 animate-spin" /> Opening {op.casino.replace(' — Demo', '')} Demo…</>
              ) : (
                'Enter Casino Demo'
              )}
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-sky-400" />
          <p className="text-xs font-semibold text-white">Regulator Oversight Demo</p>
        </div>
        <p className="mt-1 text-[10px] text-white/40">National jurisdiction view across all six synthetic operators.</p>
        <button
          type="button"
          disabled={disabled}
          onClick={() => enter(DEMO_REGULATOR_SLUG, 'Regulator')}
          className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-sky-400/40 bg-sky-400/10 px-2 py-1.5 text-[11px] font-semibold text-sky-300 hover:bg-sky-400/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy === DEMO_REGULATOR_SLUG ? (
            <><Loader2 className="h-3 w-3 animate-spin" /> Opening Regulator Demo…</>
          ) : (
            'Enter Regulator Demo'
          )}
        </button>
      </div>
    </div>
  );
}
