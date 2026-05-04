import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiUserError, type SerializedApiError } from '@/lib/apiUserError';
import type { DocumentFilters } from './useDocumentFilters';
import type { DocumentListItem, SortDir, SortField } from '../types';

export type DocumentListMeta = {
  /** Anzahl der nach Berechtigungsfilter sichtbaren Einträge in dieser Antwort */
  total: number;
  /** true, wenn die DB-Abfrage am Abruflimit war (weitere Zeilen in der DB möglich) */
  truncated: boolean;
};

type UseDocumentListResult = {
  docs: DocumentListItem[];
  setDocs: React.Dispatch<React.SetStateAction<DocumentListItem[]>>;
  loading: boolean;
  error: SerializedApiError | null;
  listMeta: DocumentListMeta | null;
  reload: () => void;
  /** In-flight Ladeanfragen abbrechen (für Bulk-Aktionen) */
  cancelInFlight: () => void;
};

export function useDocumentList(
  filters: DocumentFilters,
  archiveView: boolean,
  sortField: SortField,
  sortDir: SortDir,
): UseDocumentListResult {
  const [docs, setDocs] = useState<DocumentListItem[]>([]);
  const [listMeta, setListMeta] = useState<DocumentListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<SerializedApiError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const loadSeqRef = useRef(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const cancelInFlight = useCallback(() => { loadSeqRef.current += 1; }, []);

  useEffect(() => {
    const seq = ++loadSeqRef.current;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setListMeta(null);

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
    if (filters.schulentwicklungFieldFilter.trim()) {
      params.set('auftragfeld', filters.schulentwicklungFieldFilter.trim());
    }
    if (filters.schulentwicklungPrimaryFieldFilter.trim()) {
      params.set('sePrimary', filters.schulentwicklungPrimaryFieldFilter.trim());
    }
    if (filters.searchQuery.trim()) params.set('search', filters.searchQuery.trim());
    if (archiveView) params.set('archive', '1');
    params.set('sort', sortField);
    params.set('sortDir', sortDir);

    const url = `/api/documents${params.toString() ? `?${params.toString()}` : ''}`;

    const load = async () => {
      let res: Response;
      try {
        res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
      } catch {
        if (controller.signal.aborted) return;
        setError({ userMessage: 'Netzwerkfehler beim Laden.', detail: null });
        setDocs([]);
        setListMeta(null);
        setLoading(false);
        return;
      }

      if (seq !== loadSeqRef.current) return;

      const text = await res.text();
      if (!res.ok) {
        setError(ApiUserError.fromFailedResponse(res.status, text, 'Fehler beim Laden der Dokumente.').toJSON());
        setDocs([]);
        setListMeta(null);
        setLoading(false);
        return;
      }

      let json: { data?: DocumentListItem[]; meta?: { total?: number; truncated?: boolean }; error?: string };
      try {
        json = JSON.parse(text) as {
          data?: DocumentListItem[];
          meta?: { total?: number; truncated?: boolean };
          error?: string;
        };
      } catch {
        setError({
          userMessage: 'Ungültige Antwort beim Laden der Dokumentenliste.',
          detail: text.slice(0, 2000) + (text.length > 2000 ? '…' : ''),
        });
        setDocs([]);
        setListMeta(null);
        setLoading(false);
        return;
      }

      const rows = json.data ?? [];
      setDocs(rows);
      const m = json.meta;
      if (m && typeof m.total === 'number') {
        setListMeta({ total: m.total, truncated: !!m.truncated });
      } else {
        setListMeta({ total: rows.length, truncated: false });
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
    filters.schulentwicklungFieldFilter,
    filters.schulentwicklungPrimaryFieldFilter,
    filters.searchQuery,
    archiveView,
    sortField,
    sortDir,
    reloadKey,
  ]);

  return { docs, setDocs, loading, error, listMeta, reload, cancelInFlight };
}
