// Non-production demo banner. Rendered on every page UNLESS the build is
// explicitly marked production (NEXT_PUBLIC_SAFEBET_ENV === 'production'), so it
// appears on demo.safebetiq.com but never on app.safebetiq.com (production) or
// the marketing site. Required labelling for the demo environment.
export function DemoBanner() {
  if (process.env.NEXT_PUBLIC_SAFEBET_ENV === 'production') return null;
  return (
    <div
      role="status"
      style={{
        position: 'sticky', top: 0, zIndex: 9999, width: '100%',
        background: 'linear-gradient(90deg,#78350f,#b45309)', color: '#fff',
        fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
        textAlign: 'center', padding: '3px 8px', textTransform: 'uppercase',
        borderBottom: '1px solid rgba(255,255,255,0.15)',
      }}
    >
      SafeBet IQ Demo · Non-Production · Synthetic Data
    </div>
  );
}
