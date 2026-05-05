type Variant = 'onDark' | 'onLight';

/**
 * Claim unter dem Logo: zwei Zeilen, zweite Zeile zweifarbig
 * (auf dunklem Grund: heller Claim, weiß + Petrol; auf hellem Grund: Zinc + Petrol).
 */
export function LogOsBrandTagline({ variant }: { variant: Variant }) {
  const claimMuted =
    variant === 'onDark'
      ? 'text-slate-400'
      : 'text-zinc-600 dark:text-zinc-400';
  const kiLead = variant === 'onDark' ? 'text-white' : 'text-zinc-900 dark:text-zinc-50';
  const govTone =
    variant === 'onDark'
      ? 'text-teal-300'
      : 'text-teal-600 dark:text-teal-400';

  return (
    <div className="mt-2 text-xs leading-snug sm:text-sm">
      <p className={claimMuted}>Ordnung. Struktur. Verstehen.</p>
      <p className={`mt-1.5 ${kiLead}`}>
        <span>KI für schulische </span>
        <span className={`font-medium ${govTone}`}>Governance</span>
      </p>
    </div>
  );
}
