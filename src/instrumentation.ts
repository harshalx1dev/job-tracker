/**
 * Runs once when a server instance starts, before it handles requests.
 * Syncs admin accounts with ADMIN_EMAILS / ADMIN_PASSWORD (see src/server/admin-bootstrap.ts).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const [{ db }, { ensureAdmins }] = await Promise.all([
      import("@/server/db"),
      import("@/server/admin-bootstrap"),
    ]);
    const r = await ensureAdmins(db);
    if (
      r.admin === "created" ||
      r.admin === "password-updated" ||
      r.promoted > 0
    ) {
      console.log(
        `[admin] account ${r.admin}${r.promoted ? `, ${r.promoted} promoted to admin` : ""}`,
      );
    } else if (r.reason && process.env.ADMIN_PASSWORD) {
      console.warn(`[admin] ${r.reason}`);
    }
  } catch (err) {
    // Never block startup (e.g. before migrations have run); log and carry on.
    console.error(
      "[admin] bootstrap failed:",
      err instanceof Error ? err.message : err,
    );
  }
}
