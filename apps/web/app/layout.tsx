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
  title: 'YellowShifts | פלטפורמת תפעול משמרות ועבודה',
  description:
    'מערכת ניהול משמרות וכוח אדם מתקדמת לתחנות, מנהלי משמרת ועובדים בסנכרון מלא בזמן אמת.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} ${ubuntu.variable}`}>
      <body style={{ fontFamily: 'var(--font-heebo), sans-serif' }}>{children}</body>
    </html>
  );
}
