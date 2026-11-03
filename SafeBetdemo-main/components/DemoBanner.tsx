// Environment banner (M1B-P1F Correction 5). Presents each environment EXPLICITLY:
//   • production  → no banner (app.safebetiq.com, marketing site)
//   • demo        → "SafeBet IQ Demo · Non-Production · Synthetic Data" (amber)
//   • pilot       → "SafeBet IQ Pilot · Controlled Pilot Environment · Not Live Operator Data" (teal)
//   • unknown/unset → neutral non-production banner (fail safe; never looks like production,
//                     never mislabels as Demo)
// Pilot never shows the Demo banner / synthetic-data wording, and never implies real operator data.
// Keyed off the LITERAL process.env.NEXT_PUBLIC_SAFEBET_ENV so Next.js inlines it at build time.
import { environmentPresentation, type EnvironmentKind } from '@/lib/environmentGates';

const TONE: Record<EnvironmentKind, string> = {
  demo: 'linear-gradient(90deg,#78350f,#b45309)',       // amber — synthetic
  pilot: 'linear-gradient(90deg,#0f3d3e,#0e7490)',      // teal — controlled pilot
  unknown: 'linear-gradient(90deg,#334155,#475569)',    // slate — neutral non-production
  production: 'transparent',
};

export function DemoBanner() {
  const env = environmentPresentation(process.env.NEXT_PUBLIC_SAFEBET_ENV);
  if (!env.show) return null;
  return (
    <div
      role="status"
      data-environment={env.kind}
      style={{
        position: 'sticky', top: 0, zIndex: 9999, width: '100%',
        background: TONE[env.kind], color: '#fff',
        fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
        textAlign: 'center', padding: '3px 8px', textTransform: 'uppercase',
        borderBottom: '1px solid rgba(255,255,255,0.15)',
      }}
    >
      {env.label}
    </div>
  );
}
