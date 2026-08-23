import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/members-zone/about'],
        disallow: [
          '/members-zone/',
          '/login',
          '/join/payment',
          '/join/discord',
          '/join/zwift-id',
          '/join/complete',
          '/api/',
        ],
      },
    ],
    sitemap: 'https://www.dzrracingseries.com/sitemap.xml',
  };
}
