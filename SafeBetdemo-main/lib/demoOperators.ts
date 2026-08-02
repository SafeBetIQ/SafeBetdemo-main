// Six synthetic casino demo operators and the agreed email→tenant mappings.
// Pure data (no JSX) so it is unit-testable under `node --test`. The login
// selector renders these; selecting a card pre-fills ONLY the email. Tenant/role
// are resolved server-side from the verified identity — never from this data.
// Registered-scale figures are the synthetic six-casino evaluation targets, not
// real operator performance.

export interface DemoOperator {
  slug: string;   // immutable identifier sent to /api/demo-auth/login (server maps to the account)
  casino: string;
  email: string;
  profile: string;
  registeredScale: string;
  posture: string;
}

export const DEMO_OPERATORS: DemoOperator[] = [
  { slug: 'prestige', casino: 'Prestige Casino — Demo', email: 'demo.prestige@safebetiq.com', profile: 'Medium-large operator · balanced, evening-weighted play', registeredScale: '~18,000 registered synthetic players', posture: 'Live risk monitoring · moderate high-risk cohort' },
  { slug: 'sunbet', casino: 'SunBet — Demo', email: 'demo.sunbet@safebetiq.com', profile: 'Daytime-weighted · lower average stake', registeredScale: '~14,500 registered synthetic players', posture: 'Live risk monitoring · steady daytime posture' },
  { slug: 'hollywoodbets', casino: 'Hollywoodbets — Demo', email: 'demo.hollywoodbets@safebetiq.com', profile: 'Largest synthetic operator · high session volume', registeredScale: '~28,000 registered synthetic players', posture: 'Live risk monitoring · broad evidence history' },
  { slug: 'goldrush', casino: 'Gold Rush — Demo', email: 'demo.goldrush@safebetiq.com', profile: 'Machine-heavy floor · high utilisation', registeredScale: '~10,500 registered synthetic players', posture: 'Live risk monitoring · high machine occupancy' },
  { slug: 'betway', casino: 'Betway — Demo', email: 'demo.betway@safebetiq.com', profile: 'Online-style profile · high session concurrency', registeredScale: '~22,000 registered synthetic players', posture: 'Live risk monitoring · high concurrency' },
  { slug: 'royalpalace', casino: 'Royal Palace — Demo', email: 'demo.royalpalace@safebetiq.com', profile: 'Boutique operator · lower concurrency', registeredScale: '~8,500 registered synthetic players', posture: 'Live risk monitoring · complete smaller footprint' },
];

export const DEMO_REGULATOR_SLUG = 'regulator';
export const DEMO_REGULATOR_EMAIL = 'demo.regulator@safebetiq.com';
