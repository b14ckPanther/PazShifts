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
import { StationIcon, UserIcon, LockIcon, ArrowLeftIcon, NfcIcon } from '@yellowshifts/icons';
import { loginAction, type AuthActionResult } from '../actions/auth';

function LoginFormContent() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '';
  const isNfcRedirect = nextPath.startsWith('/nfc/');

  const [state, formAction, isPending] = useActionState<AuthActionResult | null, FormData>(
    loginAction,
    null
  );

  return (
    <Card>
      <form action={formAction}>
        <input type="hidden" name="next" value={nextPath} />

        <CardHeader>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px',
            }}
          >
            <CardTitle>{t('auth.loginTitle')}</CardTitle>
            {isNfcRedirect && (
              <Badge variant="brandYellow" dot>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <NfcIcon size={12} />
                  סריקת NFC
                </span>
              </Badge>
            )}
          </div>
          <CardDescription>
            {isNfcRedirect
              ? 'סריקת תג NFC זוהתה בהצלחה. התחבר לחשבונך כדי לבצע פעולת כניסה או יציאה.'
              : t('auth.loginSubtitle')}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {state?.error && (
              <Alert variant="danger" title={t('common.status')}>
                {state.error}
              </Alert>
            )}

            <Input
              id="email"
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
              id="password"
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
            {isNfcRedirect ? 'התחבר והמשך לדיווח נוכחות' : t('auth.submitLogin')}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function WebLoginPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'var(--ys-color-surface-base)',
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
              color: 'var(--ys-color-brand-crimson)',
              boxShadow: 'var(--ys-shadow-subtle)',
            }}
          >
            <StationIcon size={32} />
          </div>

          <div>
            <h1
              style={{
                fontSize: '26px',
                fontWeight: 700,
                color: 'var(--ys-color-text-primary)',
                margin: 0,
              }}
            >
              {t('brand.name')}
            </h1>
            <p
              style={{
                fontSize: '14px',
                color: 'var(--ys-color-text-secondary)',
                margin: '4px 0 0 0',
              }}
            >
              {t('brand.tagline')}
            </p>
          </div>

          <Badge variant="brandYellow" dot>
            פורטל עובדים ומנהלי משמרת
          </Badge>
        </div>

        {/* Login Card Form with Suspense for useSearchParams */}
        <Suspense
          fallback={
            <Card>
              <CardContent style={{ padding: '32px', textAlign: 'center', color: '#9CA3AF' }}>
                טוען...
              </CardContent>
            </Card>
          }
        >
          <LoginFormContent />
        </Suspense>
      </Container>
    </main>
  );
}
