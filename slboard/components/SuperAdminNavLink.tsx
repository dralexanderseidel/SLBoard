'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

export function SuperAdminNavLink() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/super-admin/check', { credentials: 'include' });
        const data = (await res.json()) as { superAdmin?: boolean };
        if (!cancelled && data.superAdmin) setShow(true);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;

  return (
    <Link
      href="/super-admin"
      className="rounded-full px-3 py-1 text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-950/60"
    >
      Super-Admin
    </Link>
  );
}
