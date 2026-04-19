'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';

type Props = Omit<ComponentProps<typeof Link>, 'scroll' | 'prefetch'> & {
  prefetch?: boolean;
};

/** Kopfzeile & Co.: `scroll={false}` + Root-`ScrollToTop` statt Next.js’ Scroll/Fokus nach Client-Navigation. */
export function AppNavLink({ prefetch = false, ...props }: Props) {
  /** Prefetch aus: vermeidet parallele Middleware-Läufe / Refresh-Races mit Supabase-Cookies (Prod). */
  return <Link {...props} prefetch={prefetch} scroll={false} />;
}
