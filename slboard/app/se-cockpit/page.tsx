import type { Metadata } from 'next';
import { SeCockpitPageClient } from './SeCockpitPageClient';

export const metadata: Metadata = {
  title: 'Steuerungs-Cockpit | log/os Edu Governance Pro',
  description:
    'Schulweite Auswertung der Steuerungsanalysen: Matrix, Kennzahlen und Dokumentbezug.',
};

export default function SeCockpitPage() {
  return <SeCockpitPageClient />;
}
