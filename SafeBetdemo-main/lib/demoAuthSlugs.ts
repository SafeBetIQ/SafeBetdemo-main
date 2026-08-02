// Server-side Demo quick-login allowlist and account mapping. Contains NO
// secrets — only the immutable slug → { env-var NAMES, expected role, tenant
// scope, fixed redirect } mapping. Super Admin (demo.admin) is intentionally
// absent so it can never be reached via quick-login. Shared by the API route
// and its tests.

export interface DemoSlugCfg {
  emailEnv: string;
  pwEnv: string;
  role: string;
  casino?: string;
  jurisdiction?: string;
  redirect: string;
}

export const DEMO_SLUGS: Record<string, DemoSlugCfg> = {
  prestige:      { emailEnv: 'DEMO_PRESTIGE_EMAIL',      pwEnv: 'DEMO_PRESTIGE_PASSWORD',      role: 'casino_admin', casino: 'a1b2c3d4-0000-0000-0000-000000000001', redirect: '/casino/dashboard' },
  sunbet:        { emailEnv: 'DEMO_SUNBET_EMAIL',        pwEnv: 'DEMO_SUNBET_PASSWORD',        role: 'casino_admin', casino: 'cc000001-0000-0000-0000-000000000001', redirect: '/casino/dashboard' },
  hollywoodbets: { emailEnv: 'DEMO_HOLLYWOODBETS_EMAIL', pwEnv: 'DEMO_HOLLYWOODBETS_PASSWORD', role: 'casino_admin', casino: 'cc000002-0000-0000-0000-000000000002', redirect: '/casino/dashboard' },
  goldrush:      { emailEnv: 'DEMO_GOLDRUSH_EMAIL',      pwEnv: 'DEMO_GOLDRUSH_PASSWORD',      role: 'casino_admin', casino: 'cc000004-0000-0000-0000-000000000004', redirect: '/casino/dashboard' },
  betway:        { emailEnv: 'DEMO_BETWAY_EMAIL',        pwEnv: 'DEMO_BETWAY_PASSWORD',        role: 'casino_admin', casino: 'cc000003-0000-0000-0000-000000000003', redirect: '/casino/dashboard' },
  royalpalace:   { emailEnv: 'DEMO_ROYALPALACE_EMAIL',   pwEnv: 'DEMO_ROYALPALACE_PASSWORD',   role: 'casino_admin', casino: 'cc000005-0000-0000-0000-000000000005', redirect: '/casino/dashboard' },
  regulator:     { emailEnv: 'DEMO_REGULATOR_EMAIL',     pwEnv: 'DEMO_REGULATOR_PASSWORD',     role: 'regulator', jurisdiction: 'ZA', redirect: '/regulator/dashboard' },
};

export function resolveDemoSlug(slug: unknown): DemoSlugCfg | null {
  if (typeof slug !== 'string') return null;
  return Object.prototype.hasOwnProperty.call(DEMO_SLUGS, slug) ? DEMO_SLUGS[slug] : null;
}
