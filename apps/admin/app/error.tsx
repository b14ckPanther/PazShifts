'use client';

import React, { useEffect } from 'react';
import { NavigationLink as Link } from '@/app/components/NavigationLink';
import {
  Container,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Alert,
} from '@yellowshifts/ui';
import { DangerIcon, RefreshIcon, ArrowRightIcon } from '@yellowshifts/icons';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AdminError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Admin Application Error:', error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'var(--ys-color-surface-base, #F8FAFC)',
        padding: '32px 16px',
        direction: 'rtl',
      }}
    >
      <Container size="sm">
        <Card
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
          }}
        >
          <CardHeader>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--ys-radius-sm)',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#EF4444',
                }}
              >
                <DangerIcon size={22} />
              </div>
              <CardTitle style={{ color: '#111827' }}>שגיאת ניהול מערכת</CardTitle>
            </div>
            <CardDescription style={{ color: '#6B7280' }}>
              אירעה שגיאה בעיבוד הנתונים הניהוליים של התחנה.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Alert variant="danger">{error.message || 'שגיאה בלתי צפויה בתקשורת עם השרת.'}</Alert>
          </CardContent>

          <CardFooter>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <Button variant="primary" onClick={() => reset()}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <RefreshIcon size={16} />
                  נסה שנית
                </span>
              </Button>

              <Link href="/" style={{ textDecoration: 'none' }}>
                <Button variant="secondary">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <ArrowRightIcon size={16} />
                    חזרה לרשימת התחנות
                  </span>
                </Button>
              </Link>
            </div>
          </CardFooter>
        </Card>
      </Container>
    </main>
  );
}
