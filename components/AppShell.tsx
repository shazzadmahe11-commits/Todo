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
    document.documentElement.classList.toggle("light", t === "light");
  }

  function toggleTheme() {
    // Sync status bar color immediately
    const next2 = theme === "dark" ? "light" : "dark";
    let liveMeta = document.querySelector('meta[name="theme-color"][data-live]') as HTMLMetaElement | null;
    if (!liveMeta) { liveMeta = document.createElement("meta"); liveMeta.name = "theme-color"; liveMeta.setAttribute("data-live","1"); document.head.appendChild(liveMeta); }
    liveMeta.content = next2 === "dark" ? "#1a1030" : "#ddd4f8";
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next); applyTheme(next);
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
    <>
      {/* Multi-layer gradient glow — stays fixed */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(145deg, var(--bg-from) 0%, var(--bg-to) 100%)" }} />
        <div style={{ position:"absolute", top:"-20%", left:"-10%", width:"60%", height:"60%", borderRadius:"50%", background:"var(--glow-a)", filter:"blur(80px)" }} />
        <div style={{ position:"absolute", bottom:"-20%", right:"-10%", width:"55%", height:"55%", borderRadius:"50%", background:"var(--glow-b)", filter:"blur(80px)" }} />
        <div style={{ position:"absolute", top:"40%", left:"30%", width:"40%", height:"40%", borderRadius:"50%", background:"var(--glow-c)", filter:"blur(60px)" }} />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col px-4 pb-28 pt-6 sm:px-8 sm:pt-10">

        {/* Header */}
        <header className="mb-8 flex items-center justify-between gap-3">
          <Link href="/" className="font-display text-[28px] italic grad-text select-none leading-none">
            Kamla.
          </Link>

          <div className="flex items-center gap-2">
            {/* Nav pill — glass */}
            <nav className="flex items-center gap-0.5 rounded-full px-2 py-1.5 glass"
              style={{ boxShadow:"0 2px 16px rgba(0,0,0,0.12)" }}>
              <NavLink href="/" label="Today" active={pathname === "/"} />
              <span className="text-muted/30 mx-1">·</span>
              <NavLink href="/calendar" label="History" active={pathname === "/calendar"} />
            </nav>

            {/* Theme */}
            <button onClick={toggleTheme} aria-label="Toggle theme"
              className="flex h-9 w-9 items-center justify-center rounded-full glass text-muted hover:text-soft active:scale-90 transition-all"
              style={{ boxShadow:"0 2px 12px rgba(0,0,0,0.10)" }}>
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>

            {/* Sign out */}
            <button onClick={handleSignOut} aria-label="Sign out" title={`Sign out (${user.email})`}
              className="flex h-9 w-9 items-center justify-center rounded-full glass text-muted hover:text-warn active:scale-90 transition-all"
              style={{ boxShadow:"0 2px 12px rgba(0,0,0,0.10)" }}>
              <SignOutIcon />
            </button>
          </div>
        </header>

        <main className="flex-1 min-w-0 fade-up">{children}</main>

        <footer className="mt-10 flex items-center justify-between">
          <span className="font-mono text-[10px] text-muted truncate max-w-[200px]" style={{ opacity:0.4 }}>{user.email}</span>
          <span className="font-mono text-[10px] grad-text" style={{ opacity:0.5 }}>Kamla.</span>
        </footer>
      </div>
    </>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href}
      className={`relative px-3 py-1 rounded-full font-mono text-[11px] uppercase tracking-widest transition-all ${
        active ? "" : "text-muted hover:text-soft"
      }`}
      style={active ? { background:"var(--glass)", boxShadow:"inset 0 1px 0 rgba(255,255,255,0.1)" } : {}}>
      {active ? (
        <span className="grad-text">{label}</span>
      ) : label}
    </Link>
  );
}
