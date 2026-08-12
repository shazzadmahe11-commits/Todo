"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setMessage(null); setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage("Check your email for a confirmation link, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/"); router.refresh();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally { setLoading(false); }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-6" style={{ backgroundColor: "var(--bg)" }}>
      {/* Glow */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0"
        style={{ background: "radial-gradient(ellipse 60% 40% at 20% -10%, var(--glow-a) 0%, transparent 70%), radial-gradient(ellipse 50% 35% at 85% 110%, var(--glow-b) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="font-display text-4xl italic grad-text select-none">Kamla.</h1>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-widest text-muted">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </p>
        </div>

        {/* Card */}
        <div className="card p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"
                className="rounded-lg border border-line px-3.5 py-2.5 font-body text-sm text-bright placeholder:text-muted focus:border-gradA focus:outline-none transition-colors"
                style={{ backgroundColor: "var(--surface-2)" }} placeholder="you@example.com" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={6}
                className="rounded-lg border border-line px-3.5 py-2.5 font-body text-sm text-bright placeholder:text-muted focus:border-gradA focus:outline-none transition-colors"
                style={{ backgroundColor: "var(--surface-2)" }} placeholder="••••••••" />
            </div>

            {error && (
              <div className="rounded-lg border border-warn/30 px-3.5 py-2.5 font-mono text-xs text-warn" style={{ backgroundColor: "rgba(224,112,96,0.08)" }}>
                {error}
              </div>
            )}
            {message && (
              <div className="rounded-lg border border-gradB/30 px-3.5 py-2.5 font-mono text-xs text-soft" style={{ backgroundColor: "rgba(74,191,191,0.08)" }}>
                {message}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="mt-1 rounded-lg bg-grad py-3 font-mono text-[11px] uppercase tracking-widest text-paper disabled:opacity-50 transition-opacity shadow-sm">
              {loading ? "…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center font-mono text-[11px] text-muted">
          {mode === "signin" ? "No account? " : "Already have one? "}
          <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); setMessage(null); }}
            className="text-soft hover:text-bright transition-colors underline underline-offset-2">
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
