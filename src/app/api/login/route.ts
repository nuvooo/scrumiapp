import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, AUTH_COOKIE_MAX_AGE, configuredPassword, passwordHash } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const password = configuredPassword();
  if (!password) return NextResponse.json({ ok: true });

  const body = (await request.json().catch(() => null)) as { password?: unknown } | null;
  const given = typeof body?.password === "string" ? body.password : "";
  if (given !== password) {
    return NextResponse.json({ ok: false, error: "Falsches Passwort" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: AUTH_COOKIE,
    value: await passwordHash(password),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE,
  });
  return response;
}
