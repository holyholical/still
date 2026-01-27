import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { setNoteShareId } from "@/lib/store";

const USER_COOKIE = "still_user";

function normalizeUserId(raw: string) {
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
  if (!userId) return null;
  return userId;
}

export async function POST(request: Request) {
  const userId = await requireUser();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const noteId = body?.noteId as string | undefined;
  let shareId = body?.shareId as string | undefined;


  if (!noteId) {
    return NextResponse.json({ error: "noteId required" }, { status: 400 });
  }

  if (!shareId) {
    shareId = Math.random().toString(36).slice(2, 10);
  }

  const updated = await setNoteShareId(userId, noteId, shareId);
  if (!updated) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  return NextResponse.json({ shareId: updated.shareId });
}

