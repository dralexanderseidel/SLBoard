/**
 * Generischer LLM-Aufruf (OpenAI-kompatibel + Google Gemini).
 */
const llmUrl = () => process.env.LLM_API_URL?.trim();
const llmKey = () => process.env.LLM_API_KEY?.trim();
const llmModel = () => process.env.LLM_MODEL?.trim();

export function isLlmConfigured(): boolean {
  return !!(llmUrl() && llmKey() && llmModel());
}

type CallLlmOptions = {
  timeoutMs?: number;
  maxAttempts?: number;
};

const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_MAX_ATTEMPTS = 3;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
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
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
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
        if (attempt < maxAttempts && isRetryableStatus(res.status)) {
          const backoffMs = 600 * 2 ** (attempt - 1);
          await sleep(backoffMs);
          continue;
        }
        throw err;
      }

      const json = await res.json();
      const content = isGoogleApi
        ? json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        : json.choices?.[0]?.message?.content ?? '';

      return content;
    } catch (err: unknown) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      const wrapped = isAbort
        ? new Error(`LLM-Timeout nach ${timeoutMs}ms.`)
        : err instanceof Error
          ? err
          : new Error('Unbekannter LLM-Fehler.');
      lastErr = wrapped;
      const retryableByMessage =
        /LLM-Anfrage fehlgeschlagen: (408|429|500|502|503|504)\b/.test(wrapped.message);
      if (attempt < maxAttempts && (isAbort || retryableByMessage)) {
        const backoffMs = 600 * 2 ** (attempt - 1);
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
