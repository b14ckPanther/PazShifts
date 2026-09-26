'use client';

import React from 'react';
import type { AuthenticatedUserContext } from '@yellowshifts/types';
import { AdminHeader } from './AdminHeader';

interface StationHeaderProps {
  station: {
    id: string;
    name: string;
    code: string;
  };
  context: AuthenticatedUserContext;
  pageTitle?: string;
  subtitle?: string;
}

/** Station pages: the admin canopy with this station's identity and section tabs. */
export const StationHeader: React.FC<StationHeaderProps> = ({
  station,
  context,
  pageTitle,
  subtitle,
}) => (
  <AdminHeader
    title={station.name}
    subtitle={subtitle || pageTitle || `קוד תחנה ${station.code}`}
    homeHref={`/stations/${encodeURIComponent(station.code)}`}
    homeLabel={`${station.name}, דף התחנה`}
    context={context}
    station={station}
  />
);
