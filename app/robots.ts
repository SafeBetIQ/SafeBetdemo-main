import type { MetadataRoute } from 'next';

// Public marketing site is crawlable; authenticated application areas are not.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/casino', '/regulator', '/staff', '/api', '/login'],
    },
    sitemap: 'https://www.safebetiq.com/sitemap.xml',
    host: 'https://www.safebetiq.com',
  };
}
