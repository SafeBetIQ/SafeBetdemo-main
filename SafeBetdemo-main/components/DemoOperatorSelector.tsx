'use client';

// ─── Demo Operator Selector ──────────────────────────────────────────────────
// Six synthetic casino demo cards + a regulator demo entry. Selecting a card
// PRE-FILLS ONLY the mapped email address — it never fills or exposes a password,
// never creates a session, and never sends the casino id as authorisation. Role
// and tenant are resolved server-side from the verified identity after the user
// completes manual authentication. Rendered only in the non-production demo
// environment (NEXT_PUBLIC_ENV !== 'production'); absent from production builds.

import { Building2, ShieldCheck } from 'lucide-react';
import { DEMO_OPERATORS, DEMO_REGULATOR_EMAIL } from '@/lib/demoOperators';

export function DemoOperatorSelector({ onSelectEmail }: { onSelectEmail: (email: string) => void }) {
  if (process.env.NEXT_PUBLIC_ENV === 'production') return null;
  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-2">
        <Building2 className="h-3.5 w-3.5 text-[#7ED321]" />
        <h3 className="text-sm font-semibold text-white">Choose a Demo Operator</h3>
      </div>
      <p className="text-[10px] text-white/30 mb-3">
        Synthetic demonstration operator profiles. No commercial affiliation or endorsement is implied.
        Selecting a card fills only the email — enter the demo password to sign in.
      </p>
      <div className="grid sm:grid-cols-2 gap-2">
        {DEMO_OPERATORS.map((op) => (
          <div key={op.email} className="rounded-lg border border-white/10 bg-white/[0.03] p-3 flex flex-col">
            <p className="text-xs font-semibold text-white">{op.casino}</p>
            <span className="mt-0.5 inline-flex w-fit items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-300">
              Synthetic Demo
            </span>
            <p className="mt-1.5 text-[10px] text-white/45 leading-snug">{op.profile}</p>
            <p className="mt-1 text-[10px] text-[#7ED321]/80 font-medium">{op.registeredScale}</p>
            <p className="text-[10px] text-white/35">{op.posture}</p>
            <button
              type="button"
              onClick={() => onSelectEmail(op.email)}
              className="mt-2 w-full rounded-md border border-[#7ED321]/40 bg-[#7ED321]/10 px-2 py-1.5 text-[11px] font-semibold text-[#7ED321] hover:bg-[#7ED321]/20 transition-colors"
            >
              Select Casino Demo
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-sky-400" />
          <p className="text-xs font-semibold text-white">Regulator Oversight Demo</p>
        </div>
        <p className="mt-1 text-[10px] text-white/40">National jurisdiction view across all six synthetic operators. Requires the demo password.</p>
        <button
          type="button"
          onClick={() => onSelectEmail(DEMO_REGULATOR_EMAIL)}
          className="mt-2 w-full rounded-md border border-sky-400/40 bg-sky-400/10 px-2 py-1.5 text-[11px] font-semibold text-sky-300 hover:bg-sky-400/20 transition-colors"
        >
          Select Regulator Demo
        </button>
      </div>
    </div>
  );
}
