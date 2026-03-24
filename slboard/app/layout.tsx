import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { UserMenu } from '../components/UserMenu';
import { SchoolContextBadge } from '../components/SchoolContextBadge';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'NOMOS EduGovernance Pro',
  description: 'KI-gestützte Dokumentenverwaltung für Schulen',
};

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
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
              <Link href="/" className="flex items-center">
                <Image
                  src="/nomos-logo-crop.png"
                  alt="NOMOS EduGovernance Pro"
                  width={440}
                  height={100}
                  className="h-20 w-auto object-contain object-left"
                  priority
                  unoptimized
                />
              </Link>

              <nav className="flex items-center gap-4 text-xs font-medium text-zinc-700 dark:text-zinc-200">
                <Link
                  href="/"
                  className="rounded-full px-3 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Dashboard
                </Link>
                <Link
                  href="/documents"
                  className="rounded-full px-3 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Dokumente
                </Link>
                <Link
                  href="/drafts"
                  className="rounded-full px-3 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Entwurfsassistent
                </Link>
                <Link
                  href="/admin"
                  className="rounded-full px-3 py-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                >
                  Admin
                </Link>
                <SchoolContextBadge />
              </nav>

              <UserMenu />
            </div>
          </header>

          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
