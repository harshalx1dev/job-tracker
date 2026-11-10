import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Optimistic routing on the session cookie (real authorization happens in the
 * data layer, requireUser):
 *  - no cookie on /app/*: go to sign-in;
 *  - a cookie on the home page: go straight into the app.
 *
 * It deliberately does not send cookie holders away from /login: a cookie can
 * outlive its session (expired, signed out elsewhere, database reset). Then
 * "/" → /app → /login ends on the sign-in page instead of looping. The sign-in
 * pages check the real session themselves (RedirectIfSignedIn).
 */
export function proxy(request: NextRequest) {
  const hasCookie = Boolean(getSessionCookie(request));
  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    return hasCookie
      ? NextResponse.redirect(new URL("/app/jobs", request.url))
      : NextResponse.next();
  }
  if (!hasCookie) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/app/:path*"],
};
