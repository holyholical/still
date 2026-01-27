"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !password) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, password }),
      });
      if (!res.ok) {
        setError("Could not sign in with those details.");
        return;
      }
      try {
        window.localStorage.setItem(
          "still.local.session",
          JSON.stringify({ email: trimmed })
        );
      } catch {
        // ignore
      }
      router.push("/");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen w-full flex items-center justify-center px-4 py-10 bg-black text-slate-100">
      <div className="w-full max-w-sm rounded-2xl border border-slate-900 bg-black/80 px-5 py-6 space-y-4">
        <header className="space-y-1">
          <p className="text-sm font-medium text-slate-100">still · account</p>
          <p className="text-xs text-slate-500">
            Use an email and a simple password. We keep it on this machine.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[11px] text-slate-400">Email</label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@still.app"
              className="h-9 w-full rounded-full border border-slate-800 bg-black/70 px-3 text-xs text-slate-100 placeholder:text-slate-600 outline-none ring-0 focus:border-slate-300 focus:ring-1 focus:ring-slate-200/70"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] text-slate-400">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
              className="h-9 w-full rounded-full border border-slate-800 bg-black/70 px-3 text-xs text-slate-100 placeholder:text-slate-600 outline-none ring-0 focus:border-slate-300 focus:ring-1 focus:ring-slate-200/70"
            />
          </div>
          {error && (
            <p className="text-[11px] text-rose-400" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="mt-2 flex h-9 w-full items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[11px] font-semibold text-black transition hover:bg-white disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}

