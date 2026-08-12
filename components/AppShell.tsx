"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/login";
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("theme") as "dark" | "light" | null;
    const preferred = saved ?? "dark";
    setTheme(preferred);
    applyTheme(preferred);
  }, []);

  function applyTheme(t: "dark" | "light") {
    if (t === "light") document.documentElement.classList.add("light");
    else document.documentElement.classList.remove("light");
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    localStorage.setItem("theme", next);
  }

  useEffect(() => {
    if (!loading && !user && !isLoginPage) router.push("/login");
  }, [user, loading, isLoginPage]);

  if (isLoginPage) return <>{children}</>;
  if (loading || !user) return null;

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  const navLink = (href: string, label: string) => {
    const active = pathname === href;
    return (
      <Link href={href}
        className={`relative px-1 py-0.5 font-mono text-[11px] uppercase tracking-widest transition-colors ${
          active ? "grad-text" : "text-muted hover:text-soft"
        }`}>
        {label}
        {active && (
          <span className="absolute -bottom-0.5 left-0 right-0 h-px bg-grad rounded-full" />
        )}
      </Link>
    );
  };

  return (
    <>
      {/* Ambient glow */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0"
        style={{ background: "radial-gradient(ellipse 55% 35% at 15% -5%, var(--glow-a) 0%, transparent 65%), radial-gradient(ellipse 45% 30% at 90% 105%, var(--glow-b) 0%, transparent 65%)" }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col px-5 pb-20 pt-8 sm:px-8">

        {/* Header */}
        <header className="mb-10 flex items-center justify-between">
          <Link href="/" className="font-display text-[26px] italic grad-text select-none leading-none">
            Kamla.
          </Link>

          <div className="flex items-center gap-1">
            {/* Nav links */}
            <div className="flex items-center gap-1 rounded-full border border-line px-3 py-1.5 mr-2" style={{ backgroundColor: "var(--surface)" }}>
              {navLink("/", "Today")}
              <span className="text-line mx-1">·</span>
              {navLink("/calendar", "History")}
            </div>

            {/* Theme toggle */}
            <button onClick={toggleTheme}
              aria-label={theme === "dark" ? "Light mode" : "Dark mode"}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-muted transition-all hover:border-gradA hover:text-soft"
              style={{ backgroundColor: "var(--surface)" }}>
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>

            {/* Sign out */}
            <button onClick={handleSignOut}
              aria-label="Sign out"
              title={`Sign out (${user.email})`}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-muted transition-all hover:border-warn hover:text-warn"
              style={{ backgroundColor: "var(--surface)" }}>
              <SignOutIcon />
            </button>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="mt-12 flex items-center justify-between">
          <span className="font-mono text-[10px] text-muted/40">{user.email}</span>
          <span className="font-mono text-[10px] text-muted/30">Do.</span>
        </footer>
      </div>
    </>
  );
}
