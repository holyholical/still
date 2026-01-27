import { NextResponse } from "next/server";
import { getNoteByShareId, updateNoteByShareId } from "@/lib/store";

type Ctx = {
  params: { id: string } | Promise<{ id: string }>;
};

async function getId(ctx: Ctx): Promise<string> {
  const p = await ctx.params;
  return p.id;
}

export async function GET(_req: Request, ctx: Ctx) {
  const shareId = await getId(ctx);
  const note = await getNoteByShareId(shareId);
  if (!note) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    id: note.id,
    title: note.title,
    content: note.content,
    updatedAt: note.updatedAt,
  });
}

export async function POST(req: Request, ctx: Ctx) {
  const shareId = await getId(ctx);
  const body = await req.json();
  const title = (body?.title ?? "") as string;
  const content = (body?.content ?? "") as string;

  if (typeof content !== "string") {
    return NextResponse.json(
      { error: "Content is required" },
      { status: 400 }
    );
  }

  const updated = await updateNoteByShareId({ shareId, title, content });
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: updated.id,
    title: updated.title,
    content: updated.content,
    updatedAt: updated.updatedAt,
  });
}

