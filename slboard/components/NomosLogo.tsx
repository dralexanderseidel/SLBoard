/** Markenzeile; skaliert sauber im Header. */
export function NomosLogo() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 400 100"
      preserveAspectRatio="xMinYMid meet"
      className="h-14 w-auto max-w-[min(100%,200px)] text-zinc-900 dark:text-zinc-100 sm:h-[4.25rem] sm:max-w-[min(100%,260px)]"
      role="img"
      aria-label="NOMOS Edu Governance Pro"
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
        y="88"
        fill="currentColor"
        opacity={0.7}
        style={{ fontFamily: 'system-ui, sans-serif', fontSize: 17, fontWeight: 500 }}
      >
        Edu Governance Pro
      </text>
    </svg>
  );
}
