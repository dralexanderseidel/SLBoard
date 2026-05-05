/**
 * P3-24: Anker auf `/hilfe` — `id`-Werte müssen mit `app/hilfe/page.tsx` (TOC + Abschnitte) übereinstimmen.
 */
export const CONTEXT_HELP = {
  einleitung: '/hilfe#einleitung',
  anmeldung: '/hilfe#anmeldung',
  dashboard: '/hilfe#dashboard',
  steuerungsCockpit: '/hilfe#steuerungs-cockpit',
  dokumente: '/hilfe#dokumente',
  hochladen: '/hilfe#hochladen',
  dokumentDetail: '/hilfe#dokument-detail',
  workflow: '/hilfe#workflow',
  kiFunktionen: '/hilfe#ki-funktionen',
  entwurfsassistent: '/hilfe#entwurfsassistent',
  admin: '/hilfe#admin',
  grenzen: '/hilfe#grenzen',
  glossar: '/hilfe#glossar',
  faq: '/hilfe#faq',
} as const;
