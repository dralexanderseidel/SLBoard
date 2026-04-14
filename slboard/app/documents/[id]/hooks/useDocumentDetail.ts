import { useCallback, useEffect, useState } from 'react';
import type { AuditEntry, DocumentDetail, VersionInfo, VersionRow } from '../types';

type UseDocumentDetailResult = {
  doc: DocumentDetail | null;
  setDoc: React.Dispatch<React.SetStateAction<DocumentDetail | null>>;
  loading: boolean;
  error: string | null;
  /** Aktuell geladene Hauptversion (aus API-Antwort) – Startpunkt für useDocumentPreview */
  initialVersion: VersionInfo | null;
  allVersions: VersionRow[];
  selectedVersionId: string | null;
  setSelectedVersionId: React.Dispatch<React.SetStateAction<string | null>>;
  auditLog: AuditEntry[];
  setAuditLog: React.Dispatch<React.SetStateAction<AuditEntry[]>>;
  reload: () => void;
};

export function useDocumentDetail(id: string | undefined): UseDocumentDetailResult {
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialVersion, setInitialVersion] = useState<VersionInfo | null>(null);
  const [allVersions, setAllVersions] = useState<VersionRow[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/documents/${id}`, {
        credentials: 'include',
        cache: 'no-store',
      });

      if (!res.ok) {
        let msg = 'Fehler beim Laden.';
        try {
          const j = (await res.json()) as { error?: string };
          if (res.status === 403) {
            msg = 'Keine Berechtigung, dieses Dokument einzusehen.';
          } else if (res.status === 404) {
            msg = 'Dieses Dokument ist nicht mehr verfügbar (gelöscht oder nicht gefunden).';
          } else if (j.error) {
            msg = j.error;
          }
        } catch {
          // ignore
        }
        setError(msg);
        setDoc(null);
      } else {
        const json = (await res.json()) as {
          document?: DocumentDetail;
          currentVersion?: VersionInfo | null;
        };
        const typed = json.document;
        if (!typed) {
          setError('Ungültige Antwort vom Server.');
          setDoc(null);
        } else {
          setDoc(typed);
          setInitialVersion(json.currentVersion ?? null);
          setSelectedVersionId(typed.current_version_id ?? null);

          const [verRes, auditRes] = await Promise.all([
            fetch(`/api/documents/${id}/versions`).catch(() => null),
            fetch(`/api/documents/${id}/audit`).catch(() => null),
          ]);

          const [verJson, auditJson] = await Promise.all([
            verRes?.ok ? (verRes.json() as Promise<{ data?: VersionRow[] }>) : Promise.resolve(null),
            auditRes?.ok ? (auditRes.json() as Promise<{ data?: AuditEntry[] }>) : Promise.resolve(null),
          ]);

          if (verJson?.data) setAllVersions(verJson.data);
          if (auditJson?.data) setAuditLog(auditJson.data);
        }
      }

      setLoading(false);
    };

    void load();
  }, [id, reloadKey]);

  return {
    doc,
    setDoc,
    loading,
    error,
    initialVersion,
    allVersions,
    selectedVersionId,
    setSelectedVersionId,
    auditLog,
    setAuditLog,
    reload,
  };
}
