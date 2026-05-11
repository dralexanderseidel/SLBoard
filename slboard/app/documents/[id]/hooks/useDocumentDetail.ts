import { useCallback, useEffect, useState } from 'react';
import { ApiUserError, type SerializedApiError } from '@/lib/apiUserError';
import type { AuditEntry, DocumentComment, DocumentDetail, VersionInfo, VersionRow } from '../types';

type UseDocumentDetailResult = {
  doc: DocumentDetail | null;
  setDoc: React.Dispatch<React.SetStateAction<DocumentDetail | null>>;
  loading: boolean;
  error: SerializedApiError | null;
  /** Aktuell geladene Hauptversion (aus API-Antwort) – Startpunkt für useDocumentPreview */
  initialVersion: VersionInfo | null;
  allVersions: VersionRow[];
  selectedVersionId: string | null;
  setSelectedVersionId: React.Dispatch<React.SetStateAction<string | null>>;
  auditLog: AuditEntry[];
  setAuditLog: React.Dispatch<React.SetStateAction<AuditEntry[]>>;
  comments: DocumentComment[];
  setComments: React.Dispatch<React.SetStateAction<DocumentComment[]>>;
  reload: () => void;
};

export function useDocumentDetail(id: string | undefined): UseDocumentDetailResult {
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<SerializedApiError | null>(null);
  const [initialVersion, setInitialVersion] = useState<VersionInfo | null>(null);
  const [allVersions, setAllVersions] = useState<VersionRow[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [comments, setComments] = useState<DocumentComment[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/documents/${id}/detail`, {
          credentials: 'include',
          cache: 'no-store',
        });

        const text = await res.text();
        if (!res.ok) {
          setError(
            ApiUserError.fromFailedResponse(res.status, text, 'Fehler beim Laden des Dokuments.').toJSON(),
          );
          setDoc(null);
        } else {
          let json: {
            document?: DocumentDetail;
            currentVersion?: VersionInfo | null;
            versions?: VersionRow[];
            auditLog?: AuditEntry[];
            comments?: DocumentComment[];
          };
          try {
            json = JSON.parse(text) as typeof json;
          } catch {
            setError({
              userMessage: 'Ungültige Antwort vom Server.',
              detail: text.slice(0, 2000) + (text.length > 2000 ? '…' : ''),
            });
            setDoc(null);
            return;
          }
          const typed = json.document;
          if (!typed) {
            setError({
              userMessage: 'Ungültige Antwort vom Server (kein Dokument in der Antwort).',
              detail: text.slice(0, 2000) + (text.length > 2000 ? '…' : ''),
            });
            setDoc(null);
          } else {
            setDoc(typed);
            setInitialVersion(json.currentVersion ?? null);
            setSelectedVersionId(typed.current_version_id ?? null);
            setAllVersions(json.versions ?? []);
            setAuditLog(json.auditLog ?? []);
            setComments(Array.isArray(json.comments) ? json.comments : []);
          }
        }
      } catch {
        setError({ userMessage: 'Netzwerkfehler beim Laden des Dokuments.', detail: null });
        setDoc(null);
      } finally {
        setLoading(false);
      }
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
    comments,
    setComments,
    reload,
  };
}
