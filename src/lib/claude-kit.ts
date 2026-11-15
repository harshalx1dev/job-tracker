import {
  KIT_FILES,
  KIT_README_EMBEDDED,
  KIT_README_MANUAL,
  KIT_VERSION,
} from "./claude-kit.generated";

export { KIT_VERSION };

/** The folder name inside the downloaded .zip. */
export const KIT_FOLDER = "trackr-job-search";

const PLACEHOLDER_ENDPOINT = "https://YOUR-TRACKR-SITE/api/mcp";
const PLACEHOLDER_TOKEN = "trk_PASTE_YOUR_TOKEN_HERE";

/**
 * The Claude Code starter kit as { path: text }. With a token, .mcp.json holds
 * the real server address and token (the download); without one it holds
 * placeholders (the copy in docs/).
 */
export function buildKit(opts: {
  endpoint: string;
  token?: string;
}): Record<string, string> {
  const mcp = {
    mcpServers: {
      trackr: {
        type: "http",
        url: opts.token ? opts.endpoint : PLACEHOLDER_ENDPOINT,
        headers: { Authorization: `Bearer ${opts.token ?? PLACEHOLDER_TOKEN}` },
      },
    },
  };
  return {
    ...KIT_FILES,
    "README.md": opts.token ? KIT_README_EMBEDDED : KIT_README_MANUAL,
    ".mcp.json": `${JSON.stringify(mcp, null, 2)}\n`,
    ".kit-version": `${KIT_VERSION}\n`,
  };
}

/**
 * What the update command needs: the latest version and, if asked, the files
 * that deliver it. Never .mcp.json or the README: those are the user's own
 * (the token lives in .mcp.json).
 */
export function kitUpdate(opts: {
  installedVersion?: string;
  includeFiles?: boolean;
}) {
  const installedVersion = opts.installedVersion?.trim() || null;
  const upToDate = installedVersion === KIT_VERSION;
  const base = { latestVersion: KIT_VERSION, installedVersion, upToDate };
  if (upToDate) return base;
  if (!opts.includeFiles)
    return {
      ...base,
      note: "A newer kit is available. Ask the user to run /trackr-update-kit.",
    };
  return {
    ...base,
    files: [
      ...Object.entries(KIT_FILES).map(([path, content]) => ({ path, content })),
      { path: ".kit-version", content: `${KIT_VERSION}\n` },
    ],
    neverOverwrite: [".mcp.json", ".claude/settings.local.json"],
  };
}
