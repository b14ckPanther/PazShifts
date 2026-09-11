import React from 'react';
import { NavigationLink as Link } from '@/app/components/NavigationLink';
import {
  Container,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
  Button,
} from '@yellowshifts/ui';
import { StationIcon, ArrowRightIcon } from '@yellowshifts/icons';

export default function WebNotFound() {
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
                  backgroundColor: 'rgba(252, 188, 0, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--ys-color-text-primary)',
                }}
              >
                <StationIcon size={22} />
              </div>
              <CardTitle>404 — הדף המבוקש לא נמצא</CardTitle>
            </div>
            <CardDescription>
              הכתובת אליה ניסית לגשת אינה קיימת או שהועברה למיקום אחר.
            </CardDescription>
          </CardHeader>

          <CardFooter>
            <Link href="/" style={{ textDecoration: 'none' }}>
              <Button variant="primary">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <ArrowRightIcon size={16} />
                  חזרה לדף הראשי
                </span>
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </Container>
    </main>
  );
}
