import { PwaRegistration } from './components/PwaRegistration';
import type { Metadata, Viewport } from 'next';
import { Heebo, Ubuntu } from 'next/font/google';
import './globals.css';
import { BrandSplash, DarbFooter } from '@yellowshifts/ui';

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
  applicationName: 'YellowShifts Admin',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'YS Admin' },
  icons: {
    icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: '/icons/apple-touch-icon.png',
  },
  title: 'YellowShifts Admin | ניהול תחנות ומערכת',
  description: 'פורטל ניהול רב-תחנתי וממשק מנהל מערכת ראשי של YellowShifts.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: '#fcbc00',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} ${ubuntu.variable}`}>
      <body className="app-shell" style={{ fontFamily: 'var(--font-heebo), sans-serif' }}>
        <PwaRegistration />
        <BrandSplash />
        {children}
        <DarbFooter />
      </body>
    </html>
  );
}
