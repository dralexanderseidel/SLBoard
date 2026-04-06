/** Markenzeile; ersetzt fehlende /nomos-logo-crop.png und skaliert sauber im Header. */
export function NomosLogo() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 440 100"
      className="h-16 w-auto max-w-[min(100%,280px)] text-zinc-900 dark:text-zinc-100 sm:h-20 sm:max-w-[min(100%,360px)]"
      role="img"
      aria-label="NOMOS EduGovernance Pro"
    >
      <text
        x="8"
        y="58"
        fill="currentColor"
        style={{ fontFamily: 'system-ui, sans-serif', fontSize: 40, fontWeight: 700 }}
      >
        NOMOS
      </text>
      <text
        x="8"
        y="84"
        fill="currentColor"
        opacity={0.7}
        style={{ fontFamily: 'system-ui, sans-serif', fontSize: 13, fontWeight: 500 }}
      >
        EduGovernance Pro
      </text>
    </svg>
  );
}
