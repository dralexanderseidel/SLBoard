'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  type HeaderMeAccess,
  type MeAccessApiPayload,
  headerMeAccessFromApiPayload,
} from '../lib/meAccessApi';

export type { HeaderMeAccess };

type HeaderAccessValue = {
  userEmail: string | null;
  sessionLoading: boolean;
  access: HeaderMeAccess | null;
  accessLoading: boolean;
};

const HeaderAccessContext = createContext<HeaderAccessValue | null>(null);

type ProviderProps = {
  children: React.ReactNode;
  /**
   * true: Root-Layout hat Session + Zugriff per RSC geladen — Header kann sofort Schulname zeigen.
   * Dann entfällt der erste /api/me/access-Roundtrip, solange Browser-Session mit Server übereinstimmt.
   */
  accessPreloaded?: boolean;
  initialUserEmail?: string | null;
  initialAccess?: HeaderMeAccess | null;
};

export function HeaderAccessProvider({
  children,
  accessPreloaded = false,
  initialUserEmail = null,
  initialAccess = null,
}: ProviderProps) {
  const [userEmail, setUserEmail] = useState<string | null>(() =>
    accessPreloaded ? initialUserEmail ?? null : null,
  );
  const [sessionLoading, setSessionLoading] = useState(() => !accessPreloaded);
  const [access, setAccess] = useState<HeaderMeAccess | null>(() =>
    accessPreloaded ? initialAccess ?? null : null,
  );
  const [accessLoading, setAccessLoading] = useState(() => {
    if (!accessPreloaded) return false;
    return initialUserEmail != null && initialAccess == null;
  });

  const fetchAccess = useCallback(async (email: string | null) => {
    if (!email) {
      setAccess(null);
      setAccessLoading(false);
      return;
    }
    setAccessLoading(true);
    try {
      const res = await fetch('/api/me/access', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) {
        setAccess(null);
        return;
      }
      const data = (await res.json()) as MeAccessApiPayload;
      setAccess(headerMeAccessFromApiPayload(data));
    } catch {
      setAccess(null);
    } finally {
      setAccessLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      const email = session?.user?.email ?? null;
      setUserEmail(email);
      setSessionLoading(false);

      const sameAsServerPreload =
        accessPreloaded &&
        (email ?? null) === (initialUserEmail ?? null) &&
        initialAccess != null &&
        email != null;

      if (sameAsServerPreload) {
        return;
      }
      await fetchAccess(email);
    };
    void sync();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const email = session?.user?.email ?? null;
      setUserEmail(email);
      setSessionLoading(false);
      if (
        event === 'INITIAL_SESSION' &&
        accessPreloaded &&
        email &&
        email === (initialUserEmail ?? '') &&
        initialAccess != null
      ) {
        return;
      }
      void fetchAccess(email);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [fetchAccess, accessPreloaded, initialUserEmail, initialAccess]);

  const value = useMemo(
    () => ({ userEmail, sessionLoading, access, accessLoading }),
    [userEmail, sessionLoading, access, accessLoading],
  );

  return <HeaderAccessContext.Provider value={value}>{children}</HeaderAccessContext.Provider>;
}

export function useHeaderAccess(): HeaderAccessValue {
  const ctx = useContext(HeaderAccessContext);
  if (!ctx) {
    throw new Error('useHeaderAccess must be used within HeaderAccessProvider');
  }
  return ctx;
}
