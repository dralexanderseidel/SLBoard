import { useState } from 'react';
import type { DocumentDetail } from '../types';

type DocSource = { documentId: string; title: string; snippet: string };

type UseDocumentAskResult = {
  docQuestionInput: string;
  setDocQuestionInput: React.Dispatch<React.SetStateAction<string>>;
  docQuestion: string;
  docAnswer: string | null;
  docSources: DocSource[];
  docAskLoading: boolean;
  docAskError: string | null;
  handleAskAboutThisDocument: () => Promise<void>;
};

export function useDocumentAsk(
  id: string | undefined,
  doc: DocumentDetail | null,
): UseDocumentAskResult {
  const [docQuestionInput, setDocQuestionInput] = useState('');
  const [docQuestion, setDocQuestion] = useState('');
  const [docAnswer, setDocAnswer] = useState<string | null>(null);
  const [docSources, setDocSources] = useState<DocSource[]>([]);
  const [docAskLoading, setDocAskLoading] = useState(false);
  const [docAskError, setDocAskError] = useState<string | null>(null);

  const handleAskAboutThisDocument = async () => {
    const q = docQuestionInput.trim();
    if (!doc || !id || !q) return;
    setDocAskLoading(true);
    setDocAskError(null);
    setDocAnswer(null);
    setDocSources([]);
    setDocQuestion(q);

    try {
      const checkRes = await fetch(`/api/documents/${id}/extract-text`);
      const checkData = (await checkRes.json()) as { hasText?: boolean; error?: string };
      if (!checkRes.ok) throw new Error(checkData.error ?? 'OCR-/Extraktions-Check fehlgeschlagen.');
      if (!checkData.hasText) {
        setDocAskError(
          'Dieses Dokument enthält keinen extrahierbaren Text (vermutlich Scan-PDF). Für sinnvolle Antworten wird OCR benötigt.',
        );
        setDocAskLoading(false);
        return;
      }
    } catch {
      // Fortfahren, falls der Check fehlschlägt
    }

    try {
      const res = await fetch('/api/ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, documentIds: [id] }),
      });
      const data = (await res.json()) as {
        answer?: string;
        sources?: DocSource[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? 'Fehler bei der KI-Anfrage.');
      setDocAnswer(data.answer ?? null);
      setDocSources(data.sources ?? []);
    } catch (e) {
      setDocAskError(e instanceof Error ? e.message : 'Fehler bei der KI-Anfrage.');
    } finally {
      setDocAskLoading(false);
    }
  };

  return {
    docQuestionInput,
    setDocQuestionInput,
    docQuestion,
    docAnswer,
    docSources,
    docAskLoading,
    docAskError,
    handleAskAboutThisDocument,
  };
}
