'use client';

import React from 'react';
import { Button } from '@yellowshifts/ui';
import { LogOutIcon } from '@yellowshifts/icons';
import { t } from '@yellowshifts/i18n';

export const LogoutButton: React.FC<{ variant?: 'outline' | 'ghost' | 'secondary' }> = ({
  variant = 'outline',
}) => (
  <form action="/auth/logout" method="post">
    <Button type="submit" variant={variant} size="sm" leftIcon={<LogOutIcon size={16} />}>
      {t('auth.logout')}
    </Button>
  </form>
);
