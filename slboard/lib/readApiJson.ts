import { ApiUserError } from './apiUserError';

/**
 * Liest JSON aus API-Antworten. Auf Vercel/Proxys kann bei Fehlern HTML zurückkommen —
 * dann liefern wir einen verständlichen Fehler statt „Unexpected token '<'“.
 */
export async function readApiJson<T>(res: Response): Promise<T> {
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    return (await res.json()) as T;
  }
  const text = await res.text();
  const snippet = text.slice(0, 200).replace(/\s+/g, ' ').trim();
  throw new Error(
    `Unerwartete Antwort (${res.status}): ${snippet || 'leer'}${text.length > 200 ? ' …' : ''}`
  );
}

/**
 * Liest den Antwort-Body genau einmal. Bei !res.ok wird {@link ApiUserError} geworfen
 * (Nutzerkurztext + technische Details aus Body).
 */
export async function readApiJsonOk<T>(res: Response, fallbackUserMessage: string): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    throw ApiUserError.fromFailedResponse(res.status, text, fallbackUserMessage);
  }
  const trimmed = text.trim();
  if (!trimmed) return {} as T;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new ApiUserError(
      'Ungültige JSON-Antwort vom Server.',
      trimmed.slice(0, 4000) + (trimmed.length > 4000 ? '\n…' : ''),
      res.status,
    );
  }
}
