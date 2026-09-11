import React from 'react';
import { Container, Spinner } from '@yellowshifts/ui';
import { PlatformAdminIcon } from '@yellowshifts/icons';

export default function AdminLoading() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'var(--ys-color-surface-base, #F8FAFC)',
        color: '#111827',
        padding: '32px 16px',
        direction: 'rtl',
      }}
      aria-busy="true"
      aria-live="polite"
    >
      <Container size="sm">
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: 'var(--ys-radius-md)',
              backgroundColor: 'var(--ys-color-brand-yellow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--ys-color-text-primary)',
              boxShadow: '0 4px 16px rgba(252, 188, 0, 0.25)',
            }}
          >
            <PlatformAdminIcon size={30} />
          </div>

          <Spinner size="lg" color="var(--ys-color-brand-yellow)" />

          <p
            style={{
              fontSize: '15px',
              fontWeight: 500,
              color: '#6B7280',
              margin: 0,
            }}
          >
            טוען נתוני ניהול תחנות...
          </p>
        </div>
      </Container>
    </main>
  );
}
