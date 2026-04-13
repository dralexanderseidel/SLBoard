import { useCallback, useEffect, useRef, useState } from 'react';
import type { DocumentFilters } from './useDocumentFilters';
import type { DocumentListItem } from '../types';

type UseDocumentListResult = {
  docs: DocumentListItem[];
  setDocs: React.Dispatch<React.SetStateAction<DocumentListItem[]>>;
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** In-flight Ladeanfragen abbrechen (für Bulk-Aktionen) */
  cancelInFlight: () => void;
};

export function useDocumentList(
  filters: DocumentFilters,
  archiveView: boolean,
): UseDocumentListResult {
  const [docs, setDocs] = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const loadSeqRef = useRef(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const cancelInFlight = useCallback(() => { loadSeqRef.current += 1; }, []);

  useEffect(() => {
    const seq = ++loadSeqRef.current;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (filters.typeFilter) params.set('type', filters.typeFilter);
    if (filters.responsibleUnitFilter) params.set('responsibleUnit', filters.responsibleUnitFilter);
    if (filters.statusFilters.length > 0) params.set('status', filters.statusFilters.join(','));
    if (filters.protectionFilter) params.set('protectionClass', filters.protectionFilter);
    if (filters.reachScopeFilters.length > 0) params.set('reachScope', filters.reachScopeFilters.join(','));
    if (filters.participationFilter.trim()) params.set('participation', filters.participationFilter.trim());
    if (filters.gremiumFilter.trim()) params.set('gremium', filters.gremiumFilter.trim());
    if (filters.reviewFilter) params.set('review', filters.reviewFilter);
    if (filters.summaryFilter) params.set('summary', filters.summaryFilter);
    if (filters.steeringFilter) params.set('steering', filters.steeringFilter);
    if (filters.searchQuery.trim()) params.set('search', filters.searchQuery.trim());
    if (archiveView) params.set('archive', '1');

    const url = `/api/documents${params.toString() ? `?${params.toString()}` : ''}`;

    const load = async () => {
      let res: Response;
      try {
        res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
      } catch {
        if (controller.signal.aborted) return;
        setError('Netzwerkfehler beim Laden.');
        setLoading(false);
        return;
      }

      if (seq !== loadSeqRef.current) return;

      const json = (await res.json()) as { data?: DocumentListItem[]; error?: string };
      if (!res.ok) {
        setError(json.error ?? 'Fehler beim Laden.');
        setDocs([]);
      } else {
        setDocs(json.data ?? []);
      }
      setLoading(false);
    };

    void load();
    return () => controller.abort();
  }, [
    filters.typeFilter,
    filters.responsibleUnitFilter,
    filters.statusFilters,
    filters.protectionFilter,
    filters.reachScopeFilters,
    filters.participationFilter,
    filters.gremiumFilter,
    filters.reviewFilter,
    filters.summaryFilter,
    filters.steeringFilter,
    filters.searchQuery,
    archiveView,
    reloadKey,
  ]);

  return { docs, setDocs, loading, error, reload, cancelInFlight };
}
