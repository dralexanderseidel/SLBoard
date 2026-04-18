'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';

type Props = Omit<ComponentProps<typeof Link>, 'scroll'>;

/** Kopfzeile & Co.: `scroll={false}` + Root-`ScrollToTop` statt Next.js’ Scroll/Fokus nach Client-Navigation. */
export function AppNavLink(props: Props) {
  return <Link {...props} scroll={false} />;
}
