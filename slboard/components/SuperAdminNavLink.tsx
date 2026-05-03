'use client';

import React from 'react';
import type { ComponentProps } from 'react';
import { AppNavLink } from './AppNavLink';
import { NavIconSuperAdmin } from './navLinkIcons';
import { useHeaderAccess } from './HeaderAccessContext';

const DEFAULT_CLASS =
  'inline-flex items-center gap-2 rounded-full px-3 py-1 text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-950/60';

type Props = {
  /** Wenn gesetzt (z. B. Kopfzeilen-„Mehr“-Menü), ersetzt die Standard-Pill-Klassen vollständig. */
  className?: string;
  onClick?: ComponentProps<typeof AppNavLink>['onClick'];
  role?: ComponentProps<typeof AppNavLink>['role'];
};

export function SuperAdminNavLink({ className, onClick, role }: Props = {}) {
  const { access, accessLoading } = useHeaderAccess();

  if (accessLoading || !access?.superAdmin) return null;

  return (
    <AppNavLink
      href="/super-admin"
      className={className ?? DEFAULT_CLASS}
      onClick={onClick}
      role={role}
    >
      <NavIconSuperAdmin className="size-3.5 shrink-0 opacity-90 sm:size-4" />
      Super-Admin
    </AppNavLink>
  );
}
