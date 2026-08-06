"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/login";

  useEffect(() => {
    if (!loading && !user && !isLoginPage) {
      router.push("/login");
    }
  }, [user, loading, isLoginPage]);

  // On the login page, render bare (no nav, no shell)
  if (isLoginPage) return <>{children}</>;

  // While checking session, show nothing to avoid flash
  if (loading || !user) return null;

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  return (
    <>
      {/* Ambient gradient glow */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0"
        style={{ background: "radial-gradient(ellipse 60% 40% at 20% -10%, rgba(124,111,205,0.18) 0%, transparent 70%), radial-gradient(ellipse 50% 35% at 85% 110%, rgba(74,191,191,0.14) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-xl flex-col px-6 pb-16 pt-10 sm:px-8">
        <header className="mb-10 flex items-baseline justify-between">
          <Link href="/" className="font-display text-2xl italic grad-text select-none">
            Do.
          </Link>
          <nav className="flex items-baseline gap-5 font-mono text-xs uppercase tracking-wider text-muted">
            <Link href="/" className="transition-colors hover:text-soft">Today</Link>
            <Link href="/calendar" className="transition-colors hover:text-soft">History</Link>
            <button onClick={handleSignOut} className="transition-colors hover:text-warn">
              Sign out
            </button>
          </nav>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="mt-10 font-mono text-[10px] text-muted/40 text-right truncate">
          {user.email}
        </footer>
      </div>
    </>
  );
}
