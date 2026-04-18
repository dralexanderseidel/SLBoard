/**
 * Einheitliche, verständliche Texte, wenn eine Schule vom Super-Admin deaktiviert wurde.
 */

/** Kurze Überschrift für Hinweisboxen und API-Zusammenfassungen. */
export const SCHOOL_INACTIVE_TITLE = 'Schule deaktiviert – Zugriff gesperrt';

/** Ausführliche Erklärung für die Login-Seite und Nutzerhinweise. */
export const SCHOOL_INACTIVE_BODY =
  'Die von Ihnen gewählte Schulnummer bzw. Ihre Schulzuordnung ist im System derzeit nicht aktiv. Ein Super-Administrator hat den Zugriff für diese Schule gesperrt. In dieser Zeit können Sie sich nicht anmelden; bestehende Sitzungen werden beendet. Bitte wenden Sie sich an den Plattform-Administrator oder die Verantwortlichen Ihrer Einrichtung, wenn Sie Hilfe benötigen oder die Sperre aufgehoben werden soll.';

/** Eine Zeile für JSON-API-Antworten (Middleware, Login-API). */
export const SCHOOL_INACTIVE_API_MESSAGE = `${SCHOOL_INACTIVE_TITLE}. ${SCHOOL_INACTIVE_BODY}`;
