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

export type HeaderMeAccess = {
  schoolNumber: string | null;
  schoolName: string | null;
  orgUnit: string | null;
  roles: string[];
  superAdmin: boolean;
  accountInactive: boolean;
  featureAiEnabled: boolean;
  featureDraftsEnabled: boolean;
  /** Server-seitig begrenzt; für Client-Validierung von Uploads. */
  effectiveMaxUploadBytes: number;
};

type HeaderAccessValue = {
  userEmail: string | null;
  sessionLoading: boolean;
  access: HeaderMeAccess | null;
  accessLoading: boolean;
};

const HeaderAccessContext = createContext<HeaderAccessValue | null>(null);

export function HeaderAccessProvider({ children }: { children: React.ReactNode }) {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [access, setAccess] = useState<HeaderMeAccess | null>(null);
  const [accessLoading, setAccessLoading] = useState(false);

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
      const data = (await res.json()) as {
        schoolNumber?: string | null;
        schoolName?: string | null;
        orgUnit?: string | null;
        roles?: string[];
        superAdmin?: boolean;
        accountInactive?: boolean;
        featureAiEnabled?: boolean;
        featureDraftsEnabled?: boolean;
        effectiveMaxUploadBytes?: number;
      };
      const effBytes =
        typeof data.effectiveMaxUploadBytes === 'number' && data.effectiveMaxUploadBytes > 0
          ? data.effectiveMaxUploadBytes
          : 20 * 1024 * 1024;
      setAccess({
        schoolNumber: data.schoolNumber ?? null,
        schoolName: data.schoolName ?? null,
        orgUnit: data.orgUnit ?? null,
        roles: Array.isArray(data.roles) ? data.roles : [],
        superAdmin: !!data.superAdmin,
        accountInactive: !!data.accountInactive,
        featureAiEnabled: data.featureAiEnabled !== false,
        featureDraftsEnabled: data.featureDraftsEnabled !== false,
        effectiveMaxUploadBytes: effBytes,
      });
    } catch {
      setAccess(null);
    } finally {
      setAccessLoading(false);
    }
  }, []);

  useEffect(() => {
    const sync = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const email = session?.user?.email ?? null;
      setUserEmail(email);
      setSessionLoading(false);
      await fetchAccess(email);
    };
    void sync();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const email = session?.user?.email ?? null;
      setUserEmail(email);
      setSessionLoading(false);
      void fetchAccess(email);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchAccess]);

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
