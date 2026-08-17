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
    <div className="relative flex min-h-screen items-center justify-center px-5" style={{ backgroundColor:"var(--bg)" }}>
      {/* Gradient background */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(145deg, var(--bg-from) 0%, var(--bg-to) 100%)" }} />
        <div style={{ position:"absolute", top:"-20%", left:"-10%", width:"60%", height:"60%", borderRadius:"50%", background:"var(--glow-a)", filter:"blur(80px)" }} />
        <div style={{ position:"absolute", bottom:"-20%", right:"-10%", width:"55%", height:"55%", borderRadius:"50%", background:"var(--glow-b)", filter:"blur(80px)" }} />
      </div>

      <div className="relative z-10 w-full max-w-sm fade-up">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="font-display text-5xl italic grad-text select-none" style={{ lineHeight:1 }}>Kamla.</h1>
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </p>
        </div>

        {/* Glass card */}
        <div className="glass p-6 sm:p-8" style={{ boxShadow:"0 8px 40px rgba(0,0,0,0.15)" }}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"
                placeholder="you@example.com"
                className="w-full rounded-2xl px-4 py-3 font-body text-[15px] text-bright placeholder:text-muted focus:outline-none transition-all"
                style={{ background:"var(--surface-2)", border:"1px solid var(--line)" }}
                onFocus={e => e.currentTarget.style.borderColor = "#7C6FCD"}
                onBlur={e => e.currentTarget.style.borderColor = "var(--line)"} />
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={6}
                placeholder="••••••••"
                className="w-full rounded-2xl px-4 py-3 font-body text-[15px] text-bright placeholder:text-muted focus:outline-none transition-all"
                style={{ background:"var(--surface-2)", border:"1px solid var(--line)" }}
                onFocus={e => e.currentTarget.style.borderColor = "#7C6FCD"}
                onBlur={e => e.currentTarget.style.borderColor = "var(--line)"} />
            </div>

            {error && (
              <div className="rounded-2xl px-4 py-3 font-mono text-xs text-warn"
                style={{ background:"var(--warn-bg)", border:"1px solid var(--warn-border)" }}>
                {error}
              </div>
            )}
            {message && (
              <div className="rounded-2xl px-4 py-3 font-mono text-xs text-soft"
                style={{ background:"rgba(74,191,191,0.08)", border:"1px solid rgba(74,191,191,0.20)" }}>
                {message}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="grad-btn w-full rounded-2xl py-3.5 font-mono text-[12px] uppercase tracking-widest text-white mt-1">
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
