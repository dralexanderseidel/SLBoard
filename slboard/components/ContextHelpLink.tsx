'use client';

import Link from 'next/link';

type Props = {
  href: string;
  children: React.ReactNode;
  className?: string;
};

/** Kontext-Hilfe (P3-24): kompakter Link, typisch neben Seitenüberschriften. */
export function ContextHelpLink({ href, children, className = '' }: Props) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={`whitespace-nowrap text-[11px] font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400 ${className}`.trim()}
    >
      {children}
    </Link>
  );
}
