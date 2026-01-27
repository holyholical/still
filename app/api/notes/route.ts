import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { deleteNote, getNotes, upsertNote } from "@/lib/store";

const USER_COOKIE = "still_user";

function normalizeUserId(raw: string) {
  // Some browsers/frameworks percent-encode cookie values again (e.g. % -> %25).
  // Our user ids may contain percent sequences, so unwrap one layer when needed.
  if (!raw.includes("%25")) return raw;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

async function requireUser() {
  const store = await cookies();
  const raw = store.get(USER_COOKIE)?.value;
  const userId = raw ? normalizeUserId(raw) : undefined;
  if (!userId) {
    return null;
  }
  return userId;
}

export async function GET() {
  const userId = await requireUser();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const notes = await getNotes(userId);
  return NextResponse.json({ notes });
}

export async function POST(request: Request) {
  const userId = await requireUser();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, title, content, pinned } = body ?? {};

  if (typeof content !== "string") {
    return NextResponse.json(
      { error: "Content is required" },
      { status: 400 }
    );
  }

  const notes = await upsertNote(userId, {
    id,
    title: typeof title === "string" ? title : "Untitled",
    content,
    pinned: typeof pinned === "boolean" ? pinned : undefined,
  });

  return NextResponse.json({ notes });
}

export async function DELETE(request: Request) {
  const userId = await requireUser();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const notes = await deleteNote(userId, id);
  return NextResponse.json({ notes });
}

