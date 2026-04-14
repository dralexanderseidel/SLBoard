import { useEffect, useRef, useState } from 'react';
import type { VersionInfo, VersionRow } from '../types';

type UseDocumentPreviewResult = {
  version: VersionInfo | null;
  previewUrl: string | null;
  previewText: string | null;
  previewTextLoading: boolean;
};

export function useDocumentPreview(
  id: string | undefined,
  selectedVersionId: string | null,
  allVersions: VersionRow[],
  initialVersion: VersionInfo | null,
): UseDocumentPreviewResult {
  const [version, setVersion] = useState<VersionInfo | null>(initialVersion);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewTextLoading, setPreviewTextLoading] = useState(false);

  // Immer aktuellste allVersions lesen ohne sie als Effect-Dep zu deklarieren
  const allVersionsRef = useRef(allVersions);
  allVersionsRef.current = allVersions;

  // Synchronisiere version mit initialVersion, wenn das Dokument (neu) geladen wird
  useEffect(() => {
    setVersion(initialVersion);
  }, [initialVersion]);

  // Datei-URL + Versionsdaten laden — nur wenn sich die gewählte Version (ID) ändert,
  // nicht bei jedem reload() der allVersions-Referenz
  useEffect(() => {
    if (!id || !selectedVersionId) return;
    const chosen = allVersionsRef.current.find((v) => v.id === selectedVersionId);
    if (!chosen) return;

    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/documents/${id}/file?versionId=${encodeURIComponent(selectedVersionId)}`);
      const data = (await res.json()) as { signedUrl?: string; error?: string };
      if (cancelled) return;
      if (res.ok && data.signedUrl) {
        setPreviewUrl(data.signedUrl);
        setPreviewText(null);
        setVersion({
          id: chosen.id,
          version_number: chosen.version_number,
          created_at: chosen.created_at,
          file_uri: '',
          mime_type: chosen.mime_type ?? 'application/pdf',
        });
      } else {
        setPreviewUrl(null);
        setPreviewText(null);
      }
    })();
    return () => { cancelled = true; };
  }, [id, selectedVersionId]);

  // Text-Vorschau für text/plain laden
  useEffect(() => {
    if (!previewUrl || version?.mime_type !== 'text/plain') {
      setPreviewText(null);
      setPreviewTextLoading(false);
      return;
    }

    let cancelled = false;
    setPreviewTextLoading(true);
    (async () => {
      try {
        const res = await fetch(previewUrl);
        if (!res.ok) throw new Error('Textvorschau konnte nicht geladen werden.');
        const text = await res.text();
        if (!cancelled) setPreviewText(text);
      } catch {
        if (!cancelled) setPreviewText(null);
      } finally {
        if (!cancelled) setPreviewTextLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [previewUrl, version?.mime_type]);

  return { version, previewUrl, previewText, previewTextLoading };
}
