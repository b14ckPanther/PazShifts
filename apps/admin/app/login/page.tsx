'use client';

import React, { useActionState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { t } from '@yellowshifts/i18n';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Input,
  Alert,
  Container,
  Badge,
} from '@yellowshifts/ui';
import { PlatformAdminIcon, UserIcon, LockIcon, ArrowLeftIcon } from '@yellowshifts/icons';
import { loginAction, type AuthActionResult } from '../actions/auth';

function LoginFormContent() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '';

  const [state, formAction, isPending] = useActionState<AuthActionResult | null, FormData>(
    loginAction,
    null
  );

  return (
    <Card>
      <form action={formAction}>
        <input type="hidden" name="next" value={nextPath} />

        <CardHeader>
          <CardTitle>{t('auth.loginAdminTitle')}</CardTitle>
          <CardDescription>{t('auth.loginSubtitle')}</CardDescription>
        </CardHeader>

        <CardContent>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {state?.error && (
              <Alert variant="danger" title={t('common.status')}>
                {state.error}
              </Alert>
            )}

            <Input
              id="admin-email"
              name="email"
              type="email"
              label={t('auth.emailLabel')}
              placeholder={t('auth.emailPlaceholder')}
              isRequired
              autoComplete="email"
              rightIcon={<UserIcon size={18} />}
              disabled={isPending}
            />

            <Input
              id="admin-password"
              name="password"
              type="password"
              label={t('auth.passwordLabel')}
              placeholder={t('auth.passwordPlaceholder')}
              isRequired
              autoComplete="current-password"
              rightIcon={<LockIcon size={18} />}
              disabled={isPending}
            />
          </div>
        </CardContent>

        <CardFooter>
          <Button
            type="submit"
            variant="primary"
            fullWidth
            isLoading={isPending}
            leftIcon={<ArrowLeftIcon size={18} />}
          >
            {t('auth.submitLogin')}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function AdminLoginPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'var(--ys-color-surface-base, #F8FAFC)',
        padding: '24px 16px',
        direction: 'rtl',
      }}
    >
      <Container size="sm">
        {/* Brand Header */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: '32px',
            textAlign: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: 'var(--ys-radius-md)',
              backgroundColor: 'var(--ys-color-brand-yellow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--ys-color-text-primary)',
              boxShadow: '0 4px 12px rgba(252, 188, 0, 0.2)',
            }}
          >
            <PlatformAdminIcon size={32} />
          </div>

          <div>
            <h1
              style={{
                fontSize: '26px',
                fontWeight: 700,
                color: 'var(--ys-color-text-primary, #111827)',
                margin: 0,
              }}
            >
              {t('brand.name')} Admin
            </h1>
            <p
              style={{
                fontSize: '14px',
                color: '#6B7280',
                margin: '4px 0 0 0',
              }}
            >
              פורטל ניהול רב-תחנתי ומנהל מערכת ראשי
            </p>
          </div>

          <Badge variant="brandYellow" dot>
            כניסה מאובטחת למנהלי מערכת ותחנות
          </Badge>
        </div>

        {/* Login Card Form */}
        <Suspense
          fallback={
            <Card>
              <CardContent style={{ padding: '32px', textAlign: 'center', color: '#6B7280' }}>
                טוען...
              </CardContent>
            </Card>
          }
        >
          <LoginFormContent />
        </Suspense>

        {/* Security & System Info Footer */}
      </Container>
    </main>
  );
}
