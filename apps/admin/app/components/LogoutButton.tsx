'use client';

import React, { useTransition } from 'react';
import { Button } from '@yellowshifts/ui';
import { LogOutIcon } from '@yellowshifts/icons';
import { t } from '@yellowshifts/i18n';
import { logoutAction } from '../actions/auth';

export const LogoutButton: React.FC<{ variant?: 'outline' | 'ghost' | 'secondary' }> = ({
  variant = 'outline',
}) => {
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    startTransition(async () => {
      await logoutAction();
    });
  };

  return (
    <Button
      variant={variant}
      size="sm"
      isLoading={isPending}
      onClick={handleLogout}
      leftIcon={<LogOutIcon size={16} />}
    >
      {t('auth.logout')}
    </Button>
  );
};
