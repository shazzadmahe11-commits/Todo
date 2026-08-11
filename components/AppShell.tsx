"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/login";
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Load saved theme on mount
  useEffect(() => {
    const saved = localStorage.getItem("theme") as "dark" | "light" | null;
    const preferred = saved ?? "dark";
    setTheme(preferred);
    applyTheme(preferred);
  }, []);

  function applyTheme(t: "dark" | "light") {
    if (t === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    localStorage.setItem("theme", next);
  }

  useEffect(() => {
    if (!loading && !user && !isLoginPage) {
      router.push("/login");
    }
  }, [user, loading, isLoginPage]);

  if (isLoginPage) return <>{children}</>;
  if (loading || !user) return null;

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  return (
    <>
      {/* Ambient gradient glow */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0"
        style={{ background: "radial-gradient(ellipse 60% 40% at 20% -10%, var(--glow-a) 0%, transparent 70%), radial-gradient(ellipse 50% 35% at 85% 110%, var(--glow-b) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-xl flex-col px-6 pb-16 pt-10 sm:px-8">
        <header className="mb-10 flex items-center justify-between">
          <Link href="/" className="font-display text-2xl italic grad-text select-none">
            Kamla
          </Link>
          <nav className="flex items-center gap-4 font-mono text-xs uppercase tracking-wider text-muted">
            <Link href="/" className="transition-colors hover:text-soft">Today</Link>
            <Link href="/calendar" className="transition-colors hover:text-soft">History</Link>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-line transition-colors hover:border-gradA hover:text-soft"
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>

            <button onClick={handleSignOut} className="transition-colors hover:text-warn">
              Sign out
            </button>
          </nav>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="mt-10 text-right font-mono text-[10px] text-muted/40 truncate">
          {user.email}
        </footer>
      </div>
    </>
  );
}
