import type { Metadata } from 'next';

/** Cross-Page-Links: `<a href>` (voller Ladevorgang), damit die Zielseite oben startet. */
const helpClassName = 'text-blue-600 underline-offset-2 hover:underline dark:text-blue-400';

export const metadata: Metadata = {
  title: 'Hilfe und Dokumentation | log/os Edu Governance Pro',
  description:
    'Ausführliche Anleitung für Schulen: Anmeldung, Dokumente, KI-Funktionen, Entwurfsassistent und häufige Fragen.',
};

const toc = [
  { id: 'einleitung', label: 'Über diese Hilfe' },
  { id: 'anmeldung', label: 'Anmeldung und Konto' },
  { id: 'dashboard', label: 'Dashboard (Startseite)' },
  { id: 'dokumente', label: 'Dokumentenliste' },
  { id: 'hochladen', label: 'Dokument hochladen' },
  { id: 'dokument-detail', label: 'Dokument einzeln ansehen und bearbeiten' },
  { id: 'workflow', label: 'Status und Freigabe (Workflow)' },
  { id: 'ki-funktionen', label: 'KI-Funktionen im Überblick' },
  { id: 'entwurfsassistent', label: 'Entwurfsassistent' },
  { id: 'admin', label: 'Bereich Admin' },
  { id: 'grenzen', label: 'Grenzen der KI und Verantwortung' },
  { id: 'glossar', label: 'Glossar' },
  { id: 'faq', label: 'Häufige Fragen (FAQ)' },
] as const;

