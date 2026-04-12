'use client';

import React from 'react';
import Link from 'next/link';
import { useHeaderAccess } from './HeaderAccessContext';

export function SuperAdminNavLink() {
  const { access, accessLoading } = useHeaderAccess();

  if (accessLoading || !access?.superAdmin) return null;

  return (
    <Link
      href="/super-admin"
      className="rounded-full px-3 py-1 text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-950/60"
    >
      Super-Admin
    </Link>
  );
}
