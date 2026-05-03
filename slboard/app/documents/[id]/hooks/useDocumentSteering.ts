import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useState } from 'react';
import type { SerializedApiError } from '@/lib/apiUserError';
import { ApiUserError, serializeApiError } from '@/lib/apiUserError';
import { readApiJsonOk } from '@/lib/readApiJson';
import type { DocumentDetail, SteeringAnalysis, SteeringTodosResult } from '../types';

type UseDocumentSteeringResult = {
  steeringAnalysis: SteeringAnalysis | null;
  setSteeringAnalysis: React.Dispatch<React.SetStateAction<SteeringAnalysis | null>>;
  steeringUpdatedAt: string | null;
  steeringLoading: boolean;
  steeringError: SerializedApiError | null;
  handleSteeringAnalysis: (force?: boolean) => Promise<void>;
  steeringTodos: SteeringTodosResult | null;
  setSteeringTodos: React.Dispatch<React.SetStateAction<SteeringTodosResult | null>>;
  steeringTodosUpdatedAt: string | null;
  todosLoading: boolean;
  todosError: SerializedApiError | null;
  handleSteeringTodos: (force?: boolean) => Promise<void>;
};

export function useDocumentSteering(
  id: string | undefined,
  doc: DocumentDetail | null,
  setDoc?: Dispatch<SetStateAction<DocumentDetail | null>>,
) {
  const [steeringAnalysis, setSteeringAnalysis] = useState<SteeringAnalysis | null>(null);
  const [steeringUpdatedAt, setSteeringUpdatedAt] = useState<string | null>(null);
  const [steeringLoading, setSteeringLoading] = useState(false);
  const [steeringError, setSteeringError] = useState<SerializedApiError | null>(null);

  const [steeringTodos, setSteeringTodos] = useState<SteeringTodosResult | null>(null);
  const [steeringTodosUpdatedAt, setSteeringTodosUpdatedAt] = useState<string | null>(null);
  const [todosLoading, setTodosLoading] = useState(false);
  const [todosError, setTodosError] = useState<SerializedApiError | null>(null);

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
    doc?.schulentwicklung_primary_field,
    doc?.schulentwicklung_fields,
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
      const data = await readApiJsonOk<{
        analysis?: SteeringAnalysis;
        error?: string;
        updatedAt?: string | null;
        schulentwicklung_primary_field?: string | null;
        schulentwicklung_fields?: string[] | null;
      }>(res, 'Analyse konnte nicht erstellt werden.');
      if (!data.analysis) {
        throw new ApiUserError(
          typeof data.error === 'string' && data.error.trim()
            ? data.error.trim()
            : 'Analyse konnte nicht erstellt werden.',
          JSON.stringify(data),
          res.status,
        );
      }
      setSteeringAnalysis(data.analysis);
      const ts =
        data.updatedAt !== undefined && data.updatedAt !== null
          ? data.updatedAt
          : new Date().toISOString();
      setSteeringUpdatedAt(ts);
      if (setDoc) {
        setDoc((prev) =>
          prev
            ? {
                ...prev,
                steering_analysis: data.analysis ?? null,
                steering_analysis_updated_at: ts,
                schulentwicklung_primary_field: data.schulentwicklung_primary_field ?? null,
                schulentwicklung_fields: data.schulentwicklung_fields ?? null,
              }
            : prev,
        );
      }
    } catch (e) {
      setSteeringError(serializeApiError(e, 'Analyse konnte nicht erstellt werden.'));
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
      const data = await readApiJsonOk<{
        todos?: SteeringTodosResult;
        error?: string;
        updatedAt?: string | null;
      }>(res, 'Aufgaben konnten nicht extrahiert werden.');
      if (!data.todos) {
        throw new ApiUserError(
          typeof data.error === 'string' && data.error.trim()
            ? data.error.trim()
            : 'Aufgaben konnten nicht extrahiert werden.',
          JSON.stringify(data),
          res.status,
        );
      }
      setSteeringTodos(data.todos);
      if (data.updatedAt !== undefined) {
        setSteeringTodosUpdatedAt(data.updatedAt ?? null);
      } else if (force) {
        setSteeringTodosUpdatedAt(new Date().toISOString());
      }
    } catch (e) {
      setTodosError(serializeApiError(e, 'Aufgaben konnten nicht extrahiert werden.'));
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
