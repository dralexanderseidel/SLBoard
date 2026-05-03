/**
 * Markenlogo log/os (Hell- und Dunkelschema).
 * Grafiken: `public/log-os-logo-light.png`, `public/log-os-logo-dark.png`
 */
export function LogOsLogo() {
  return (
    <span
      className="inline-flex shrink-0 items-center"
      role="img"
      aria-label="log/os – Ordnung. Struktur. Verstehen. KI für schulische Governance"
    >
      <img
        src="/log-os-logo-light.png"
        alt=""
        width={320}
        height={120}
        decoding="async"
        className="h-[5.25rem] w-auto max-w-[min(100%,360px)] object-contain object-left dark:hidden sm:h-[6rem] sm:max-w-[min(100%,420px)]"
      />
      <img
        src="/log-os-logo-dark.png"
        alt=""
        width={320}
        height={120}
        decoding="async"
        className="hidden h-[5.25rem] w-auto max-w-[min(100%,360px)] object-contain object-left dark:block sm:h-[6rem] sm:max-w-[min(100%,420px)]"
      />
    </span>
  );
}
