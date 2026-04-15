import { useState } from 'react';

export type ReindexState = {
  loading: boolean;
  progress: string | null;
  error: string | null;
  message: string | null;
};

export function useReindex() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleReindex = async () => {
    const ok = window.confirm(
      'Dokumente neu indizieren?\n\nDies extrahiert Text aus Dateien und setzt search_text/keywords.\nJe nach Anzahl und Dateigröße kann das etwas dauern.',
    );
    if (!ok) return;
    setLoading(true);
    setProgress('Starte…');
    setError(null);
    setMessage(null);
    try {
      let offset = 0;
      let totalOk = 0;
      let totalFailed = 0;
      const limit = 10;
      for (let i = 0; i < 200; i++) {
        setProgress(`Bearbeite Batch ab Offset ${offset}…`);
        const res = await fetch('/api/admin/reindex', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offset, limit }),
        });
        const data = (await res.json()) as { ok?: number; failed?: number; nextOffset?: number; done?: boolean; error?: string };
        if (!res.ok) throw new Error(data.error ?? 'Reindex fehlgeschlagen.');
        totalOk += data.ok ?? 0;
        totalFailed += data.failed ?? 0;
        offset = data.nextOffset ?? offset + limit;
        setProgress(`Fortschritt: ${totalOk} ok, ${totalFailed} Fehler…`);
        if (data.done) break;
      }
      setMessage(`Reindex abgeschlossen. OK: ${totalOk}, Fehler: ${totalFailed}.`);
      setProgress(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reindex fehlgeschlagen.');
      setProgress(null);
    } finally {
      setLoading(false);
    }
  };

  return { loading, progress, error, message, handleReindex };
}
