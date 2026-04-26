/** Kurztext für Nutzer:innen; `detail` für Support / technisches Nachlesen (z. B. &lt;details&gt;). */
export type SerializedApiError = {
  userMessage: string;
  detail: string | null;
};

const STATUS_USER_HINT_DE: Record<number, string> = {
  400: 'Die Anfrage wurde vom Server nicht akzeptiert.',
  401: 'Sie sind nicht angemeldet oder die Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.',
  403: 'Sie haben keine Berechtigung für diese Aktion.',
  404: 'Der angeforderte Inhalt wurde nicht gefunden.',
  408: 'Die Anfrage hat zu lange gedauert. Bitte versuchen Sie es erneut.',
  409: 'Die Aktion passt nicht zum aktuellen Zustand (z. B. gleichzeitige Bearbeitung).',
  429: 'Zu viele Anfragen. Bitte warten Sie einen Moment und versuchen Sie es erneut.',
};

function defaultForStatus(status: number, fallback: string): string {
  if (status >= 500) return 'Der Server konnte die Anfrage nicht bearbeiten. Bitte versuchen Sie es später erneut.';
  return STATUS_USER_HINT_DE[status] ?? fallback;
}

function looksLikeHtml(s: string): boolean {
  return /^\s*</.test(s) && /<\/?(html|body|head|!doctype)/i.test(s);
}

function safeServerLine(server: string | null): string | null {
  if (!server) return null;
  const t = server.trim();
  if (!t || looksLikeHtml(t)) return null;
  if (t.length > 220) return null;
  return t;
}

export class ApiUserError extends Error {
  override readonly name = 'ApiUserError';

  constructor(
    readonly userMessage: string,
    readonly detail: string | null,
    readonly httpStatus: number,
  ) {
    super(userMessage);
  }

  toJSON(): SerializedApiError {
    return { userMessage: this.userMessage, detail: this.detail };
  }

  /** Fehlerantwort: einmal gelesener Body-Text (JSON oder HTML/Plain). */
  static fromFailedResponse(status: number, bodyText: string, fallbackUserMessage: string): ApiUserError {
    const raw = bodyText.trim();
    let parsed: unknown = null;
    if (raw.startsWith('{') || raw.startsWith('[')) {
      try {
        parsed = JSON.parse(raw) as unknown;
      } catch {
        parsed = null;
      }
    }

    let serverError: string | null = null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const o = parsed as Record<string, unknown>;
      if (typeof o.error === 'string') serverError = o.error;
      else if (typeof o.message === 'string' && status >= 400) serverError = o.message;
    }

    const line = safeServerLine(serverError);
    const userMessage =
      line && (status < 500 || status === 422)
        ? line
        : defaultForStatus(status, fallbackUserMessage);

    const detail =
      parsed && typeof parsed === 'object'
        ? JSON.stringify(parsed, null, 0).slice(0, 6000)
        : raw
          ? raw.slice(0, 6000) + (raw.length > 6000 ? '\n…' : '')
          : null;

    return new ApiUserError(userMessage, detail || null, status);
  }
}

export function isApiUserError(e: unknown): e is ApiUserError {
  return e instanceof ApiUserError;
}

export function serializeApiError(e: unknown, fallback: string): SerializedApiError {
  if (e instanceof ApiUserError) return e.toJSON();
  if (e instanceof Error && e.message) return { userMessage: e.message, detail: null };
  return { userMessage: fallback, detail: typeof e === 'string' ? e : null };
}
