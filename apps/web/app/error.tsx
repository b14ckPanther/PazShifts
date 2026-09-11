'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
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

export default function WebError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log unexpected client error to monitoring if configured
    console.error('Web Application Error:', error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'var(--ys-color-surface-base)',
        padding: '32px 16px',
        direction: 'rtl',
      }}
    >
      <Container size="sm">
        <Card>
          <CardHeader>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--ys-radius-sm)',
                  backgroundColor: 'rgba(209, 0, 64, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--ys-color-brand-crimson)',
                }}
              >
                <DangerIcon size={22} />
              </div>
              <CardTitle>אירעה שגיאה בטעינת הדף</CardTitle>
            </div>
            <CardDescription>המערכת נתקלה בבעיה בלתי צפויה בעת עיבוד הבקשה.</CardDescription>
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
                    חזרה למסך הבית
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
