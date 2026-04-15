/**
 * Generischer LLM-Aufruf (OpenAI-kompatibel + Google Gemini).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { logLlmCall, type LlmUseCase } from './aiLlmCalls';

export type CallLlmUsageContext = {
  supabase: SupabaseClient;
  schoolNumber: string | null | undefined;
  useCase: LlmUseCase;
  metadata?: Record<string, unknown> | null;
};

const llmUrl = () => process.env.LLM_API_URL?.trim();
const llmKey = () => process.env.LLM_API_KEY?.trim();
const llmModel = () => process.env.LLM_MODEL?.trim();

export function isLlmConfigured(): boolean {
  return !!(llmUrl() && llmKey() && llmModel());
}

type CallLlmOptions = {
  timeoutMs?: number;
  maxAttempts?: number;
  /** Nach jeder erfolgreichen Provider-Antwort: Eintrag in ai_llm_calls. */
  usage?: CallLlmUsageContext;
};

const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_MAX_ATTEMPTS = 3;

/** Kapazitätsfehler brauchen deutlich längere Wartezeiten bis der Provider sich erholt. */
const CAPACITY_MAX_ATTEMPTS = 5;
const CAPACITY_BACKOFF_BASE_MS = 3_000; // 3s → 6s → 12s → 24s

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

/** 503/429 = Provider-Überlastung: langer Backoff nötig */
function isCapacityError(status: number): boolean {
  return status === 503 || status === 429;
}

function stringifyDetails(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw));
  } catch {
    return raw;
  }
}

export async function callLlm(
  systemPrompt: string,
  userPrompt: string,
  options?: CallLlmOptions
): Promise<string> {
  const url = llmUrl();
  const key = llmKey();
  const model = llmModel();
  const timeoutMs = Math.max(5_000, options?.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const maxAttempts = Math.max(1, options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);

  if (!url || !key || !model) {
    throw new Error('LLM-Umgebungsvariablen (LLM_API_URL, LLM_API_KEY, LLM_MODEL) sind nicht gesetzt.');
  }

  const isGoogleApi = url.includes('generativelanguage.googleapis.com');
  const fetchUrl = isGoogleApi
    ? `${url}${url.includes('?') ? '&' : '?'}key=${encodeURIComponent(key)}`
    : url;

  const baseFetchOptions: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  };

  if (isGoogleApi) {
    (baseFetchOptions as Record<string, unknown>).body = JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
        },
      ],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 2048,
      },
    });
  } else {
    (baseFetchOptions as Record<string, unknown>).headers = {
      ...((baseFetchOptions.headers as Record<string, string>) ?? {}),
      Authorization: `Bearer ${key}`,
    };
    (baseFetchOptions as Record<string, unknown>).body = JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });
  }

  let lastErr: Error | null = null;
  // Dynamisch erhöht beim ersten Kapazitätsfehler (503/429)
  let currentMaxAttempts = maxAttempts;
  let backoffBase = 600;

  for (let attempt = 1; attempt <= currentMaxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(fetchUrl, {
        ...baseFetchOptions,
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        const details = stringifyDetails(text);
        const err = new Error(`LLM-Anfrage fehlgeschlagen: ${res.status} - ${details}`);

        // Beim ersten Kapazitätsfehler: mehr Versuche + langer Backoff
        if (isCapacityError(res.status)) {
          currentMaxAttempts = Math.max(currentMaxAttempts, CAPACITY_MAX_ATTEMPTS);
          backoffBase = CAPACITY_BACKOFF_BASE_MS;
        }

        if (attempt < currentMaxAttempts && isRetryableStatus(res.status)) {
          const backoffMs = backoffBase * 2 ** (attempt - 1);
          await sleep(backoffMs);
          continue;
        }
        throw err;
      }

      const json = await res.json();
      const content = isGoogleApi
        ? json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        : json.choices?.[0]?.message?.content ?? '';

      if (options?.usage) {
        await logLlmCall(options.usage.supabase, {
          schoolNumber: options.usage.schoolNumber,
          useCase: options.usage.useCase,
          metadata: options.usage.metadata,
        });
      }

      return content;
    } catch (err: unknown) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      const wrapped = isAbort
        ? new Error(`LLM-Timeout nach ${timeoutMs}ms.`)
        : err instanceof Error
          ? err
          : new Error('Unbekannter LLM-Fehler.');
      lastErr = wrapped;

      // Auch über Fehlermeldung erkennen (nach res.ok-Block) und Backoff anpassen
      const isCapacity503 = /LLM-Anfrage fehlgeschlagen: (503|429)\b/.test(wrapped.message);
      if (isCapacity503) {
        currentMaxAttempts = Math.max(currentMaxAttempts, CAPACITY_MAX_ATTEMPTS);
        backoffBase = CAPACITY_BACKOFF_BASE_MS;
      }

      const retryableByMessage =
        /LLM-Anfrage fehlgeschlagen: (408|429|500|502|503|504)\b/.test(wrapped.message);
      if (attempt < currentMaxAttempts && (isAbort || retryableByMessage)) {
        const backoffMs = backoffBase * 2 ** (attempt - 1);
        await sleep(backoffMs);
        continue;
      }
      throw wrapped;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastErr ?? new Error('LLM-Anfrage fehlgeschlagen.');
}
