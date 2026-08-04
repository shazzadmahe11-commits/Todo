import type { Metadata } from "next";
import { Fraunces, Inter, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
});

const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Do",
  description: "A quiet place to keep track of what needs doing.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${display.variable} ${body.variable} ${mono.variable} font-body antialiased`}
      >
        <div className="mx-auto flex min-h-screen max-w-xl flex-col px-6 pb-16 pt-10 sm:px-8">
          <header className="mb-10 flex items-baseline justify-between">
            <Link href="/" className="font-display text-2xl italic text-ink">
              Do.
            </Link>
            <nav className="flex gap-5 font-mono text-xs uppercase tracking-wider text-muted">
              <Link href="/" className="hover:text-ink">
                Today
              </Link>
              <Link href="/calendar" className="hover:text-ink">
                History
              </Link>
            </nav>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
