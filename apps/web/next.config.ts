import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@yellowshifts/ui',
    '@yellowshifts/icons',
    '@yellowshifts/types',
    '@yellowshifts/database',
    '@yellowshifts/i18n',
  ],
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
