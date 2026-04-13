import { useEffect, useState } from 'react';
import type { DocumentDetail, SteeringAnalysis } from '../types';

type UseDocumentSteeringResult = {
  steeringAnalysis: SteeringAnalysis | null;
  setSteeringAnalysis: React.Dispatch<React.SetStateAction<SteeringAnalysis | null>>;
  steeringUpdatedAt: string | null;
  steeringLoading: boolean;
  steeringError: string | null;
  handleSteeringAnalysis: (force?: boolean) => Promise<void>;
};

export function useDocumentSteering(
  id: string | undefined,
  doc: DocumentDetail | null,
): UseDocumentSteeringResult {
  const [steeringAnalysis, setSteeringAnalysis] = useState<SteeringAnalysis | null>(null);
  const [steeringUpdatedAt, setSteeringUpdatedAt] = useState<string | null>(null);
  const [steeringLoading, setSteeringLoading] = useState(false);
  const [steeringError, setSteeringError] = useState<string | null>(null);

  // Initialisierung aus dem geladenen Dokument
  useEffect(() => {
    setSteeringAnalysis((doc?.steering_analysis as SteeringAnalysis | null) ?? null);
    setSteeringUpdatedAt(doc?.steering_analysis_updated_at ?? null);
  }, [doc?.id, doc?.steering_analysis, doc?.steering_analysis_updated_at]);

  const handleSteeringAnalysis = async (force = false) => {
    if (!id) return;
    setSteeringLoading(true);
    setSteeringError(null);
    try {
      const res = await fetch(`/api/documents/${id}/steering-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });
      const data = (await res.json()) as {
        analysis?: SteeringAnalysis;
        error?: string;
        updatedAt?: string | null;
      };
      if (!res.ok || !data.analysis) {
        throw new Error(data.error ?? 'Analyse konnte nicht erstellt werden.');
      }
      setSteeringAnalysis(data.analysis);
      if (data.updatedAt !== undefined) {
        setSteeringUpdatedAt(data.updatedAt ?? null);
      } else if (force) {
        setSteeringUpdatedAt(new Date().toISOString());
      }
    } catch (e) {
      setSteeringError(e instanceof Error ? e.message : 'Analyse konnte nicht erstellt werden.');
    } finally {
      setSteeringLoading(false);
    }
  };

  return {
    steeringAnalysis,
    setSteeringAnalysis,
    steeringUpdatedAt,
    steeringLoading,
    steeringError,
    handleSteeringAnalysis,
  };
}
