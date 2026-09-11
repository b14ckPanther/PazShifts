import React from 'react';
import { Container, Spinner } from '@yellowshifts/ui';
import { StationIcon } from '@yellowshifts/icons';

export default function WebLoading() {
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
              width: '48px',
              height: '48px',
              borderRadius: 'var(--ys-radius-md)',
              backgroundColor: 'var(--ys-color-brand-yellow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--ys-color-text-primary)',
            }}
          >
            <StationIcon size={28} />
          </div>

          <Spinner size="lg" color="var(--ys-color-brand-yellow)" />

          <p
            style={{
              fontSize: '15px',
              fontWeight: 500,
              color: 'var(--ys-color-text-secondary)',
              margin: 0,
            }}
          >
            טוען נתונים...
          </p>
        </div>
      </Container>
    </main>
  );
}
