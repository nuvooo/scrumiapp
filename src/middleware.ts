import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, configuredPassword, passwordHash } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const password = configuredPassword();
  if (!password) return NextResponse.next();

  const cookie = request.cookies.get(AUTH_COOKIE)?.value;
  if (cookie && cookie === (await passwordHash(password))) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "Nicht angemeldet" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // Alles außer Login, Next-Interna und statischen Dateien (Pfade mit Punkt).
  matcher: ["/((?!login|api/login|_next/static|_next/image|.*\\..*).*)"],
};
