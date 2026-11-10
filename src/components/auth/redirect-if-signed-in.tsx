import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/session";

/**
 * Sends a visitor with a real, live session from the sign-in pages into the
 * app. Reads the session, so render it inside <Suspense>.
 */
export async function RedirectIfSignedIn() {
  const user = await getCurrentUser();
  if (user) redirect("/app/jobs");
  return null;
}
