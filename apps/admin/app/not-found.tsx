import React from 'react';
import Link from 'next/link';
import {
  Container,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
  Button,
} from '@yellowshifts/ui';
import { PlatformAdminIcon, ArrowRightIcon } from '@yellowshifts/icons';

export default function AdminNotFound() {
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
                  backgroundColor: 'rgba(252, 188, 0, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--ys-color-brand-yellow)',
                }}
              >
                <PlatformAdminIcon size={22} />
              </div>
              <CardTitle style={{ color: '#111827' }}>404 — דף ניהול לא נמצא</CardTitle>
            </div>
            <CardDescription style={{ color: '#6B7280' }}>
              דף הניהול או התחנה המבוקשת אינם קיימים במערכת.
            </CardDescription>
          </CardHeader>

          <CardFooter>
            <Link href="/" style={{ textDecoration: 'none' }}>
              <Button variant="primary">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <ArrowRightIcon size={16} />
                  חזרה לדשבורד הראשי
                </span>
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </Container>
    </main>
  );
}
