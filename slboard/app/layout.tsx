import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { AppNavLink } from '../components/AppNavLink';
import { HeaderNav } from '../components/HeaderNav';
import { UserMenu } from '../components/UserMenu';
import { HeaderAccessProvider } from '../components/HeaderAccessContext';
import { NomosLogo } from '../components/NomosLogo';
import { GlobalSearch } from '../components/GlobalSearch';
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
  title: 'NOMOS Edu Governance Pro',
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
          className="fixed left-4 top-4 z-[200] rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white opacity-0 shadow-lg outline-none pointer-events-none transition-opacity duration-150 focus:pointer-events-auto focus:opacity-100 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-zinc-950"
        >
          Zum Inhalt springen
        </a>
        <HeaderAccessProvider>
          <div className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
            <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/90">
              <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-3 sm:px-6 md:flex-row md:items-center md:gap-3 lg:gap-4">
                <div className="flex min-w-0 w-full flex-1 items-center gap-2 sm:gap-3 md:gap-3 lg:gap-4">
                  <AppNavLink href="/" className="flex shrink-0 items-center self-center">
                    <NomosLogo />
                  </AppNavLink>
                  <HeaderNav />
                </div>

                <div className="flex w-full min-w-0 items-center justify-end gap-2 border-t border-zinc-200 pt-2 dark:border-zinc-800 md:w-auto md:shrink-0 md:border-0 md:pt-0">
                  <div className="min-w-0 flex-1 md:flex-none">
                    <GlobalSearch />
                  </div>
                  <div className="flex shrink-0 items-center border-l border-zinc-200 pl-3 sm:pl-4 dark:border-zinc-700 md:pl-6">
                    <UserMenu />
                  </div>
                </div>
              </div>
            </header>

            <div id="main-content" tabIndex={-1}>
              {children}
            </div>

            <footer className="border-t border-zinc-200 bg-zinc-50/80 py-4 text-center text-[11px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
              <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
                <AppNavLink href="/datenschutz" className="hover:underline">
                  Datenschutz
                </AppNavLink>
                <span aria-hidden className="text-zinc-300 dark:text-zinc-600">
                  ·
                </span>
                <AppNavLink href="/impressum" className="hover:underline">
                  Impressum
                </AppNavLink>
              </nav>
            </footer>
          </div>
        </HeaderAccessProvider>
        <ScrollToTop />
        <AppToaster />
      </body>
    </html>
  );
}
