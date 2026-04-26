import { toast } from 'sonner';
import { isApiUserError, serializeApiError } from './apiUserError';

/** Kurze Toast-Meldung (Details siehe z. B. {@link ApiErrorCallout} auf der Seite). */
export function toastApiError(e: unknown, fallbackUserMessage: string) {
  const parts = isApiUserError(e) ? e.toJSON() : serializeApiError(e, fallbackUserMessage);
  toast.error(parts.userMessage);
}
