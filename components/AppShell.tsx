"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";

function SunIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}
function SignOutIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}

// These must match --bg in globals.css exactly
const DARK_BG  = "#0f0d1a";
const LIGHT_BG = "#f0ecff";

function applyTheme(t: "dark" | "light") {
  const isDark = t === "dark";
  document.documentElement.classList.toggle("light", !isDark);

  // Sync theme-color to the solid --bg value so status bar matches exactly
  const color = isDark ? DARK_BG : LIGHT_BG;
  let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = color;

  // Also update document.documentElement background-color directly
  document.documentElement.style.backgroundColor = color;
  document.body.style.backgroundColor = color;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/login";
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = (localStorage.getItem("theme") as "dark" | "light") ?? "dark";
    setTheme(saved);
    applyTheme(saved);
  }, []);

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

  return (
    <div className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col px-4 pb-28 pt-6 sm:px-8 sm:pt-10">
      <header className="mb-8 flex items-center justify-between gap-3">
        <Link href="/" className="font-display text-[28px] italic grad-text select-none leading-none shrink-0">
          Kamla.
        </Link>

        <div className="flex items-center gap-2">
          <nav className="flex items-center gap-0.5 rounded-full px-2 py-1.5 glass"
            style={{ boxShadow:"0 2px 16px rgba(0,0,0,0.15)" }}>
            <NavLink href="/" label="Today" active={pathname === "/"} />
            <span className="mx-1" style={{ color:"var(--muted)", opacity:0.4 }}>·</span>
            <NavLink href="/calendar" label="History" active={pathname === "/calendar"} />
          </nav>

          <button onClick={toggleTheme} aria-label="Toggle theme"
            className="flex h-9 w-9 items-center justify-center rounded-full glass text-muted hover:text-soft active:scale-90 transition-all">
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>

          <button onClick={handleSignOut} aria-label="Sign out" title={`Sign out (${user.email})`}
            className="flex h-9 w-9 items-center justify-center rounded-full glass text-muted hover:text-warn active:scale-90 transition-all">
            <SignOutIcon />
          </button>
        </div>
      </header>

      <main className="flex-1 min-w-0 fade-up">{children}</main>

      <footer className="mt-10 flex items-center justify-between">
        <span className="font-mono text-[10px] truncate max-w-[200px]" style={{ color:"var(--muted)", opacity:0.5 }}>{user.email}</span>
        <span className="font-mono text-[10px] grad-text" style={{ opacity:0.5 }}>Kamla.</span>
      </footer>
    </div>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href}
      className={`relative px-3 py-1 rounded-full font-mono text-[11px] uppercase tracking-widest transition-all ${
        active ? "" : "text-muted hover:text-soft"
      }`}
      style={active ? { background:"var(--glass)", boxShadow:"inset 0 1px 0 rgba(255,255,255,0.1)" } : {}}>
      {active ? <span className="grad-text">{label}</span> : label}
    </Link>
  );
}
