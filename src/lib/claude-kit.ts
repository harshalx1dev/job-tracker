import {
  KIT_FILES,
  KIT_README_EMBEDDED,
  KIT_README_MANUAL,
} from "./claude-kit.generated";

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
  };
}