export default function HilfePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-10 border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Endnutzer-Dokumentation
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Hilfe zu log/os Edu Governance Pro
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          Diese Seite erklärt die wichtigsten Funktionen der Anwendung für Schulen: von der Anmeldung über die
          Dokumentenverwaltung bis zu KI-gestützten Hilfen. Sie richtet sich an Kollegium, Schulleitung,
          Sekretariat und Verwaltung – nicht an technische Administratoren der Plattform.
        </p>
      </header>

      <nav
        aria-label="Inhalt"
        className="mb-10 rounded-lg border border-zinc-200 bg-white p-4 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Inhalt
        </h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-zinc-800 dark:text-zinc-200">
          {toc.map((item) => (
            <li key={item.id}>
              <a href={`#${item.id}`} className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-400">
                {item.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <article className="space-y-12 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 [&>section]:scroll-mt-36 sm:[&>section]:scroll-mt-40">
        <section id="einleitung" className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Über diese Hilfe</h2>
          <p>
            <strong>log/os Edu Governance Pro</strong> unterstützt Schulen bei der zentralen Ablage, Suche und
            Bearbeitung schulischer Dokumente (z.&nbsp;B. Elternbriefe, Konzepte, Protokolle, Beschlüsse). Zusätzlich
            stehen KI-Funktionen zur Verfügung – immer im Rahmen der für Ihre Schule konfigurierten Rechte und
            Kontingente.
          </p>
          <p>
            Die Oberfläche ist in der Regel über die Kopfzeile erreichbar:{' '}
            <strong>Dashboard</strong>, <strong>Dokumente</strong>, <strong>Entwurfsassistent</strong>,{' '}
            <strong>Hilfe</strong> (diese Seite) und bei entsprechender Rolle <strong>Admin</strong>. Über das
            Profilmenü rechts oben melden Sie sich ab, wechseln bei Bedarf die <strong>Schulnummer</strong> (wenn Ihre
            E-Mail mehreren Schulen zugeordnet ist), ändern das Passwort, laden einen{' '}
            <strong>Datenexport</strong> herunter oder stellen eine <strong>Löschanfrage</strong> (siehe unten unter
            Anmeldung und FAQ).
          </p>
        </section>

        <section id="anmeldung" className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Anmeldung und Konto</h2>
          <h3 className="text-base font-medium text-zinc-800 dark:text-zinc-100">Was Sie für die Anmeldung brauchen</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>6-stellige Schulnummer</strong> Ihrer Einrichtung (wird Ihnen von der Schule oder der
              Verwaltung mitgeteilt).
            </li>
            <li>
              <strong>E-Mail-Adresse</strong>, unter der Ihr Benutzerkonto für genau diese Schule angelegt wurde.
            </li>
            <li>
              <strong>Passwort</strong> – entweder von Ihnen bei der Registrierung gewählt oder (bei neuen Konten)
              ein <strong>vorläufiges Passwort vom Administrator</strong>, das Sie beim ersten Login ändern müssen.
            </li>
          </ul>
          <h3 className="text-base font-medium text-zinc-800 dark:text-zinc-100">Erster Login mit vorläufigem Passwort</h3>
          <p>
            Wurde Ihr Konto mit einem temporären Passwort angelegt, werden Sie nach der Anmeldung aufgefordert, ein
            <strong> persönliches neues Passwort</strong> zu setzen. Das erhöht die Sicherheit, weil das initiale
            Passwort nicht dauerhaft verwendet werden soll. Ohne diese Änderung ist die Nutzung der übrigen Seiten
            nicht möglich – Sie werden dazu automatisch weitergeleitet.
          </p>
          <h3 className="text-base font-medium text-zinc-800 dark:text-zinc-100">Abmelden</h3>
          <p>
            Nutzen Sie im Menü oben rechts die Abmeldung, wenn Sie die Anwendung verlassen, insbesondere an gemeinsam
            genutzten Rechnern. So kann niemand Unbefugtes unter Ihrer Sitzung weiterarbeiten.
          </p>
          <h3 className="text-base font-medium text-zinc-800 dark:text-zinc-100">Mehrere Schulen unter einer E-Mail</h3>
          <p>
            Ist dieselbe E-Mail-Adresse für <strong>mehrere Schulnummern</strong> registriert, müssen Sie bei der
            Anmeldung (oder danach) die passende Schule wählen. Die Anwendung merkt sich die Schulzuordnung für die
            Sitzung. Wechseln Sie die Schule über das Profilmenü, wenn Sie eine andere Einrichtung bearbeiten möchten.
          </p>
          <h3 className="text-base font-medium text-zinc-800 dark:text-zinc-100">Datenexport und Löschanfrage</h3>
          <p>
            Im Profilmenü steht ein <strong>Export Ihrer personenbezogenen Daten</strong> als JSON-Datei zur
            Verfügung (sofern Sie einen gültigen Schul-Kontext haben). Über{' '}
            <strong>Löschanfrage stellen</strong> können Sie beantragen, dass Ihr Zugang für diese Schule datenschutzmäßig
            abgewickelt wird: Es wird ein <strong>Protokolleintrag für die Schul-Administration</strong> angelegt; es
            erfolgt <strong>kein automatisches Löschen</strong>. Eine bereits offene Löschanfrage kann nicht doppelt
            gestellt werden. Details zur Bearbeitung siehe Abschnitt <a href="#admin" className={helpClassName}>Admin</a>{' '}
            und <a href="#faq" className={helpClassName}>FAQ</a>.
          </p>
          <h3 className="text-base font-medium text-zinc-800 dark:text-zinc-100">Schule inaktiv</h3>
          <p>
            Ist für Ihre Schule der Zugang vorübergehend deaktiviert, erhalten Sie einen Hinweis auf der Anmeldeseite
            und können sich nicht anmelden. In diesem Fall wenden Sie sich an die für Ihre Organisation
            zuständige Stelle – die Freischaltung erfolgt nicht über diese Hilfeseite.
          </p>
          <h3 className="text-base font-medium text-zinc-800 dark:text-zinc-100">Konto deaktiviert (nur diese Schule)</h3>
          <p>
            Ein Schul-Administrator kann Ihr Benutzerkonto für <strong>eine Schulnummer vorübergehend deaktivieren</strong>.
            Sie sind dann für diese Schule <strong>nicht mehr in der Lage</strong>, Dokumente oder KI-Funktionen zu nutzen;
            in der Kopfzeile erscheint ein Hinweis. Die Anmeldung bei Supabase kann weiterhin bestehen – für die
            Freischaltung oder Klärung wenden Sie sich an Ihre Schule. Diese Sperre ist unabhängig von der
            plattformweiten Deaktivierung einer ganzen Schule (siehe „Schule inaktiv“).
          </p>
        </section>

        <section id="dashboard" className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Dashboard (Startseite)</h2>
          <p>
            Nach der Anmeldung sehen Sie das <strong>Dashboard</strong>. Dort können Sie eine{' '}
            <strong>Frage an die gesamte Dokumentenbasis Ihrer Schule</strong> stellen – ähnlich einer Suche mit
            Antworttext, der von der KI aus den hinterlegten Dokumenten begründet wird.
          </p>
          <h3 className="text-base font-medium text-zinc-800 dark:text-zinc-100">Ablauf: Frage stellen</h3>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              Geben Sie Ihre Frage in das Eingabefeld ein (z.&nbsp;B. zu Fristen, Regelungen oder Begriffen in
              schulischen Texten).
            </li>
            <li>
              Optional: Klicken Sie auf <strong>„Relevante Dokumente finden“</strong>, damit die KI passende
              Dokumente vorschlägt. Sie können die Vorschläge per Kontrollkästchen ein- oder ausschalten.
            </li>
            <li>
              Starten Sie die Antwort mit <strong>„Frage mit ausgewählten Dokumenten beantworten“</strong> oder
              wählen Sie <strong>„Ohne Auswahl direkt beantworten“</strong>, wenn keine Dokumentenvorschau nötig ist.
            </li>
          </ol>
          <h3 className="text-base font-medium text-zinc-800 dark:text-zinc-100">Tastenkürzel im Fragefeld</h3>
          <p>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">Tastatur:</span>{' '}
            <kbd className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200">
              Enter
            </kbd>{' '}
            startet die Dokumentensuche – oder die Antwort, sobald die Trefferliste geladen ist.{' '}
            <kbd className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200">
              Umschalt+Enter
            </kbd>
            ,{' '}
            <kbd className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200">
              Strg+Enter
            </kbd>{' '}
            oder{' '}
            <kbd className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200">
              Cmd+Enter
            </kbd>{' '}
            (macOS) überspringen die Suche und beantworten sofort (wie „Direkt antworten“).
          </p>
          <p>
            Unter der Antwort listet die Oberfläche die <strong>verwendeten Dokumente</strong> mit Link und – falls
            vorhanden – einen kurzen Zusammenfassungsauszug; die KI soll diese Liste nicht noch einmal in den
            Antworttext schreiben. Gespeicherte Anfragen erscheinen im Bereich „Aktuelle Anfragen“, soweit Ihre Schule
            diese Funktion nutzt.
          </p>
          <p>
            Weitere Kacheln oder Hinweise auf dem Dashboard informieren z.&nbsp;B. über kürzlich veröffentlichte
            Dokumente oder überfällige Prüftermine – jeweils abhängig von den Daten Ihrer Schule.
          </p>
        </section>

        <section id="dokumente" className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Dokumentenliste</h2>
          <p>
            Unter{' '}
            <a href="/documents" className={helpClassName}>
              Dokumente
            </a>{' '}
            sehen Sie alle Dokumente, die Sie nach Ihren <strong>Berechtigungen</strong> und{' '}
            <strong>Schutzstufen</strong> einsehen dürfen. Die Liste kann viele Einträge enthalten – nutzen Sie Suche
            und Filter, um schnell fundig zu werden.
          </p>
          <h3 className="text-base font-medium text-zinc-800 dark:text-zinc-100">Ansichten</h3>
          <p>
            Sie können zwischen verschiedenen Darstellungen wechseln (z.&nbsp;B. <strong>Tabelle</strong>,{' '}
            <strong>Karten</strong>, <strong>kompakt</strong>). Sortierungen (z.&nbsp;B. nach Datum oder Titel) helfen
            bei der Orientierung.
          </p>
          <h3 className="text-base font-medium text-zinc-800 dark:text-zinc-100">Suche und Filter</h3>
          <p>
            Die globale Suche in der Kopfzeile und die Filter auf der Dokumentenseite grenzen die Treffer ein – etwa
            nach Dokumenttyp, Status, Organisationseinheit, Gremium oder Freitext. Nicht alle Filter müssen bei Ihrer
            Schule sichtbar sein; es hängt von der Konfiguration ab.
          </p>
          <h3 className="text-base font-medium text-zinc-800 dark:text-zinc-100">Archiv</h3>
          <p>
            Über die Ansicht <strong>Archiv</strong> (Link bzw. Parameter in der Dokumentenansicht) erreichen Sie
            Dokumente, die für den laufenden Betrieb aus der Standardliste genommen wurden. Archivierte Dokumente
            können je nach Rolle wiederhergestellt oder endgültig gelöscht werden – letzteres oft nur für
            Administratoren und mit zusätzlicher Bestätigung.
          </p>
          <h3 className="text-base font-medium text-zinc-800 dark:text-zinc-100">Mehrfachauswahl</h3>
          <p>
            In der Tabellenansicht können Sie mehrere Dokumente markieren und <strong>gemeinsame Aktionen</strong>{' '}
            ausführen (z.&nbsp;B. Status setzen, Archivierung, KI-Stapel für Zusammenfassungen oder Analysen), sofern
            Ihre Rolle das erlaubt. Ungeeignete Dokumente werden dabei übersprungen oder ausgewiesen. Nach größeren
            Stapel-Aktionen fasst die Oberfläche das Ergebnis oft in einer <strong>Zusammenfassung</strong> (erfolgreich,
            übersprungen, fehlgeschlagen) zusammen, damit Sie den Überblick behalten.
          </p>
        </section>

        <section id="hochladen" className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Dokument hochladen</h2>
          <p>
            Unter{' '}
            <a href="/upload" className={helpClassName}>
              Dokument hochladen
            </a>{' '}
            (oder vergleichbare Navigation) laden Sie eine neue Datei hoch und pflegen <strong>Metadaten</strong> wie
            Dokumenttyp, Organisationseinheit, Gremium, Reichweite, Schutzstufe und ggf. Prüfdatum. Pflichtfelder sind
            gekennzeichnet.
          </p>
          <p>
            Unterstützte Formate sind in der Regel gängige Office- und PDF-Dateien. Nach dem Upload steht eine erste
            Version des Dokuments zur Verfügung; spätere Versionen können auf der Dokumentdetailseite nachgereicht
            werden.
          </p>
        </section>

        <section id="dokument-detail" className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Dokument einzeln ansehen und bearbeiten</h2>
          <p>
            Ein Klick auf ein Dokument in der Liste öffnet die <strong>Detailseite</strong>. Dort finden Sie:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Metadaten</strong> (Titel, Typ, Status, Zuständigkeit, Gremium, Beteiligte, Rechtsbezug usw.)
            </li>
            <li>
              <strong>Vorschau</strong> des Inhalts der aktuellen Version (sofern verfügbar)</li>
            <li>
              <strong>Versionshistorie</strong> mit älteren Fassungen</li>
            <li>
              bei Berechtigung: <strong>Bearbeiten</strong> der Metadaten und <strong>Hochladen einer neuen Version</strong>
            </li>
            <li>
              <strong>KI-Aktionen</strong> (siehe nächster Abschnitt)</li>
            <li>
              Verknüpfung zum <strong>Entwurfsassistenten</strong>, um auf Basis dieses Dokuments einen neuen Text zu
              beginnen
            </li>
          </ul>
          <p>
            Ob Sie Inhalte ändern oder nur lesen dürfen, hängt von Ihrer Rolle, der Organisationseinheit und der
            <strong> Schutzstufe</strong> des Dokuments ab. Veröffentlichte Dokumente sind in der Regel nicht mehr
            inhaltlich veränderbar; Änderungen erfolgen dann über neue Versionen oder Folgedokumente – je nach
            Regeln Ihrer Schule.
          </p>
        </section>

        <section id="workflow" className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Status und Freigabe (Workflow)</h2>
          <p>
            Viele Dokumente durchlaufen einen festen <strong>Bearbeitungsstand</strong>, unabhängig vom Dokumenttyp:
          </p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              <strong>Entwurf</strong> – in Bearbeitung, noch nicht freigegeben
            </li>
            <li>
              <strong>Freigegeben</strong> – zur weiteren Bearbeitung oder zum Beschluss vorgesehen
            </li>
            <li>
              <strong>Beschluss</strong> – formal beschlossen oder in der Beschlusslogik angekommen
            </li>
            <li>
              <strong>Veröffentlicht</strong> – für den vorgesehenen Kreis gültig/kommuniziert; weitere Statuswechsel
              sind dann in der Regel nicht mehr vorgesehen
            </li>
          </ol>
          <p>
            Auf der Dokumentdetailseite und in der Liste stehen Ihnen – sofern berechtigt – Schaltflächen zur
            <strong> Freigabe</strong>, zum <strong>Beschluss</strong> oder zur <strong>Veröffentlichung</strong> zur
            Verfügung. Jeder Schritt sollte inhaltlich und organisatorisch zu Ihren schulischen Abläufen passen; die
            Software erzwingt nur die technische Reihenfolge der Status.
          </p>
        </section>

        <section id="ki-funktionen" className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">KI-Funktionen im Überblick</h2>
          <p>
            KI-Funktionen <strong>ersetzen keine rechtsverbindliche Prüfung</strong> und keinen fachlichen Durchblick.
            Sie unterstützen beim Lesen, Strukturieren und Suchen. Antworten können unvollständig oder in Einzelfällen
            fehlerhaft sein – bitte immer mit dem Originaldokument und Ihrer Fachkompetenz abgleichen.
          </p>

          <h3 className="text-base font-medium text-zinc-800 dark:text-zinc-100">Dashboard: Frage an die Dokumentenbasis</h3>
          <p>
            Siehe Abschnitt <a href="#dashboard" className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-400">Dashboard</a>.
            Nutzen Sie Textbelege, um Aussagen der KI nachzuvollziehen.
          </p>

          <h3 className="text-base font-medium text-zinc-800 dark:text-zinc-100">Zusammenfassung (Dokumentdetail)</h3>
          <p>
            Die KI kann eine <strong>kurze Zusammenfassung</strong> des Dokumentinhalts erzeugen. Dafür muss genügend
            Text aus der Datei auslesbar sein. Die Zusammenfassung wird gespeichert und kann bei neuer Dokumentversion
            erneuert werden.
          </p>

          <h3 className="text-base font-medium text-zinc-800 dark:text-zinc-100">Fragen zu diesem Dokument</h3>
          <p>
            Im Bereich „Fragen zu diesem Dokument“ geben Sie eine konkrete Frage ein und starten die Bearbeitung. Die
            KI bezieht sich auf dieses eine Dokument (und ggf. den Schul-Kontext). Die Schaltfläche zeigt während der
            Verarbeitung einen Ladehinweis.
          </p>

          <h3 className="text-base font-medium text-zinc-800 dark:text-zinc-100">Steuerungsanalyse</h3>
          <p>
            Die <strong>Steuerungsanalyse</strong> ordnet das Dokument strukturell entlang einer{' '}
            <strong>Schulentwicklungs-Matrix</strong> (sieben Aufgabenfelder) und drei{' '}
            <strong>Steuerungsdimensionen</strong> (Tragfähigkeit, Entscheidungslogik, Verbindlichkeit); ergänzend
            werden Belastungsgrad, Passung und ein Gesamt-Steuerungsbedarf ausgewiesen. Sie dient der strukturellen
            Einordnung, nicht der inhaltlichen Bewertung des pädagogischen Konzepts. Ergebnisse werden gespeichert und
            können bei geänderter Dokumentversion aktualisiert werden.
          </p>

          <h3 className="text-base font-medium text-zinc-800 dark:text-zinc-100">ToDos und Aufgaben extrahieren</h3>
          <p>
            Aus dem Dokument können <strong>konkrete Aufgaben, Hinweise auf Zuständigkeiten und Fristen</strong>{' '}
            extrahiert werden. Die Darstellung ist eine Orientierungshilfe; verbindlich bleiben die Festlegungen in den
            beschlossenen Dokumenten und Ihre internen Verteilungen.
          </p>

          <h3 className="text-base font-medium text-zinc-800 dark:text-zinc-100">Kontingente</h3>
          <p>
            Für KI-Anfragen kann eine Obergrenze pro Monat gelten. Wenn ein Limit erreicht ist, erhalten Sie eine
            entsprechende Fehlermeldung – Ihre Schule kann dann Kontingente anpassen (über die Plattformverwaltung).
          </p>
        </section>

        <section id="entwurfsassistent" className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Entwurfsassistent</h2>
          <p>
            Der{' '}
            <a href="/drafts" className={helpClassName}>
              Entwurfsassistent
            </a>{' '}
            hilft dabei, auf Basis vorhandener Dokumente oder Vorgaben neue Texte vorzubereiten – etwa für Elternbriefe
            oder interne Rundschreiben. Sie wählen Kontext und Dokumenttyp; die KI schlägt Formulierungen vor. Der
            Entwurf muss inhaltlich und formal immer durch Menschen geprüft und freigegeben werden, bevor er
            veröffentlicht oder versendet wird.
          </p>
          <p>
            Von der Dokumentdetailseite aus können Sie einen Entwurf mit Bezug zu genau diesem Dokument starten (Link
            „Entwurf erstellen“), sofern angeboten.
          </p>
        </section>

        <section id="admin" className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Bereich Admin</h2>
          <p>
            Nutzerinnen und Nutzer mit <strong>Administratorrolle</strong> für die eigene Schule erreichen unter{' '}
            <a href="/admin" className={helpClassName}>
              Admin
            </a>{' '}
            Verwaltungsfunktionen. Sinnvolle Reihenfolge: zuerst <strong>Nutzer &amp; Rollen</strong>, dann{' '}
            <strong>Metadaten</strong> (Dokumenttypen, Verantwortlich), anschließend <strong>KI-Einstellungen</strong> und{' '}
            <strong>Prompt-Vorlagen</strong>, wenn die KI genutzt werden soll; <strong>Statistik</strong> liefert Kennzahlen.
          </p>
          <h3 className="text-base font-medium text-zinc-800 dark:text-zinc-100">Nutzer &amp; Rollen</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>Konten anlegen (inkl. optionalem vorläufigem Passwort), Stammdaten und Organisationseinheit bearbeiten</li>
            <li>
              <strong>Rollen</strong> per Kontrollkästchen pflegen (z.&nbsp;B. Schulleitung, Sekretariat, Lehrkraft)
            </li>
            <li>
              Spalte <strong>Aktiv</strong>: Ein Konto kann für diese Schule <strong>deaktiviert</strong> werden – dann
              besteht kein Schulzugriff mehr, bis es wieder aktiviert wird. Der bei der{' '}
              <strong>Schul-Selbstregistrierung</strong> angelegte erste Admin sowie Ihr <strong>eigenes</strong> Konto
              können Sie so nicht sperren (technische Absicherung).
            </li>
            <li>Nutzer löschen, sofern vorgesehen (nicht der Registrierungs-Admin)</li>
          </ul>
          <h3 className="text-base font-medium text-zinc-800 dark:text-zinc-100">Löschanfragen</h3>
          <p>
            Wenn Endnutzerinnen oder Endnutzer im Profilmenü eine <strong>Löschanfrage</strong> stellen, erscheint diese
            im Admin-Bereich unter <strong>Löschanfragen</strong>. Offene Anfragen werden oben auf der Admin-Seite
            hervorgehoben. Administratoren setzen einen <strong>Status</strong> (z.&nbsp;B. offen, zur Kenntnis genommen,
            erledigt, abgelehnt), optional eine <strong>interne Notiz</strong> und dokumentieren damit den Bearbeitungsstand.
            Die Anwendung <strong>löscht keine Daten automatisch</strong>; die weitere Abwicklung (z.&nbsp;B. Löschen in
            Auth und Datenbank) erfolgt nach Ihren organisatorischen und rechtlichen Vorgaben außerhalb dieser Maske oder
            durch Ihre IT.
          </p>
          <h3 className="text-base font-medium text-zinc-800 dark:text-zinc-100">Metadaten, KI, Statistik, Reindizierung</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Metadaten:</strong> Dokumenttypen-Liste und Verantwortlich-Gruppen pro Schule – sie speisen u.&nbsp;a.
              Auswahllisten beim Hochladen
            </li>
            <li>
              <strong>KI-Einstellungen</strong> und <strong>Prompt-Bausteine</strong> für die konfigurierten KI-Nutzungen
            </li>
            <li>
              <strong>Statistik</strong> zu Nutzern, Dokumenten und KI-Aufrufen (Schulbezug)
            </li>
            <li>
              <strong>Dokumente reindizieren</strong> (Schaltfläche im Kopf der Admin-Seite): erzeugt Suchtext und
              Stichworte für bereits vorhandene Dokumente neu – nur nach größeren Konfigurationsänderungen nötig
            </li>
          </ul>
          <p>
            Eine globale Verwaltung mehrerer Schulen (Super-Admin) ist nur für ausgewiesene Plattform-Administratorinnen
            und -Administratoren sichtbar und wird hier nicht beschrieben.
          </p>
        </section>

        <section id="grenzen" className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Grenzen der KI und Verantwortung</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Die KI hat <strong>keinen Zugriff auf externe Webseiten</strong> oder nicht hinterlegte Unterlagen – nur
              auf das, was in der Anwendung für Ihre Schule vorgesehen ist.
            </li>
            <li>
              <strong>Rechtliche Bewertungen</strong> ersetzt die Software nicht; bei Unsicherheiten ziehen Sie
              Fachstellen oder Rechtsberatung hinzu.
            </li>
            <li>
              <strong>Personenbezogene Daten</strong> sollten nur im Rahmen der schulischen Datenverarbeitung und der
              geltenden Vorgaben eingegeben werden.
            </li>
            <li>
              Inhaltliche <strong>Verantwortung</strong> für veröffentlichte Texte und Beschlüsse liegt bei der Schule
              bzw. den beschließenden Gremien – nicht bei der KI.
            </li>
          </ul>
        </section>

        <section id="glossar" className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Glossar</h2>
          <dl className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <div>
              <dt className="font-medium text-zinc-900 dark:text-zinc-100">Schulnummer</dt>
              <dd className="mt-0.5 text-zinc-700 dark:text-zinc-300">
                Sechsstellige Kennzahl Ihrer Schule in der Anwendung; verknüpft Konto und Daten mit dem richtigen
                Mandanten.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-900 dark:text-zinc-100">Dokumenttyp</dt>
              <dd className="mt-0.5 text-zinc-700 dark:text-zinc-300">
                Kategorie wie Protokoll, Konzept, Elternbrief – hilft bei Filter und Ordnung, nicht automatisch beim
                rechtlichen Status.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-900 dark:text-zinc-100">Schutzstufe</dt>
              <dd className="mt-0.5 text-zinc-700 dark:text-zinc-300">
                Steuert, welche Rollen ein Dokument sehen oder bearbeiten dürfen.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-900 dark:text-zinc-100">Organisationseinheit</dt>
              <dd className="mt-0.5 text-zinc-700 dark:text-zinc-300">
                Zuständigkeit oder Abteilung (z.&nbsp;B. Schulleitung, Fachschaft) – oft relevant für Sichtbarkeit in
                Listen.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-900 dark:text-zinc-100">Version</dt>
              <dd className="mt-0.5 text-zinc-700 dark:text-zinc-300">
                Jede hochgeladene Dateifassung eines Dokuments; die aktuelle Version steuert u.&nbsp;a. KI-Auswertungen,
                die an den Inhalt gekoppelt sind.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-900 dark:text-zinc-100">Steuerungsanalyse</dt>
              <dd className="mt-0.5 text-zinc-700 dark:text-zinc-300">
                Strukturelle Bewertung des Dokuments aus Organisationssicht (nicht: pädagogische Qualität des Inhalts).
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-900 dark:text-zinc-100">Löschanfrage</dt>
              <dd className="mt-0.5 text-zinc-700 dark:text-zinc-300">
                Vom Nutzer ausgelöster Wunsch nach Konten- bzw. Datenlöschung für eine Schulzuordnung; wird protokolliert
                und von Schul-Admins bearbeitet, ohne automatisches Löschen durch die App.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-900 dark:text-zinc-100">Konto aktiv / deaktiviert</dt>
              <dd className="mt-0.5 text-zinc-700 dark:text-zinc-300">
                Steuerung durch Schul-Admins: ein deaktiviertes Konto hat keinen Zugriff mehr auf Schul-Daten dieser
                Schulnummer, bis es wieder aktiviert wird (unabhängig von „Schule inaktiv“ auf Plattformebene).
              </dd>
            </div>
          </dl>
        </section>

        <section id="faq" className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Häufige Fragen (FAQ)</h2>

          <div className="space-y-1">
            <p className="font-medium text-zinc-900 dark:text-zinc-100">Ich sehe nach der Anmeldung nur die Passwort-Änderungsseite.</p>
            <p className="text-zinc-700 dark:text-zinc-300">
              Ihr Konto nutzt noch ein vorläufiges Passwort. Legen Sie ein neues, persönliches Passwort fest; danach
              stehen Ihnen die übrigen Menüs zur Verfügung.
            </p>
          </div>

          <div className="space-y-1">
            <p className="font-medium text-zinc-900 dark:text-zinc-100">Warum finde ich ein bestimmtes Dokument nicht?</p>
            <p className="text-zinc-700 dark:text-zinc-300">
              Mögliche Gründe: eingeschränkte Berechtigung, Schutzstufe, anderer Status, Archiv, oder die Suche ist zu
              eng gefiltert. Prüfen Sie Filter und Archiv-Ansicht.
            </p>
          </div>

          <div className="space-y-1">
            <p className="font-medium text-zinc-900 dark:text-zinc-100">Die KI-Antwort ist leer oder es gibt einen Fehler.</p>
            <p className="text-zinc-700 dark:text-zinc-300">
              Oft fehlt auslesbarer Text im Dokument, das Kontingent ist erschöpft, oder die Verbindung zum
              KI-Dienst ist gestört. Versuchen Sie es später erneut; bei PDFs sollte der Text extrahierbar sein.
            </p>
          </div>

          <div className="space-y-1">
            <p className="font-medium text-zinc-900 dark:text-zinc-100">Kann ich der KI vertrauen?</p>
            <p className="text-zinc-700 dark:text-zinc-300">
              Nutzen Sie KI-Ausgaben als Unterstützung. Entscheidungen und Veröffentlichungen prüfen und treffen
              Menschen mit Verantwortung – nicht die KI.
            </p>
          </div>

          <div className="space-y-1">
            <p className="font-medium text-zinc-900 dark:text-zinc-100">Wo erhalte ich technische Hilfe?</p>
            <p className="text-zinc-700 dark:text-zinc-300">
              Wenden Sie sich an die in Ihrer Schule oder Behörde benannte Ansprechperson für IT oder die
              Plattformverwaltung. Diese Hilfeseite ersetzt keinen individuellen Support.
            </p>
          </div>

          <div className="space-y-1">
            <p className="font-medium text-zinc-900 dark:text-zinc-100">Wie stelle ich eine Löschanfrage?</p>
            <p className="text-zinc-700 dark:text-zinc-300">
              Öffnen Sie das Profilmenü oben rechts und wählen Sie <strong>Löschanfrage stellen</strong>. Bestätigen Sie
              den Hinweis. Es wird ein Eintrag für Ihre Schul-Administration erzeugt; Ihr Konto wird dadurch{' '}
              <strong>nicht automatisch gelöscht</strong>. Liegt bereits eine offene Anfrage vor, ist eine zweite nicht
              möglich – warten Sie auf die Bearbeitung oder sprechen Sie die Administration an.
            </p>
          </div>

          <div className="space-y-1">
            <p className="font-medium text-zinc-900 dark:text-zinc-100">
              Warum steht da „Konto deaktiviert“, obwohl ich mich anmelden konnte?
            </p>
            <p className="text-zinc-700 dark:text-zinc-300">
              Ihre Anmeldung kann technisch bestehen, aber die Schul-Administration hat Ihren Zugang für{' '}
              <strong>diese Schulnummer</strong> gesperrt. Wenden Sie sich an die Schule, wenn die Sperre aufgehoben
              werden soll oder es sich um ein Missverständnis handelt.
            </p>
          </div>

          <div className="space-y-1">
            <p className="font-medium text-zinc-900 dark:text-zinc-100">Wer bearbeitet meine Löschanfrage?</p>
            <p className="text-zinc-700 dark:text-zinc-300">
              Nutzerinnen und Nutzer mit Admin-Rechten für Ihre Schule sehen die Anfragen im Bereich{' '}
              <strong>Admin → Löschanfragen</strong> und pflegen Status sowie Notizen. Die eigentliche Löschung oder
              Anonymisierung personenbezogener Daten kann zusätzliche Schritte außerhalb der Oberfläche erfordern – das
              regelt Ihre Organisation.
            </p>
          </div>
        </section>

        <footer className="border-t border-zinc-200 pt-8 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <p>
            Stand der Dokumentation: Anpassung u.&nbsp;a. an Löschanfragen, Konten-Deaktivierung durch Schul-Admins,
            Profilmenü (Export) und erweiterte Admin-Bereiche. Einzelne Funktionen können je nach Schule oder Version
            abweichen.
          </p>
          <p className="mt-2">
            <a href="/" className={helpClassName}>
              Zurück zum Dashboard
            </a>
          </p>
        </footer>
      </article>
    </div>
  );
}
