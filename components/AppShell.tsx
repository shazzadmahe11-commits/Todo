"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";

const LIGHT_BG = "#f5faf6";
const DARK_BG  = "#0d1710";

function applyTheme(t: "light" | "dark") {
  document.documentElement.classList.toggle("dark", t === "dark");
  const color = t === "light" ? LIGHT_BG : DARK_BG;
  document.documentElement.style.backgroundColor = color;
  document.body.style.backgroundColor = color;
  let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (!meta) { meta = document.createElement("meta"); meta.name = "theme-color"; document.head.appendChild(meta); }
  meta.content = color;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/login";
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = (localStorage.getItem("theme") as "light" | "dark") ?? "light";
    setTheme(saved);
    applyTheme(saved);
  }, []);

  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next); applyTheme(next);
    localStorage.setItem("theme", next);
  }

  useEffect(() => {
    if (!loading && !user && !isLogin) router.push("/login");
  }, [user, loading, isLogin]);

  if (isLogin) return <>{children}</>;
  if (loading || !user) return null;

  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column" }}>
      {/* Top nav */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        backgroundColor: "var(--bg)",
        borderBottom: "1px solid var(--border2)",
        backdropFilter: "blur(12px)",
      }}>
        <div style={{
          maxWidth: 680, margin: "0 auto",
          padding: "0 16px",
          height: 56,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          {/* Logo */}
          <Link href="/" style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 20, fontWeight: 800,
            color: "var(--accent)",
            textDecoration: "none",
            letterSpacing: "-0.5px",
          }}>
            Kamla.
          </Link>

          {/* Nav links */}
          <nav style={{ display:"flex", alignItems:"center", gap: 4 }}>
            <NavLink href="/" label="Today" active={pathname === "/"} />
            <NavLink href="/calendar" label="History" active={pathname === "/calendar"} />
          </nav>

          {/* Actions */}
          <div style={{ display:"flex", alignItems:"center", gap: 8 }}>
            <IconBtn onClick={toggle} label={theme === "light" ? "Dark mode" : "Light mode"}>
              {theme === "light" ? <MoonIcon /> : <SunIcon />}
            </IconBtn>
            <IconBtn onClick={async () => { await signOut(); router.push("/login"); }} label="Sign out">
              <SignOutIcon />
            </IconBtn>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main style={{ flex: 1, maxWidth: 680, margin: "0 auto", width: "100%", padding: "24px 16px 80px" }}>
        <div className="fade-up">{children}</div>
      </main>
    </div>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href} style={{
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      fontSize: 13, fontWeight: active ? 700 : 500,
      color: active ? "var(--accent)" : "var(--text3)",
      textDecoration: "none",
      padding: "6px 12px",
      borderRadius: 999,
      backgroundColor: active ? "var(--accent-bg)" : "transparent",
      transition: "all 0.15s ease",
    }}>
      {label}
    </Link>
  );
}

function IconBtn({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} aria-label={label} style={{
      width: 34, height: 34,
      display: "flex", alignItems: "center", justifyContent: "center",
      borderRadius: 10,
      border: "1px solid var(--border)",
      backgroundColor: "var(--surface)",
      color: "var(--text3)",
      cursor: "pointer",
      transition: "all 0.15s ease",
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--bg2)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text)"; }}
    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--surface)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text3)"; }}>
      {children}
    </button>
  );
}

function SunIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>;
}
function MoonIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
}
function SignOutIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
}
