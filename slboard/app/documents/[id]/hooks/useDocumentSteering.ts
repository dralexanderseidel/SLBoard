import { useEffect, useState } from 'react';
import { readApiJson } from '@/lib/readApiJson';
import type { DocumentDetail, SteeringAnalysis, SteeringTodosResult } from '../types';

type UseDocumentSteeringResult = {
  steeringAnalysis: SteeringAnalysis | null;
  setSteeringAnalysis: React.Dispatch<React.SetStateAction<SteeringAnalysis | null>>;
  steeringUpdatedAt: string | null;
  steeringLoading: boolean;
  steeringError: string | null;
  handleSteeringAnalysis: (force?: boolean) => Promise<void>;
  steeringTodos: SteeringTodosResult | null;
  setSteeringTodos: React.Dispatch<React.SetStateAction<SteeringTodosResult | null>>;
  steeringTodosUpdatedAt: string | null;
  todosLoading: boolean;
  todosError: string | null;
  handleSteeringTodos: (force?: boolean) => Promise<void>;
};

export function useDocumentSteering(
  id: string | undefined,
  doc: DocumentDetail | null,
): UseDocumentSteeringResult {
  const [steeringAnalysis, setSteeringAnalysis] = useState<SteeringAnalysis | null>(null);
  const [steeringUpdatedAt, setSteeringUpdatedAt] = useState<string | null>(null);
  const [steeringLoading, setSteeringLoading] = useState(false);
  const [steeringError, setSteeringError] = useState<string | null>(null);

  const [steeringTodos, setSteeringTodos] = useState<SteeringTodosResult | null>(null);
  const [steeringTodosUpdatedAt, setSteeringTodosUpdatedAt] = useState<string | null>(null);
  const [todosLoading, setTodosLoading] = useState(false);
  const [todosError, setTodosError] = useState<string | null>(null);

  // Initialisierung aus dem geladenen Dokument
  useEffect(() => {
    setSteeringAnalysis((doc?.steering_analysis as SteeringAnalysis | null) ?? null);
    setSteeringUpdatedAt(doc?.steering_analysis_updated_at ?? null);
    setSteeringTodos((doc?.steering_todos as SteeringTodosResult | null) ?? null);
    setSteeringTodosUpdatedAt(doc?.steering_todos_updated_at ?? null);
  }, [
    doc?.id,
    doc?.steering_analysis,
    doc?.steering_analysis_updated_at,
    doc?.steering_todos,
    doc?.steering_todos_updated_at,
  ]);

  const handleSteeringAnalysis = async (force = false) => {
    if (!id) return;
    setSteeringLoading(true);
    setSteeringError(null);
    try {
      const res = await fetch(`/api/documents/${id}/steering-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ force }),
      });
      const data = await readApiJson<{
        analysis?: SteeringAnalysis;
        error?: string;
        updatedAt?: string | null;
      }>(res);
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

  const handleSteeringTodos = async (force = false) => {
    if (!id) return;
    setTodosLoading(true);
    setTodosError(null);
    try {
      const res = await fetch(`/api/documents/${id}/steering-todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ force }),
      });
      const data = await readApiJson<{
        todos?: SteeringTodosResult;
        error?: string;
        updatedAt?: string | null;
      }>(res);
      if (!res.ok || !data.todos) {
        throw new Error(data.error ?? 'Aufgaben konnten nicht extrahiert werden.');
      }
      setSteeringTodos(data.todos);
      if (data.updatedAt !== undefined) {
        setSteeringTodosUpdatedAt(data.updatedAt ?? null);
      } else if (force) {
        setSteeringTodosUpdatedAt(new Date().toISOString());
      }
    } catch (e) {
      setTodosError(e instanceof Error ? e.message : 'Aufgaben konnten nicht extrahiert werden.');
    } finally {
      setTodosLoading(false);
    }
  };

  return {
    steeringAnalysis,
    setSteeringAnalysis,
    steeringUpdatedAt,
    steeringLoading,
    steeringError,
    handleSteeringAnalysis,
    steeringTodos,
    setSteeringTodos,
    steeringTodosUpdatedAt,
    todosLoading,
    todosError,
    handleSteeringTodos,
  };
}
