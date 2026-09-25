import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'YellowShifts — המשמרת שלי',
    short_name: 'YellowShifts',
    description: 'המשמרות והנוכחות שלך במקום אחד',
    lang: 'he',
    dir: 'rtl',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#fcbc00',
    theme_color: '#fcbc00',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
