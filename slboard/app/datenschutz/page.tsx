import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Datenschutz | NOMOS Edu Governance Pro',
  description: 'Informationen zur Verarbeitung personenbezogener Daten',
};

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-10 scroll-mt-24">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
      <div className="mt-3 space-y-3 text-zinc-700 dark:text-zinc-300">{children}</div>
    </section>
  );
}

export default function DatenschutzPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 text-sm leading-relaxed text-zinc-800 dark:text-zinc-100">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Datenschutzhinweise
      </h1>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Stand: April 2026 · Produktbezeichnung: NOMOS Edu Governance Pro
      </p>

      <p className="mt-6 rounded border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
        <strong className="font-semibold">Hinweis:</strong> Die folgenden Angaben dienen der Transparenz nach Art. 13
        DSGVO. Welche Stelle (z. B. Schule, Schulträger oder Softwareanbieter) in Ihrem Einzelfall{' '}
        <em>Verantwortliche</em> ist und ob ein Auftragsverarbeitungsvertrag (Art. 28 DSGVO) besteht, ergibt sich aus
        Ihrem Vertrag, der Organisation der IT und ggf. aus einer gesonderten Vereinbarung. Bitte ergänzen Sie die
        markierten Platzhalter und lassen Sie den Text durch Ihre Datenschutzbeauftragte, Ihren Datenschutzdienstleister
        oder eine Kanzlei prüfen, bevor Sie ihn veröffentlichen.
      </p>

      <Section id="verantwortlicher" title="1. Verantwortlicher">
        <p>
          Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) ist diejenige Stelle, die allein oder
          gemeinsam mit anderen über die Zwecke und Mittel der Verarbeitung personenbezogener Daten entscheidet.
        </p>
        <p className="rounded border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-400">
          <strong className="font-medium text-zinc-800 dark:text-zinc-200">[Platzhalter]</strong> Name und
          vollständige Anschrift des Verantwortlichen (z. B. Schule, Schulträger oder Betreiber dieser Instanz)
          einfügen.
        </p>
        <p className="rounded border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-400">
          <strong className="font-medium text-zinc-800 dark:text-zinc-200">[Optional]</strong> Kontakt E-Mail oder
          Telefon für allgemeine Anfragen.
        </p>
      </Section>

      <Section id="dsb" title="2. Datenschutzbeauftragte / Datenschutzbeauftragter">
        <p className="rounded border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-400">
          <strong className="font-medium text-zinc-800 dark:text-zinc-200">[Platzhalter]</strong> Sofern gesetzlich
          erforderlich oder bestellt: Name und Kontaktdaten der Datenschutzbeauftragten / des Datenschutzbeauftragten.
          Wenn kein DSB benannt ist: „Für uns ist keine Bestellung einer Datenschutzbeauftragten / eines
          Datenschutzbeauftragten erforderlich.“ (nur wenn zutreffend)
        </p>
      </Section>

      <Section id="zwecke" title="3. Zwecke der Verarbeitung und Rechtsgrundlagen">
        <p>Wir verarbeiten personenbezogene Daten zu folgenden Zwecken:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-medium text-zinc-900 dark:text-zinc-100">Bereitstellung der Anwendung</strong>{' '}
            (Registrierung, Anmeldung, Schul- und Nutzerkontext, Rollen, technische Sicherheit): Rechtsgrundlage in der
            Regel{' '}
            <strong className="font-medium text-zinc-900 dark:text-zinc-100">Art. 6 Abs. 1 lit. b DSGVO</strong>{' '}
            (Vertrag bzw. vorvertragliche Maßnahmen) bzw. bei öffentlichen Schulen zusätzlich{' '}
            <strong className="font-medium text-zinc-900 dark:text-zinc-100">Art. 6 Abs. 1 lit. e DSGVO</strong> i. V.
            m. einschlägigem Landesrecht, soweit die Verarbeitung zur Erfüllung einer Aufgabe im öffentlichen Interesse
            erforderlich ist.
          </li>
          <li>
            <strong className="font-medium text-zinc-900 dark:text-zinc-100">Dokumentenverwaltung</strong> (Metadaten,
            Texte, Dateien, Versionen, Freigaben, Protokolle soweit vorgesehen):{' '}
            <strong className="font-medium text-zinc-900 dark:text-zinc-100">Art. 6 Abs. 1 lit. b</strong> bzw.{' '}
            <strong className="font-medium text-zinc-900 dark:text-zinc-100">lit. e DSGVO</strong>, je nach
            Verantwortlichkeit und Aufgabenstellung.
          </li>
          <li>
            <strong className="font-medium text-zinc-900 dark:text-zinc-100">KI-gestützte Funktionen</strong>{' '}
            (z. B. Fragen an die Wissensbasis, Zusammenfassungen, Entwurfs- und Analysefunktionen): Es werden insbesondere
            Eingaben der Nutzer sowie ausgewählte Dokumentinhalte bzw. Auszüge an einen{' '}
            <strong className="font-medium text-zinc-900 dark:text-zinc-100">externen KI-Dienst</strong> übermittelt,
            soweit diese Funktionen genutzt werden. Rechtsgrundlage ist je nach Konstellation{' '}
            <strong className="font-medium text-zinc-900 dark:text-zinc-100">Art. 6 Abs. 1 lit. b</strong> oder{' '}
            <strong className="font-medium text-zinc-900 dark:text-zinc-100">lit. e DSGVO</strong>; soweit besondere
            Kategorien personenbezogener Daten betroffen sein können, prüfen Sie zusätzlich{' '}
            <strong className="font-medium text-zinc-900 dark:text-zinc-100">Art. 9 DSGVO</strong> und ggf. eine
            Einwilligung oder eine unionsrechtliche bzw. mitgliedstaatliche Erlaubnisnorm.
          </li>
          <li>
            <strong className="font-medium text-zinc-900 dark:text-zinc-100">Protokollierung technischer Vorgänge</strong>{' '}
            (z. B. Nutzungs- und Fehlerprotokolle auf Serverebene, begrenzte Metadaten zu KI-Anfragen in der Anwendung):
            <strong className="font-medium text-zinc-900 dark:text-zinc-100"> Art. 6 Abs. 1 lit. f DSGVO</strong>{' '}
            (berechtigtes Interesse an Betrieb, IT-Sicherheit und Missbrauchsprävention); soweit Protokolle der
            Nachweisbarkeit dienen, kann auch{' '}
            <strong className="font-medium text-zinc-900 dark:text-zinc-100">lit. b</strong> oder{' '}
            <strong className="font-medium text-zinc-900 dark:text-zinc-100">lit. e DSGVO</strong> einschlägig sein.
          </li>
          <li>
            <strong className="font-medium text-zinc-900 dark:text-zinc-100">Erstanlage einer Schule (Selbstregistrierung)</strong>
            : Die Bestätigung, die Datenschutzhinweise zur Kenntnis genommen zu haben, wird mit Zeitstempel gespeichert.
            Rechtsgrundlage: <strong className="font-medium text-zinc-900 dark:text-zinc-100">Art. 6 Abs. 1 lit. a DSGVO</strong>{' '}
            (Einwilligung), soweit Sie diese Einwilligung abgeben.
          </li>
          <li>
            <strong className="font-medium text-zinc-900 dark:text-zinc-100">Löschanfragen</strong>: Wenn Sie im Konto
            eine Löschanfrage auslösen, speichern wir die dafür erforderlichen Angaben (z. B. Kennung des Nutzers,
            Schule, E-Mail, Zeitpunkt), damit die Anfrage bearbeitet werden kann. Rechtsgrundlage:{' '}
            <strong className="font-medium text-zinc-900 dark:text-zinc-100">Art. 6 Abs. 1 lit. b</strong> bzw.{' '}
            <strong className="font-medium text-zinc-900 dark:text-zinc-100">lit. e DSGVO</strong> im Zusammenhang mit
            Betroffenenrechten nach Art. 17 DSGVO bzw. internen Verfahren.
          </li>
        </ul>
      </Section>

      <Section id="kategorien" title="4. Kategorien personenbezogener Daten">
        <p>Je nach Nutzung können insbesondere verarbeitet werden:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Stammdaten zu Nutzerkonten (z. B. Name, E-Mail-Adresse, Schulnummer, organisatorische Zuordnung, Rollen)</li>
          <li>Inhalte und Metadaten zu Dokumenten (z. B. Titel, Status, Verantwortliche, Schutzstufen, Prüfdaten)</li>
          <li>
            Dateiinhalte und abgeleitete Texte (z. B. für Suche, Anzeige und KI), soweit Sie diese in die Anwendung
            einstellen
          </li>
          <li>
            Nutzungsdaten zu KI-Funktionen (z. B. gestellte Fragen, Auszüge aus Antworten, Quellenverweise, technische
            Kennungen der Anfrage), soweit in der Anwendung vorgesehen
          </li>
          <li>Technische Verbindungsdaten, die bei der Nutzung von Webangeboten üblich sind (z. B. IP-Adresse, Zeitstempel)</li>
        </ul>
      </Section>

      <Section id="empfaenger" title="5. Empfänger und Auftragsverarbeiter">
        <p>
          Eine Weitergabe an Dritte erfolgt nur, soweit dies zur Vertragserfüllung erforderlich ist, gesetzlich vorgesehen
          ist oder auf Grundlage einer zulässigen Weisung des Verantwortlichen (z. B. Auftragsverarbeitung nach Art. 28
          DSGVO).
        </p>
        <p>Zur Bereitstellung dieser Anwendung können insbesondere folgende Kategorien von Dienstleistern eingesetzt werden:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-medium text-zinc-900 dark:text-zinc-100">Hosting und Datenbank / Authentifizierung</strong>{' '}
            über <strong className="font-medium text-zinc-900 dark:text-zinc-100">Supabase</strong> (Supabase Inc.,
            Anbieter von Datenbank-, Speicher- und Authentifizierungsdiensten). Speicherort und Unterauftragsverarbeiter
            richten sich nach der Konfiguration Ihres Projekts und den jeweiligen{' '}
            <a
              href="https://supabase.com/privacy"
              className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
              target="_blank"
              rel="noopener noreferrer"
            >
              Datenschutzinformationen des Anbieters
            </a>
            .
          </li>
          <li>
            <strong className="font-medium text-zinc-900 dark:text-zinc-100">KI-Dienste</strong>: Die Anwendung kann so
            konfiguriert sein, dass Eingaben und Dokumentauszüge an einen externen Sprachmodell-Anbieter übermittelt
            werden (z. B. Google Gemini / Generative Language API oder ein OpenAI-kompatibler Endpunkt). Welcher Anbieter
            konkret angebunden ist, entnehmen Sie bitte der technischen Konfiguration Ihrer Instanz bzw. Ihrer
            Organisation.
          </li>
          <li className="rounded border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-400">
            <strong className="font-medium text-zinc-800 dark:text-zinc-200">[Optional]</strong> Hosting der
            Webanwendung (z. B. Vercel Inc. oder eigener Server) — Anbieter und Vertragspartner hier eintragen.
          </li>
        </ul>
      </Section>

      <Section id="drittland" title="6. Datenübermittlung in Drittländer">
        <p>
          Soweit Dienstleister außerhalb des Europäischen Wirtschaftsraums (EWR) ansässig sind oder dort auf Daten
          zugreifen, stellen wir — soweit erforderlich — die vom EU-Recht geforderten Garantien sicher, insbesondere
          durch das Abschließen der EU-Standardvertragsklauseln und zusätzliche technische und organisatorische
          Maßnahmen. Näheres zu den jeweiligen Übermittlungen entnehmen Sie bitte den Datenschutzinformationen der
          eingesetzten Anbieter und Ihrer vertraglichen Regelungen.
        </p>
      </Section>

      <Section id="dauer" title="7. Speicherdauer">
        <p>
          Personenbezogene Daten werden gelöscht oder eingeschränkt verarbeitet, sobald der Zweck der Speicherung
          entfällt, es sei denn, gesetzliche Aufbewahrungspflichten stehen dem entgegen oder eine weitere Speicherung ist
          zur Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen erforderlich.
        </p>
        <p>
          Konkrete Fristen für Dokumente, Protokolle und KI-Verläufe können sich aus Ihrer internen{' '}
          <strong className="font-medium text-zinc-900 dark:text-zinc-100">Löschkonzeption</strong>, aus dem Vertrag mit
          Ihrem Dienstleister und aus technischen Funktionen (z. B. Archivierung, Löschung bei Dokumenten-Endlöschung)
          ergeben. Bitte ergänzen Sie hier die für Ihre Einrichtung geltenden Fristen.
        </p>
      </Section>

      <Section id="rechte" title="8. Ihre Rechte">
        <p>Soweit die DSGVO anwendbar ist, stehen Ihnen — gegenüber dem jeweiligen Verantwortlichen — insbesondere zu:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-medium text-zinc-900 dark:text-zinc-100">Auskunft</strong> (Art. 15 DSGVO),{' '}
            <strong className="font-medium text-zinc-900 dark:text-zinc-100">Berichtigung</strong> (Art. 16 DSGVO),{' '}
            <strong className="font-medium text-zinc-900 dark:text-zinc-100">Löschung</strong> (Art. 17 DSGVO),{' '}
            <strong className="font-medium text-zinc-900 dark:text-zinc-100">Einschränkung</strong> der Verarbeitung (Art.
            18 DSGVO)
          </li>
          <li>
            <strong className="font-medium text-zinc-900 dark:text-zinc-100">Datenübertragbarkeit</strong> (Art. 20
            DSGVO), soweit die Voraussetzungen vorliegen; in der Anwendung kann ein strukturierter Datenexport in
            maschinenlesbarem Format angeboten werden
          </li>
          <li>
            <strong className="font-medium text-zinc-900 dark:text-zinc-100">Widerspruch</strong> gegen Verarbeitungen,
            die auf Art. 6 Abs. 1 lit. f DSGVO beruhen (Art. 21 DSGVO), unter den dort genannten Voraussetzungen
          </li>
          <li>
            <strong className="font-medium text-zinc-900 dark:text-zinc-100">Widerruf</strong> erteilter Einwilligungen
            mit Wirkung für die Zukunft (Art. 7 Abs. 3 DSGVO), ohne dass die Rechtmäßigkeit der aufgrund der Einwilligung
            bis zum Widerruf erfolgten Verarbeitung berührt wird
          </li>
        </ul>
        <p>
          Außerdem haben Sie das Recht, sich bei einer{' '}
          <strong className="font-medium text-zinc-900 dark:text-zinc-100">Datenschutz-Aufsichtsbehörde</strong> zu
          beschweren (Art. 77 DSGVO). Zuständig ist in der Regel die Aufsichtsbehörde Ihres gewöhnlichen Aufenthaltsorts,
          Ihres Arbeitsplatzes oder des Ortes des mutmaßlichen Verstoßes.
        </p>
      </Section>

      <Section id="ki-hinweis" title="9. Besondere Hinweise zu KI-Funktionen">
        <p>
          KI-Funktionen verarbeiten Inhalte, die Sie eingeben oder die aus von Ihnen freigegebenen Dokumenten gebildet
          werden. Je nach Konfiguration werden diese Daten an einen externen Anbieter übertragen und dort verarbeitet,
          um eine Antwort zu erzeugen. Verwenden Sie KI-Funktionen daher nicht für Daten, deren Verarbeitung Sie nicht
          beauftragt oder nicht dokumentiert haben.
        </p>
        <p>
          Optional kann (z. B. zu Diagnosezwecken) ein technisches Debug-Protokoll aktiviert werden, das{' '}
          <strong className="font-medium text-zinc-900 dark:text-zinc-100">umfangreiche Inhalte</strong> (z. B. Prompts
          und Textauszüge) in Server-Logdateien schreiben kann. Diese Option sollte nur nach sorgfältiger Prüfung und
          unter zusätzlichen technischen Vorgaben eingesetzt werden.
        </p>
      </Section>

      <Section id="cookies" title="10. Cookies und ähnliche Technologien">
        <p>
          Für die Anmeldung und die sichere Nutzung der Anwendung sind technisch notwendige Cookies bzw. vergleichbare
          Mechanismen (z. B. Sitzungsinformationen des Authentifizierungsdienstes) erforderlich. Es werden keine
          Tracking-Cookies zu Werbezwecken durch diese Datenschutzerklärung beschrieben, soweit sie nicht gesondert
          eingesetzt werden; ggf. ergänzen Sie hier ein Tracking oder eine Einwilligungslösung.
        </p>
      </Section>

      <Section id="sicherheit" title="11. Sicherheit der Verarbeitung">
        <p>
          Wir setzen technische und organisatorische Maßnahmen ein, um ein dem Risiko angemessenes Schutzniveau zu
          gewährleisten — etwa durch Zugriffsbeschränkungen, Verschlüsselung in der Datenübertragung (HTTPS), wo
          angeboten, und rollenbasierte Berechtigungen innerhalb der Anwendung. Details können Sie Ihrer{' '}
          <strong className="font-medium text-zinc-900 dark:text-zinc-100">Verzeichnis von Verarbeitungstätigkeiten</strong>{' '}
          oder Ihrem Sicherheitskonzept entnehmen bzw. hier konkretisieren.
        </p>
      </Section>

      <Section id="aenderungen" title="12. Änderung dieser Hinweise">
        <p>
          Wir behalten uns vor, diese Datenschutzhinweise anzupassen, damit sie stets den aktuellen rechtlichen
          Anforderungen entsprechen oder Änderungen der Anwendung abbilden (z. B. bei neuen Funktionen). Für Ihren
          erneuten Besuch gilt die jeweils aktuelle Fassung.
        </p>
      </Section>

      <p className="mt-12 text-center text-xs text-zinc-500 dark:text-zinc-400">
        <Link href="/login" className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-400">
          Zur Anmeldung
        </Link>
        <span className="mx-2 text-zinc-300 dark:text-zinc-600">·</span>
        <Link href="/impressum" className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-400">
          Impressum
        </Link>
      </p>
    </article>
  );
}
