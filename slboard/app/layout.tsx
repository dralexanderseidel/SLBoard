import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { AppNavLink } from '../components/AppNavLink';
import { UserMenu } from '../components/UserMenu';
import { HeaderAccessProvider } from '../components/HeaderAccessContext';
import { SuperAdminNavLink } from '../components/SuperAdminNavLink';
import { NomosLogo } from '../components/NomosLogo';
import { GlobalSearch } from '../components/GlobalSearch';
import { ScrollToTop } from '../components/ScrollToTop';

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
        <div className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
          <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/90">
            <div className="mx-auto flex w-full max-w-7xl items-center gap-2 sm:gap-3 lg:gap-4 px-4 sm:px-6 py-3">
              <AppNavLink href="/" className="flex shrink-0 items-center self-center">
                <NomosLogo />
              </AppNavLink>

              <HeaderAccessProvider>
                <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 lg:gap-4">
                  <nav className="flex min-h-[2.5rem] min-w-0 flex-1 flex-nowrap items-center justify-start gap-x-2.5 sm:gap-x-3 md:gap-x-4 overflow-x-auto pl-1 text-xs font-medium text-zinc-700 [scrollbar-width:thin] dark:text-zinc-200 [&>*]:shrink-0">
                    <AppNavLink
                      href="/"
                      className="rounded-full px-3 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      Dashboard
                    </AppNavLink>
                    <AppNavLink
                      href="/documents"
                      className="rounded-full px-3 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      Dokumente
                    </AppNavLink>
                    <AppNavLink
                      href="/drafts"
                      className="rounded-full px-3 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      Entwurfsassistent
                    </AppNavLink>
                    <AppNavLink
                      href="/hilfe"
                      className="rounded-full px-3 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      Hilfe
                    </AppNavLink>
                    <AppNavLink
                      href="/admin"
                      className="rounded-full px-3 py-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                    >
                      Admin
                    </AppNavLink>
                    <SuperAdminNavLink />
                  </nav>

                  <GlobalSearch />

                  <div className="flex shrink-0 items-center border-l border-zinc-200 pl-4 sm:pl-6 dark:border-zinc-700">
                    <UserMenu />
                  </div>
                </div>
              </HeaderAccessProvider>
            </div>
          </header>

          <main>{children}</main>

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
        <ScrollToTop />
      </body>
    </html>
  );
}
