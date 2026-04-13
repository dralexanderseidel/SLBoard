import { useEffect, useState } from 'react';
import type { DocumentDetail } from '../types';

type UseDocumentSummaryResult = {
  summary: string | null;
  setSummary: React.Dispatch<React.SetStateAction<string | null>>;
  summaryUpdatedAt: string | null;
  setSummaryUpdatedAt: React.Dispatch<React.SetStateAction<string | null>>;
  summaryLoading: boolean;
  summaryError: string | null;
  handleSummarize: () => Promise<void>;
};

export function useDocumentSummary(
  id: string | undefined,
  doc: DocumentDetail | null,
  docTypeLabel: (code: string) => string,
): UseDocumentSummaryResult {
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryUpdatedAt, setSummaryUpdatedAt] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Initialisierung aus dem geladenen Dokument (auch bei Reload nach Versions-Upload)
  useEffect(() => {
    setSummary(doc?.summary ?? null);
    setSummaryUpdatedAt(doc?.summary_updated_at ?? null);
  }, [doc?.id, doc?.summary, doc?.summary_updated_at]);

  const handleSummarize = async () => {
    if (!doc || !id) return;
    setSummaryLoading(true);
    setSummaryError(null);

    try {
      const checkRes = await fetch(`/api/documents/${id}/extract-text`);
      const checkData = (await checkRes.json()) as { hasText?: boolean; error?: string };
      if (!checkRes.ok) throw new Error(checkData.error ?? 'OCR-/Extraktions-Check fehlgeschlagen.');
      if (!checkData.hasText) {
        setSummaryError(
          'Dieses Dokument enthält keinen extrahierbaren Text (vermutlich Scan-PDF). Für sinnvolle Ergebnisse wird OCR benötigt. Bitte lade eine "suchbare" PDF oder eine Text-/DOCX-Version hoch.',
        );
        setSummaryLoading(false);
        return;
      }
    } catch {
      // Falls der Check fehlschlägt, machen wir weiter (LLM kann ggf. mit Metadaten arbeiten)
    }

    const payload = {
      documentId: id,
      title: doc.title,
      type: docTypeLabel(doc.document_type_code),
      createdAt: new Date(doc.created_at).toLocaleDateString('de-DE'),
      text:
        doc.legal_reference ??
        `Dieses Dokument ist ein ${docTypeLabel(doc.document_type_code)}. Verantwortlich ist ${doc.responsible_unit}${
          doc.gremium ? `, Beschlussgremium: ${doc.gremium}` : ''
        }.`,
    };

    const run = async (attempt: number) => {
      try {
        const res = await fetch('/api/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (!res.ok) {
          const isRateLimited =
            res.status === 429 ||
            (typeof data?.details?.error?.code === 'number' && data.details.error.code === 429) ||
            (typeof data?.details?.error?.metadata?.raw === 'string' &&
              data.details.error.metadata.raw.toLowerCase().includes('rate-limited'));

          if (isRateLimited && attempt === 1) {
            setSummaryError(
              'Das verwendete kostenlose KI-Modell ist aktuell ausgelastet. Es wird automatisch ein zweiter Versuch gestartet …',
            );
            await new Promise((resolve) => setTimeout(resolve, 1500));
            await run(2);
            return;
          }

          const msgBase = data.error || 'Fehler bei der KI-Zusammenfassung. Bitte versuchen Sie es später erneut.';
          const detailsText =
            typeof data.details === 'string' ? data.details : data.details ? JSON.stringify(data.details) : '';
          setSummaryError(detailsText ? `${msgBase}: ${detailsText}` : msgBase);
        } else {
          setSummary(data.summary);
          setSummaryError(null);
          setSummaryUpdatedAt(new Date().toISOString());
        }
      } catch (e) {
        setSummaryError(e instanceof Error ? e.message : 'Fehler bei der KI-Zusammenfassung.');
      } finally {
        setSummaryLoading(false);
      }
    };

    await run(1);
  };

  return {
    summary,
    setSummary,
    summaryUpdatedAt,
    setSummaryUpdatedAt,
    summaryLoading,
    summaryError,
    handleSummarize,
  };
}
