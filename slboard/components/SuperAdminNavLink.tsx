'use client';

import React from 'react';
import { AppNavLink } from './AppNavLink';
import { useHeaderAccess } from './HeaderAccessContext';

export function SuperAdminNavLink() {
  const { access, accessLoading } = useHeaderAccess();

  if (accessLoading || !access?.superAdmin) return null;

  return (
    <AppNavLink
      href="/super-admin"
      className="rounded-full px-3 py-1 text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-950/60"
    >
      Super-Admin
    </AppNavLink>
  );
}
