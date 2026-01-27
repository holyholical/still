import { promises as fs } from "fs";
import path from "path";

type Note = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
  pinned?: boolean;
  shareId?: string;
};

type NotesFile = {
  [userId: string]: Note[];
};

const DATA_DIR = path.join(process.cwd(), "data");
const NOTES_PATH = path.join(DATA_DIR, "notes.json");

async function ensureDataFile() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.access(NOTES_PATH);
  } catch {
    const initial: NotesFile = {};
    await fs.writeFile(NOTES_PATH, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readNotesFile(): Promise<NotesFile> {
  await ensureDataFile();
  const raw = await fs.readFile(NOTES_PATH, "utf8");
  try {
    return JSON.parse(raw) as NotesFile;
  } catch {
    return {};
  }
}

async function writeNotesFile(data: NotesFile) {
  await ensureDataFile();
  await fs.writeFile(NOTES_PATH, JSON.stringify(data, null, 2), "utf8");
}

export async function getNotes(userId: string): Promise<Note[]> {
  const file = await readNotesFile();
  return file[userId] ?? [];
}

export async function upsertNote(
  userId: string,
  note: { id?: string; title: string; content: string; pinned?: boolean }
): Promise<Note[]> {
  const file = await readNotesFile();
  const existing = file[userId] ?? [];

  const now = new Date().toISOString();
  let next: Note[];

  if (note.id) {
    let found = false;
    next = existing.map((n) =>
      n.id === note.id
        ? (found = true,
          {
            ...n,
            title: note.title,
            content: note.content,
            pinned: note.pinned ?? n.pinned,
            updatedAt: now,
          })
        : n
    );

    // If a client supplied an id that doesn't exist yet, create it.
    if (!found) {
      const created: Note = {
        id: note.id,
        title: note.title || "Untitled",
        content: note.content,
        updatedAt: now,
        pinned: note.pinned ?? false,
      };
      next = [created, ...existing];
    }
  } else {
    const id = `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const created: Note = {
      id,
      title: note.title || "Untitled",
      content: note.content,
      updatedAt: now,
      pinned: note.pinned ?? false,
    };
    next = [created, ...existing];
  }

  file[userId] = next;
  await writeNotesFile(file);
  return next;
}

export async function deleteNote(userId: string, id: string): Promise<Note[]> {
  const file = await readNotesFile();
  const existing = file[userId] ?? [];
  const next = existing.filter((n) => n.id !== id);
  file[userId] = next;
  await writeNotesFile(file);
  return next;
}

export async function setNoteShareId(
  userId: string,
  id: string,
  shareId: string
): Promise<Note | null> {
  const file = await readNotesFile();
  const existing = file[userId] ?? [];
  let updated: Note | null = null;
  const next = existing.map((n) => {
    if (n.id === id) {
      updated = { ...n, shareId };
      return updated;
    }
    return n;
  });
  if (!updated) return null;
  file[userId] = next;
  await writeNotesFile(file);
  return updated;
}

export async function getNoteByShareId(shareId: string): Promise<Note | null> {
  const file = await readNotesFile();
  for (const notes of Object.values(file)) {
    const match = notes.find((n) => n.shareId === shareId);
    if (match) return match;
  }
  return null;
}

export async function updateNoteByShareId(params: {
  shareId: string;
  title: string;
  content: string;
}): Promise<Note | null> {
  const file = await readNotesFile();
  const { shareId, title, content } = params;
  let updated: Note | null = null;

  for (const [userId, notes] of Object.entries(file)) {
    const next = notes.map((n) => {
      if (n.shareId === shareId) {
        updated = {
          ...n,
          title: title || "Untitled",
          content,
          updatedAt: new Date().toISOString(),
        };
        return updated;
      }
      return n;
    });

    if (updated) {
      file[userId] = next;
      await writeNotesFile(file);
      return updated;
    }
  }

  return null;
}


