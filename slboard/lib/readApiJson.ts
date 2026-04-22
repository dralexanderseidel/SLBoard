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
