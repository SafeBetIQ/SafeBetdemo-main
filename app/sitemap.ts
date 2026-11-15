import type { MetadataRoute } from 'next';

// Public marketing routes only. Authenticated application routes are excluded.
const BASE = 'https://www.safebetiq.com';

const ROUTES = [
  '',
  '/features/casinos',
  '/features/behavioral-risk-intelligence',
  '/features/responsible-gambling-interventions',
  '/features/compliance-reporting',
  '/features/cross-operator-intelligence',
  '/features/self-exclusion-network',
  '/features/regulators',
  '/features/regulator-intelligence',
  '/technology',
  '/nova-iq',
  '/safeplay-connect',
  '/contact',
  '/about',
  '/help',
  '/privacy',
  '/terms',
  '/cookies',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ROUTES.map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: path === '' ? 1 : 0.7,
  }));
}
