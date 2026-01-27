import { NextResponse } from "next/server";
import { authenticateOrCreateUser } from "@/lib/users";

const USER_COOKIE = "still_user";

export async function POST(request: Request) {
  const body = await request.json();
  const rawEmail = (body?.email ?? body?.id ?? "") as string;
  const password = (body?.password ?? "") as string;

  const trimmed = rawEmail.trim().toLowerCase();
  if (!trimmed || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  const user = await authenticateOrCreateUser({
    email: trimmed,
    password,
  });

  if (!user) {
    return NextResponse.json(
      { error: "Invalid credentials" },
      { status: 401 }
    );
  }

  const res = NextResponse.json({ userId: user.id, email: user.email });
  res.cookies.set(USER_COOKIE, user.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  return res;
}

