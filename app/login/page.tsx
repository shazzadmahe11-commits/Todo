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
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage("Check your email for a confirmation link, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/");
        router.refresh();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6">
      {/* Ambient glow */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0"
        style={{ background: "radial-gradient(ellipse 60% 40% at 20% -10%, rgba(124,111,205,0.18) 0%, transparent 70%), radial-gradient(ellipse 50% 35% at 85% 110%, rgba(74,191,191,0.14) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 w-full max-w-sm">
        <h1 className="mb-8 text-center font-display text-3xl italic grad-text select-none">
          Do.
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] uppercase tracking-wider text-muted">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="rounded border border-line bg-surface px-3 py-2 font-body text-sm text-bright placeholder:text-muted focus:border-gradA focus:outline-none transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] uppercase tracking-wider text-muted">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={6}
              className="rounded border border-line bg-surface px-3 py-2 font-body text-sm text-bright placeholder:text-muted focus:border-gradA focus:outline-none transition-colors"
            />
          </div>

          {error && (
            <p className="font-mono text-xs text-warn">{error}</p>
          )}
          {message && (
            <p className="font-mono text-xs text-gradB">{message}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded bg-grad py-2.5 font-mono text-xs uppercase tracking-wider text-paper disabled:opacity-50 transition-opacity"
          >
            {loading ? "…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center font-mono text-xs text-muted">
          {mode === "signin" ? "No account yet? " : "Already have one? "}
          <button
            onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); setMessage(null); }}
            className="text-soft hover:text-bright transition-colors"
          >
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
