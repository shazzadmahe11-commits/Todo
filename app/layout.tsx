import type { Metadata } from "next";
import { Fraunces, Inter, IBM_Plex_Mono } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import AppShell from "@/components/AppShell";
import "./globals.css";

const display = Fraunces({ subsets:["latin"], weight:["500","600"], style:["normal","italic"], variable:"--font-display" });
const body    = Inter({ subsets:["latin"], weight:["400","500","600"], variable:"--font-body" });
const mono    = IBM_Plex_Mono({ subsets:["latin"], weight:["400","500"], variable:"--font-mono" });

export const metadata: Metadata = {
  title: "Kamla.",
  description: "A quiet place to keep track of what needs doing.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ backgroundColor: "#0f0d1a" }}>
      <head>
        {/* Solid color matching --bg in globals.css so status bar matches instantly */}
        <meta name="theme-color" content="#0f0d1a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Kamla." />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className={`${display.variable} ${body.variable} ${mono.variable} font-body antialiased`}>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
