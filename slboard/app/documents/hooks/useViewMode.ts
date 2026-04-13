import { useEffect, useState } from 'react';
import type { ViewMode } from '../types';

const STORAGE_KEY = 'documents_view_mode';

export function useViewMode(defaultMode: ViewMode = 'compact'): [ViewMode, (m: ViewMode) => void] {
  const [viewMode, setViewMode] = useState<ViewMode>(defaultMode);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'table' || stored === 'cards' || stored === 'compact') {
        setViewMode(stored);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, viewMode);
    } catch {
      // ignore
    }
  }, [viewMode]);

  return [viewMode, setViewMode];
}
