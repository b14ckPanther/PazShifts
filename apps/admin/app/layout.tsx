import type { Metadata } from 'next';
import { Heebo, Ubuntu } from 'next/font/google';
import './globals.css';

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
  title: 'YellowShifts Admin | ניהול תחנות ומערכת',
  description: 'פורטל ניהול רב-תחנתי וממשק מנהל מערכת ראשי של YellowShifts.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} ${ubuntu.variable}`}>
      <body style={{ fontFamily: 'var(--font-heebo), sans-serif' }}>{children}</body>
    </html>
  );
}
