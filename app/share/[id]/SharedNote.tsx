"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";

type SharedNoteProps = {
  id: string;
  mode: "readonly" | "collab";
};

type Note = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
};

export default function SharedNote({ id, mode }: SharedNoteProps) {
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isReadonly = mode !== "collab";

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/share/${id}`, { cache: "no-store" });
        if (!res.ok) {
          setError("This note could not be found.");
          return;
        }
        const data = (await res.json()) as Note;
        if (!active) return;
        setNote(data);
      } catch {
        if (!active) return;
        setError("Unable to load this note.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (isReadonly) return;
    if (!note) return;

    let cancelled = false;
    let lastSeen = note.updatedAt;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/share/${id}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as Note;
        if (cancelled) return;
        if (data.updatedAt && data.updatedAt !== lastSeen) {
          lastSeen = data.updatedAt;
          setNote((current) => {
            return data;
          });
        }
      } catch {
        // ignore
      }
    }, 1200);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id, isReadonly, note]);

  useEffect(() => {
    if (isReadonly) return;
    if (!note) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      setSaving(true);
      fetch(`/api/share/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: note.title,
          content: note.content,
        }),
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) return;
          const data = (await res.json()) as Note;
          setNote(data);
        })
        .catch(() => {
          // ignore
        })
        .finally(() => setSaving(false));
    }, 500);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [id, isReadonly, note]);

  const chars = useMemo(
    () => (note?.content ?? "").length.toLocaleString(),
    [note?.content]
  );

  const words = useMemo(
    () =>
      (note?.content ?? "")
        .split(/\s+/)
        .filter(Boolean)
        .length.toLocaleString(),
    [note?.content]
  );

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-slate-100">
        <p className="text-sm text-slate-400">Loading note…</p>
      </main>
    );
  }

  if (error || !note) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-slate-100">
        <div className="rounded-2xl border border-slate-900 bg-black/80 px-6 py-5 text-sm text-slate-300">
          {error ?? "This note is not available."}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full flex items-center justify-center px-4 py-10 text-slate-100 bg-black">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-900 bg-black/80 px-5 py-4 flex flex-col gap-3">
        <header className="flex items-center justify-between gap-3 border-b border-slate-900 pb-3">
          <div>
            <p className="text-xs font-medium text-slate-100">still · share</p>
            <p className="text-[11px] text-slate-500">
              {isReadonly ? "read‑only view" : "live collaboration"}
            </p>
          </div>
          <div className="text-[11px] text-slate-500">
            {saving ? "saving…" : "synced"}
          </div>
        </header>

        <motion.input
          layout
          type="text"
          disabled={isReadonly}
          value={note.title}
          onChange={(e) =>
            setNote((n) => (n ? { ...n, title: e.target.value } : n))
          }
          placeholder="title"
          className="w-full rounded-xl border border-slate-800 bg-black/70 px-3.5 py-2.5 text-sm font-medium text-slate-100 placeholder:text-slate-600 outline-none ring-0 focus:border-slate-300 focus:ring-1 focus:ring-slate-200/70 disabled:opacity-60"
        />

        <div className="relative flex-1">
          <textarea
            readOnly={isReadonly}
            value={note.content}
            onChange={(e) =>
              setNote((n) => (n ? { ...n, content: e.target.value } : n))
            }
            placeholder={
              isReadonly
                ? "This note is shared in read‑only mode."
                : "Type together. Changes blend in a shared stream."
            }
            className="note-scroll h-[320px] w-full resize-none rounded-2xl border border-slate-800 bg-black/75 px-3.5 py-3.5 text-sm text-slate-100 placeholder:text-slate-600 outline-none ring-0 focus:border-slate-300 focus:ring-1 focus:ring-slate-200/70 disabled:opacity-60"
          />
        </div>

        <footer className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
          <span>
            {chars} characters, {words} words
          </span>
          <span>{isReadonly ? "view only" : "live · approximate realtime"}</span>
        </footer>
      </div>
    </main>
  );
}

