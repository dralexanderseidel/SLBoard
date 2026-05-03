import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { HeaderAccessProvider } from '../components/HeaderAccessContext';
import { AppChrome } from '../components/AppChrome';
import { ScrollToTop } from '../components/ScrollToTop';
import { AppToaster } from '../components/AppToaster';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'log/os Edu Governance Pro',
  description: 'KI-gestützte Dokumentenverwaltung für Schulen',
};

/** Kein CDN-/RSC-Caching der Shell: Session kommt aus Cookies (Vercel vs. lokal). */
export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <a
          href="#main-content"
          className="fixed left-4 top-4 z-[200] rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white opacity-0 shadow-lg outline-none pointer-events-none transition-opacity duration-150 focus:pointer-events-auto focus:opacity-100 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-zinc-950 md:left-[calc(21rem+1rem)]"
        >
          Zum Inhalt springen
        </a>
        <HeaderAccessProvider>
          <AppChrome>{children}</AppChrome>
        </HeaderAccessProvider>
        <ScrollToTop />
        <AppToaster />
      </body>
    </html>
  );
}
