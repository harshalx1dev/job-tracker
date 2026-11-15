import { readFileSync } from "node:fs";
import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { generateKitSource } from "../../scripts/kit-source";
import { buildKit, kitUpdate, KIT_VERSION } from "./claude-kit";

const norm = (s: string) => s.replace(/\r\n/g, "\n");
const endpoint = "https://trackr.example.com/api/mcp";

describe("claude kit", () => {
  it("generated source is in step with docs/claude-code-kit (run: npx tsx scripts/write-kit.ts)", () => {
    expect(norm(readFileSync("src/lib/claude-kit.generated.ts", "utf8"))).toBe(
      generateKitSource(),
    );
  });

  it("docs/claude-code-kit/.mcp.json is the placeholder version", () => {
    expect(norm(readFileSync("docs/claude-code-kit/.mcp.json", "utf8"))).toBe(
      buildKit({ endpoint })[".mcp.json"],
    );
  });

  it("puts the token and address in .mcp.json, and nowhere else", () => {
    const token = "trk_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";
    const files = buildKit({ endpoint, token });
    const mcp = JSON.parse(files[".mcp.json"]);
    expect(mcp.mcpServers.trackr.url).toBe(endpoint);
    expect(mcp.mcpServers.trackr.headers.Authorization).toBe(`Bearer ${token}`);
    for (const [path, text] of Object.entries(files))
      if (path !== ".mcp.json") expect(text, path).not.toContain(token);
  });

  it("uses placeholders without a token", () => {
    const files = buildKit({ endpoint });
    expect(files[".mcp.json"]).toContain("YOUR-TRACKR-SITE");
    expect(files[".mcp.json"]).toContain("trk_PASTE_YOUR_TOKEN_HERE");
    expect(files["README.md"]).toContain("replace two values");
  });

  it("has every command, started only by the user", () => {
    const files = buildKit({ endpoint });
    for (const name of [
      "start",
      "refresh",
      "search",
      "apply",
      "hr-emails",
      "status",
      "update-kit",
    ]) {
      const f = files[`.claude/skills/trackr-${name}/SKILL.md`];
      expect(f, name).toContain(`name: trackr-${name}`);
      expect(f, name).toContain("disable-model-invocation: true");
    }
  });

  it("survives a zip round trip with hidden files", () => {
    const files = buildKit({ endpoint, token: "trk_x" });
    const zip = zipSync(
      Object.fromEntries(
        Object.entries(files).map(([p, t]) => [
          `trackr-job-search/${p}`,
          strToU8(t),
        ]),
      ),
    );
    const back = unzipSync(zip);
    expect(strFromU8(back["trackr-job-search/.mcp.json"])).toBe(
      files[".mcp.json"],
    );
    expect(Object.keys(back)).toContain(
      "trackr-job-search/.claude/settings.json",
    );
  });

  it("stamps the version into the kit, and docs carry the same one", () => {
    expect(buildKit({ endpoint })[".kit-version"]).toBe(`${KIT_VERSION}
`);
    expect(
      readFileSync("docs/claude-code-kit/.kit-version", "utf8").trim(),
    ).toBe(KIT_VERSION);
  });
});

describe("kitUpdate", () => {
  it("says nothing more to do when the installed kit is current", () => {
    expect(
      kitUpdate({ installedVersion: KIT_VERSION, includeFiles: true }),
    ).toEqual({
      latestVersion: KIT_VERSION,
      installedVersion: KIT_VERSION,
      upToDate: true,
    });
  });

  it("points an old or unknown kit at the update command without sending files", () => {
    const r = kitUpdate({ installedVersion: "old" });
    expect(r.upToDate).toBe(false);
    expect("files" in r).toBe(false);
    expect(kitUpdate({}).installedVersion).toBeNull();
  });

  it("sends the latest files, but never the token file or the readme", () => {
    const r = kitUpdate({ installedVersion: "old", includeFiles: true });
    const paths = (r as { files: { path: string }[] }).files.map((f) => f.path);
    expect(paths).toContain(".claude/skills/trackr-update-kit/SKILL.md");
    expect(paths).toContain(".kit-version");
    expect(paths).not.toContain(".mcp.json");
    expect(paths).not.toContain("README.md");
  });
});
