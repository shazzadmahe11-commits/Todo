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
      <body className={`${display.variable} ${body.variable} ${mono.variable} font-body antialiased bg-paper text-bright`}>

        {/* Ambient gradient glow — the signature element */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 40% at 20% -10%, rgba(124,111,205,0.18) 0%, transparent 70%), radial-gradient(ellipse 50% 35% at 85% 110%, rgba(74,191,191,0.14) 0%, transparent 70%)",
          }}
        />

        <div className="relative z-10 mx-auto flex min-h-screen max-w-xl flex-col px-6 pb-16 pt-10 sm:px-8">
          <header className="mb-10 flex items-baseline justify-between">
            <Link href="/" className="font-display text-2xl italic grad-text select-none">
              Do.
            </Link>
            <nav className="flex gap-5 font-mono text-xs uppercase tracking-wider text-muted">
              <Link href="/" className="transition-colors hover:text-soft">
                Today
              </Link>
              <Link href="/calendar" className="transition-colors hover:text-soft">
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
