/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { LogIn, LogOut } from "lucide-react";
import {
  IconPlus,
  IconLogout2,
  IconLoader2,
  IconTrash,
  IconNotebook,
  IconStar,
} from "@tabler/icons-react";

type Note = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
  pinned?: boolean;
};

type Session = {
  email: string;
};

const LOCAL_KEY_NOTES = "still.local.notes";
const LOCAL_KEY_DRAFT = "still.local.draft";
const LOCAL_KEY_SESSION = "still.local.session";

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<"all" | "pinned">("all");
  const [draftContent, setDraftContent] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareMode, setShareMode] = useState<"readonly" | "collab" | null>(
    null
  );
  const [shareError, setShareError] = useState<string | null>(null);

  const visibleNotes = useMemo(
    () =>
      view === "all" ? notes : notes.filter((n) => n.pinned),
    [notes, view]
  );

  const activeNote = useMemo(
    () => notes.find((n) => n.id === activeId) ?? null,
    [notes, activeId]
  );

  // Local-first: hydrate from localStorage immediately on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedSessionRaw = window.localStorage.getItem(LOCAL_KEY_SESSION);
    if (storedSessionRaw) {
      try {
        const parsed = JSON.parse(storedSessionRaw) as Session;
        if (parsed?.email) {
          setSession(parsed);
        }
      } catch {
        // ignore
      }
    }

    const storedNotesRaw = window.localStorage.getItem(LOCAL_KEY_NOTES);
    if (storedNotesRaw) {
      try {
        const parsed = JSON.parse(storedNotesRaw) as Note[];
        setNotes(parsed);
        if (parsed.length > 0) {
          setActiveId(parsed[0].id);
        }
      } catch {
        // ignore
      }
    }

    const storedDraftRaw = window.localStorage.getItem(LOCAL_KEY_DRAFT);
    if (storedDraftRaw) {
      try {
        const parsed = JSON.parse(storedDraftRaw) as {
          title: string;
          content: string;
        };
        setDraftTitle(parsed.title ?? "");
        setDraftContent(parsed.content ?? "");
      } catch {
        // ignore
      }
    }

    setInitializing(false);
  }, []);

  // Persist notes + draft locally whenever they change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LOCAL_KEY_NOTES, JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      LOCAL_KEY_DRAFT,
      JSON.stringify({ title: draftTitle, content: draftContent })
    );
  }, [draftTitle, draftContent]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (session) {
      window.localStorage.setItem(LOCAL_KEY_SESSION, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(LOCAL_KEY_SESSION);
    }
  }, [session]);

  // Once we know about an authenticated session, sync from the server.
  useEffect(() => {
    if (!session) return;

    const sync = async () => {
      try {
        const res = await fetch("/api/notes", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { notes?: Note[] };
        if (data.notes) {
          setNotes(data.notes);
          if (data.notes.length > 0) {
            setActiveId(data.notes[0].id);
          }
        }
      } catch {
        // offline or server unavailable; we stay purely local
      }
    };

    void sync();
  }, [session]);

  // Debounced save to server when editing an authenticated note.
  useEffect(() => {
    if (!session) return;
    if (!activeId) return;

    const note = notes.find((n) => n.id === activeId);
    if (!note) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      setIsSaving(true);
      fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: note.id,
          title: note.title,
          content: note.content,
          pinned: note.pinned ?? false,
        }),
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) return;
          const data = (await res.json()) as { notes?: Note[] };
          if (data.notes) {
            setNotes(data.notes);
          }
        })
        .catch(() => {
          // ignore network errors; local state remains the source of truth
        })
        .finally(() => setIsSaving(false));
    }, 450);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [notes, activeId, session]);

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    } finally {
      setSession(null);
      setActiveId(null);
    }
  };

  const createNewNote = () => {
    const now = new Date().toISOString();
    const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const baseTitle = draftTitle.trim() || "Untitled";
    const baseContent = draftContent;

    const fresh: Note = {
      id,
      title: baseTitle,
      content: baseContent,
      updatedAt: now,
      pinned: false,
    };
    setNotes((prev) => [fresh, ...prev]);
    setActiveId(id);
  };

  const deleteCurrentNote = async () => {
    if (!activeId) return;
    const id = activeId;
    setNotes((prev) => prev.filter((n) => n.id !== id));
    setActiveId((prev) => (prev === id ? null : prev));

    if (session) {
      try {
        await fetch(`/api/notes?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
      } catch {
        // ignore
      }
    }
  };

  const togglePinned = () => {
    if (!activeId) return;
    setNotes((prev) =>
      prev.map((n) =>
        n.id === activeId ? { ...n, pinned: !n.pinned } : n
      )
    );
  };
  const createShareLink = async (mode: "readonly" | "collab") => {
    if (!activeId) {
      setShareError("Pick a note first.");
      setShareUrl(null);
      setShareMode(null);
      setShareOpen(true);
      return;
    }
  
    const note = notes.find((n) => n.id === activeId);
    if (!note) {
      setShareError("Note not found.");
      setShareUrl(null);
      setShareMode(null);
      setShareOpen(true);
      return;
    }
  
    try {
      // First, ensure the note exists on the server (cookie-auth).
      const saveRes = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: note.id,
          title: note.title,
          content: note.content,
          pinned: note.pinned ?? false,
        }),
        credentials: "include",
      });
    
      if (!saveRes.ok) {
        if (saveRes.status === 401) {
          setShareError("Sign in on the auth page to share this note.");
        } else {
          setShareError("Could not save this note for sharing.");
        }
        setShareUrl(null);
        setShareMode(null);
        setShareOpen(true);
        return;
      }
    
      const res = await fetch("/api/notes/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId: activeId }),
        credentials: "include",
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          setShareError("Sign in on the auth page to share this note.");
        } else if (res.status === 404) {
          setShareError("Note not found on server. Try saving it first.");
        } else {
          setShareError("Could not create a share link right now.");
        }
        setShareUrl(null);
        setShareMode(null);
        setShareOpen(true);
        return;
      }
      
      const data = await res.json();
      
      if (!data.shareId) {
        setShareError("Something went wrong. Try again in a moment.");
        setShareUrl(null);
        setShareMode(null);
        setShareOpen(true);
        return;
      }
    
      const base =
        typeof window !== "undefined"
          ? window.location.origin
          : "http://localhost:3000";
      const url = `${base}/share/${data.shareId}?mode=${mode}`;
    
      setShareUrl(url);
      setShareMode(mode);
      setShareError(null);
      setShareOpen(true);
    } catch (error) {
      console.error("Error creating share link:", error);
      setShareError("Something went wrong. Check your connection.");
      setShareUrl(null);
      setShareMode(null);
      setShareOpen(true);
    }
  };


  const handleTitleChange = (value: string) => {
    if (!activeId) {
      setDraftTitle(value);
      return;
    }
    setNotes((prev) =>
      prev.map((n) =>
        n.id === activeId ? { ...n, title: value || "Untitled" } : n
      )
    );
  };

  const handleContentChange = (value: string) => {
    if (!activeId) {
      setDraftContent(value);
      return;
    }
    setNotes((prev) =>
      prev.map((n) => (n.id === activeId ? { ...n, content: value } : n))
    );
  };

  const formattedUpdatedAt = activeNote
    ? new Date(activeNote.updatedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <main className="min-h-screen w-full flex items-center justify-center px-4 py-10 text-slate-100 bg-black">
      <div className="relative w-full max-w-6xl flex gap-6">
        <aside className="hidden sm:flex flex-col justify-between py-4 pr-4 border-r border-slate-900/80">
          <div className="flex flex-col items-center gap-4">
            <span className="text-xs font-semibold tracking-tight text-slate-200">
              still
            </span>
            <div className="h-10 w-[1px] rounded-full bg-slate-800/80" />
            <button
              type="button"
              onClick={() => setView("all")}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border text-slate-400 transition",
                view === "all"
                  ? "border-slate-200 bg-slate-50 text-black"
                  : "border-slate-900 bg-black hover:border-slate-600 hover:text-slate-100"
              )}
              aria-label="All notes"
            >
              <IconNotebook size={16} />
            </button>
            <button
              type="button"
              onClick={() => setView("pinned")}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border text-slate-400 transition",
                view === "pinned"
                  ? "border-slate-200 bg-slate-50 text-black"
                  : "border-slate-900 bg-black hover:border-slate-600 hover:text-slate-100"
              )}
              aria-label="Pinned notes"
            >
              <IconStar size={16} />
            </button>
          </div>
          <div className="flex flex-col items-center gap-3 text-slate-500">
            {session ? (
              <button
                onClick={handleSignOut}
                className="flex h-8 w-8 items-center justify-center rounded-full border text-slate-400 transition hover:text-slate-100 hover:border-slate-500"
              >
                <LogOut size={16} className="text-white"/>
              </button>
            ) : (
              <Link
                href="/auth"
                className="flex h-8 w-8 items-center justify-center rounded-full border text-slate-400 transition hover:text-slate-100 hover:border-slate-500"
              >
                <LogIn size={16} className="text-white"/>
              </Link>
            )}
          </div>
        </aside>

        <div className="relative flex-1 grid gap-6 lg:grid-cols-[minmax(0,0.36fr)_minmax(0,1fr)] items-stretch">
          <motion.section
            layout
            className="rounded-2xl border border-slate-900 bg-black/80 p-5 sm:p-6 lg:p-7 flex flex-col gap-4 lg:gap-5"
          >

            <div className="mt-1 rounded-2xl bg-black/60 border border-slate-900 px-3.5 py-2.5 flex items-center justify-between gap-3">
              <div className="text-xs leading-snug text-slate-300/90">
                <p className="font-medium">
                  {session ? "Signed in" : "Local first, then cloud."}
                </p>
                <p className="text-[11px] text-slate-400/95">
                  {session
                    ? `Notes follow ${session.email}`
                    : "Type instantly, sync when you sign in."}
                </p>
              </div>
            </div>

            <div className="mt-1 flex-1 rounded-2xl bg-black/60 border border-slate-900 p-2.5 flex flex-col gap-2 min-h-[180px] max-h-[320px]">
              <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-800">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400/90">
                  notes
                </p>
                <button
                  type="button"
                  onClick={createNewNote}
                  className="flex h-7 items-center gap-1.5 rounded-full border border-slate-800 bg-black px-2.5 text-[11px] font-medium text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
                >
                  <IconPlus size={14} className="text-sky-300" />
                  <span>new note</span>
                </button>
              </div>

              <div className="note-scroll mt-0.5 flex-1 space-y-1.5 overflow-y-auto pr-1">
                <AnimatePresence initial={false}>
                  {visibleNotes.length === 0 ? (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="rounded-xl border border-dashed border-slate-700/80 bg-slate-900/40 px-3 py-3 text-[11px] text-slate-500/95"
                    >
                      No {view === "all" ? "notes" : "pinned notes"} yet. Start
                      in the editor — we'll catch it.
                    </motion.div>
                  ) : (
                    visibleNotes.map((note) => (
                      <motion.button
                        key={note.id}
                        layout
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ type: "spring", stiffness: 320, damping: 26 }}
                        type="button"
                        onClick={() => setActiveId(note.id)}
                        className={cn(
                          "group w-full rounded-xl px-3.5 py-2.5 text-left text-xs transition-all",
                          "border border-slate-800/80 bg-black/60 hover:bg-black",
                          activeId === note.id &&
                            "border-slate-300 bg-gradient-to-r from-neutral-900 via-black to-neutral-900 shadow-[0_0_40px_rgba(250,250,250,0.12)]"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="line-clamp-1 text-[11px] font-medium text-slate-100/95">
                            {note.title || "Untitled"}
                          </p>
                          <span className="text-[10px] text-slate-500/95">
                            {new Date(note.updatedAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        {note.content && (
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-400/95">
                            {note.content}
                          </p>
                        )}
                      </motion.button>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>

            <footer className="mt-1 flex items-center justify-between text-[10px] text-slate-500/90">
              <span>⌘S not required. We save for you.</span>
              <span>{initializing ? "waking up…" : "ready when you are."}</span>
            </footer>
          </motion.section>

          <motion.section
            layout
            className="relative flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-slate-900 bg-black/80"
          >
            <header className="relative z-10 flex items-center justify-between border-b border-slate-900 px-5 py-3.5">
              <div className="space-y-0.5">
                <p className="text-xs font-medium tracking-tight text-slate-100">
                  {activeNote ? activeNote.title || "Untitled" : "Loose thoughts"}
                </p>
                <p className="text-[11px] text-slate-400/95">
                  {activeNote
                    ? `Last touched at ${formattedUpdatedAt ?? "—"}`
                    : "Start typing. We'll shape it gently."}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {activeNote && (
                  <div className="flex items-center gap-1.5 mr-1">
                    <button
                      type="button"
                      onClick={() => createShareLink("readonly")}
                      className="hidden sm:inline-flex h-7 items-center rounded-full border border-slate-800 bg-black px-2.5 text-[11px] text-slate-300 hover:border-slate-500 hover:text-slate-100"
                    >
                      share · view
                    </button>
                    <button
                      type="button"
                      onClick={() => createShareLink("collab")}
                      className="hidden sm:inline-flex h-7 items-center rounded-full border border-slate-800 bg-black px-2.5 text-[11px] text-slate-300 hover:border-slate-500 hover:text-slate-100"
                    >
                      share · collab
                    </button>
                  </div>
                )}
                {activeNote && (
                  <button
                    type="button"
                    onClick={togglePinned}
                    className={cn(
                      "flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] transition",
                      activeNote.pinned
                        ? "border-slate-200 bg-slate-50 text-black"
                        : "border-slate-800 bg-black text-slate-300 hover:border-slate-500 hover:text-slate-100"
                    )}
                  >
                    <IconStar
                      size={14}
                      className={
                        activeNote.pinned ? "text-white" : "text-slate-300"
                      }
                    />
                    <span>{activeNote.pinned ? "pinned" : "pin"}</span>
                  </button>
                )}
                {activeNote && (
                  <button
                    type="button"
                    onClick={deleteCurrentNote}
                    className="flex h-7 items-center gap-1.5 rounded-full border border-slate-700/80 bg-slate-950/60 px-2.5 text-[11px] text-slate-300/90 transition hover:bg-slate-900/90 hover:text-rose-200 hover:border-rose-400/80"
                  >
                    <IconTrash size={14} className="text-rose-300/80" />
                    <span>archive</span>
                  </button>
                )}
                {session && (
                  <span className="hidden sm:inline-flex items-center rounded-full border border-slate-700/70 bg-slate-950/50 px-2.5 py-1 text-[10px] text-slate-400/90">
                    syncing as
                    <span className="ml-1 truncate max-w-[110px] text-slate-200/95">
                      {session.email}
                    </span>
                  </span>
                )}
              </div>
            </header>

            <div className="relative z-10 flex flex-1 flex-col px-5 pb-4 pt-3 gap-3">
              <input
                type="text"
                placeholder="title, if it wants one"
                value={activeId ? activeNote?.title ?? "" : draftTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-black/70 px-3.5 py-2.5 text-sm font-medium text-slate-100 placeholder:text-slate-500/90 outline-none ring-0 focus:border-slate-300 focus:ring-1 focus:ring-slate-200/70"
              />

              <div className="relative flex-1">
                <textarea
                  placeholder="spool your thoughts. we’ll keep them gentle, and close."
                  value={activeId ? activeNote?.content ?? "" : draftContent}
                  onChange={(e) => handleContentChange(e.target.value)}
                  className="note-scroll h-full w-full resize-none rounded-2xl border border-slate-800 bg-black/75 px-3.5 py-3.5 text-sm text-slate-100 placeholder:text-slate-500/95 outline-none ring-0 focus:border-slate-300 focus:ring-1 focus:ring-slate-200/70"
                />

                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black via-black/40 to-transparent" />
              </div>

              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400/95">
                <span>
                  {(
                    activeId ? activeNote?.content ?? "" : draftContent
                  ).length.toLocaleString()}{" "}
                  characters,{" "}
                  {(
                    activeId ? activeNote?.content ?? "" : draftContent
                  ).split(/\s+/).filter(Boolean).length.toLocaleString()}{" "}
                  words
                </span>
                <span className="text-slate-500/95">
                  {session
                    ? "local first, mirrored to your space"
                    : "local only, until you sign in"}
                </span>
              </div>
            </div>
          </motion.section>
        </div>
      </div>

      {shareOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4"
          onClick={() => setShareOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-900 bg-black/90 px-5 py-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-100">
                  Share this note
                </p>
                <p className="text-[11px] text-slate-500">
                  {shareError
                    ? "We couldn’t make a link."
                    : shareMode === "collab"
                    ? "Anyone with this link can edit."
                    : "Anyone with this link can read."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShareOpen(false)}
                className="text-xs text-slate-500 hover:text-slate-200"
              >
                close
              </button>
            </header>

            {shareError ? (
              <p className="text-xs text-rose-400">{shareError}</p>
            ) : (
              <div className="space-y-2">
                <label className="text-[11px] text-slate-400">
                  Link to share
                </label>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={shareUrl ?? ""}
                    onFocus={(e) => e.target.select()}
                    className="h-9 flex-1 rounded-xl border border-slate-800 bg-black/80 px-3 text-xs text-slate-100 outline-none ring-0 focus:border-slate-300 focus:ring-1 focus:ring-slate-200/70"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!shareUrl) return;
                      try {
                        await navigator.clipboard.writeText(shareUrl);
                      } catch {
                        // ignore clipboard error
                      }
                    }}
                    className="h-9 rounded-full border border-slate-200 bg-slate-50 px-3 text-[11px] font-semibold text-black hover:bg-white"
                  >
                    copy
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <div className="fixed bottom-0 left-0 right-0 mx-auto max-w-md bg-black/70 px-4 py-2 rounded-lg mt-4 border border-slate-900/80 backdrop-blur-sm shadow-lg hover:border-slate-800/80 transition-all duration-300">
        <p className="text-xs text-slate-400/95 text-center leading-relaxed mt-5">
          Made by <a href="https://github.com/holyholical" target="_blank" rel="noopener noreferrer" className="text-slate-200 hover:text-white transition-colors duration-200 font-medium">holyholical</a>
        </p>
      </div>
    </main>
  );
}
