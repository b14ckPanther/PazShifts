import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@yellowshifts/ui',
    '@yellowshifts/reports',
    '@yellowshifts/icons',
    '@yellowshifts/types',
    '@yellowshifts/database',
    '@yellowshifts/i18n',
  ],
  reactStrictMode: true,
};

export default nextConfig;
