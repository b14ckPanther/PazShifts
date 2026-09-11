import type { Metadata, Viewport } from 'next';
import { Heebo, Ubuntu } from 'next/font/google';
import './globals.css';
import { BrandSplash } from '@yellowshifts/ui';
import { PwaRegistration } from './components/PwaRegistration';

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-heebo',
  display: 'swap',
});

const ubuntu = Ubuntu({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-ubuntu',
  display: 'swap',
});

export const metadata: Metadata = {
  applicationName: 'YellowShifts',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'YellowShifts' },
  icons: {
    icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: '/icons/apple-touch-icon.png',
  },
  title: 'YellowShifts | פלטפורמת תפעול משמרות ועבודה',
  description:
    'מערכת ניהול משמרות וכוח אדם מתקדמת לתחנות, מנהלי משמרת ועובדים בסנכרון מלא בזמן אמת.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: '#f7f8fa',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} ${ubuntu.variable}`}>
      <body style={{ fontFamily: 'var(--font-heebo), sans-serif' }}>
        <PwaRegistration />
        <BrandSplash />
        {children}
      </body>
    </html>
  );
}
