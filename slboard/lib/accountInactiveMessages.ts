/**
 * Einheitliche Texte, wenn ein Schul-Admin das Konto (app_users) deaktiviert hat.
 */

export const ACCOUNT_INACTIVE_TITLE = 'Konto deaktiviert – kein Schulzugriff';

export const ACCOUNT_INACTIVE_BODY =
  'Ihr Zugang für diese Schule wurde von einem Administrator deaktiviert. Sie können die Anwendung für diese Schulnummer nicht nutzen. Ihre Anmeldedaten bleiben bestehen; wenden Sie sich an die Schulverwaltung, wenn die Sperre aufgehoben werden soll oder Sie Fragen haben.';

export const ACCOUNT_INACTIVE_API_MESSAGE = `${ACCOUNT_INACTIVE_TITLE}. ${ACCOUNT_INACTIVE_BODY}`;
