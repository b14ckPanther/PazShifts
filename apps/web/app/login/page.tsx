'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CompactLogin } from '@yellowshifts/ui';
import { loginAction } from '../actions/auth';

function LoginContent() {
  const params = useSearchParams();
  return <CompactLogin action={loginAction} nextPath={params.get('next') || ''} />;
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="mobile-flow" role="status">
          טוען…
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
