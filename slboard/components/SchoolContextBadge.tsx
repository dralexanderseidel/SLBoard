'use client';

import React, { useEffect, useState } from 'react';

type MeAccess = {
  schoolNumber: string | null;
  schoolName: string | null;
};

export function SchoolContextBadge() {
  const [access, setAccess] = useState<MeAccess | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/me/access');
        if (!res.ok) return;
        const data = (await res.json()) as MeAccess;
        setAccess(data);
      } catch {
        // Anzeige ist optional.
      }
    };
    void load();
  }, []);

  if (!access?.schoolNumber) return null;

  return (
    <span className="inline-flex max-w-[min(18rem,42vw)] items-center truncate rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1 text-xs font-medium leading-tight text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
      {access.schoolName ? `${access.schoolName} (${access.schoolNumber})` : access.schoolNumber}
    </span>
  );
}

