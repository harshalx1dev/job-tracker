import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Optimistic check only: redirects visitors with no session cookie away from
 * the app. Real authorization happens in the data layer (requireUser).
 *
 * It deliberately does not send cookie holders away from /login: a cookie can
 * outlive its session (expired, signed out elsewhere, database reset), and then
 * /app → /login → /app would loop. The sign-in pages check the real session
 * instead (RedirectIfSignedIn).
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
