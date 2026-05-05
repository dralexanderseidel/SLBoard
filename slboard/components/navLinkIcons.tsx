import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { className?: string };

const base =
  'shrink-0 text-current [stroke-linecap:round] [stroke-linejoin:round]';

/** Kleine Nav-Grafiken (Mockup-Stil), `currentColor` für aktiv/inaktiv. */
export function NavIconDashboard(props: IconProps) {
  const { className, ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
      className={`${base} size-4 ${className ?? ''}`}
      {...rest}
    >
      <rect x="3" y="3" width="7" height="7" rx="1.2" />
      <rect x="14" y="3" width="7" height="7" rx="1.2" />
      <rect x="3" y="14" width="7" height="7" rx="1.2" />
      <rect x="14" y="14" width="7" height="7" rx="1.2" />
    </svg>
  );
}

export function NavIconDocuments(props: IconProps) {
  const { className, ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
      className={`${base} size-4 ${className ?? ''}`}
      {...rest}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M8 13h8M8 17h5" />
    </svg>
  );
}

/** Matrix / Steuerungs-Cockpit */
export function NavIconSeCockpit(props: IconProps) {
  const { className, ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      aria-hidden
      className={`${base} size-4 ${className ?? ''}`}
      {...rest}
    >
      <rect x="3" y="3" width="5" height="5" rx="0.8" />
      <rect x="9.5" y="3" width="5" height="5" rx="0.8" />
      <rect x="16" y="3" width="5" height="5" rx="0.8" />
      <rect x="3" y="9.5" width="5" height="5" rx="0.8" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="0.8" />
      <rect x="16" y="9.5" width="5" height="5" rx="0.8" />
      <rect x="3" y="16" width="5" height="5" rx="0.8" />
      <rect x="9.5" y="16" width="5" height="5" rx="0.8" />
      <rect x="16" y="16" width="5" height="5" rx="0.8" />
    </svg>
  );
}

export function NavIconDrafts(props: IconProps) {
  const { className, ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
      className={`${base} size-4 ${className ?? ''}`}
      {...rest}
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

export function NavIconHelp(props: IconProps) {
  const { className, ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
      className={`${base} size-4 ${className ?? ''}`}
      {...rest}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function NavIconAdmin(props: IconProps) {
  const { className, ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
      className={`${base} size-4 ${className ?? ''}`}
      {...rest}
    >
      <line x1="4" x2="4" y1="21" y2="14" />
      <line x1="4" x2="4" y1="10" y2="3" />
      <line x1="12" x2="12" y1="21" y2="12" />
      <line x1="12" x2="12" y1="8" y2="3" />
      <line x1="20" x2="20" y1="21" y2="16" />
      <line x1="20" x2="20" y1="12" y2="3" />
      <line x1="2" x2="6" y1="14" y2="14" />
      <line x1="10" x2="14" y1="8" y2="8" />
      <line x1="18" x2="22" y1="16" y2="16" />
    </svg>
  );
}

export function NavIconSuperAdmin(props: IconProps) {
  const { className, ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
      className={`${base} size-4 ${className ?? ''}`}
      {...rest}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
