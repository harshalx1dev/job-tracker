import "server-only";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { hasScope, type McpScope } from "@/lib/mcp-token";
import { logCall, type McpAuth } from "./tokens";

/** An error whose message is safe to show to Claude (unlike unexpected ones, which are only logged). */
export class ToolError extends Error {}

type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

const ok = (data: unknown): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify(data, null, 1) }],
});
const fail = (message: string): ToolResult => ({
  content: [{ type: "text", text: message }],
  isError: true,
});

type ToolDef<Shape extends z.ZodRawShape> = {
  name: string;
  title: string;
  description: string;
  scope: McpScope;
  input: Shape;
};

/**
 * Registers a tool behind the checks every tool needs: the token must have the
 * scope, the call is logged (for the rate limit and audit trail), and errors
 * become tool errors. The user is always auth.user: it is never an input.
 */
export function tool<Shape extends z.ZodRawShape>(
  server: McpServer,
  auth: McpAuth,
  def: ToolDef<Shape>,
  run: (args: z.infer<z.ZodObject<Shape>>, userId: string) => Promise<unknown>,
) {
  server.registerTool(
    def.name,
    {
      title: def.title,
      description: def.description,
      inputSchema: def.input,
      annotations: {
        // Read tools change nothing; write tools only add (never edit or delete).
        readOnlyHint: def.scope === "read",
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    // The SDK validates args against def.input before calling this. `as never`
    // because its callback type depends on the generic Shape and can't be resolved here.
    (async (args: unknown): Promise<ToolResult> => {
      if (!hasScope(auth.scopes, def.scope)) {
        await logCall(auth.tokenId, def.name, false);
        return fail(
          `This token can't do that: it needs the "${def.scope}" scope. The user can create a read and write token in Trackr, under Settings.`,
        );
      }
      try {
        const data = await run(
          args as z.infer<z.ZodObject<Shape>>,
          auth.user.id,
        );
        await logCall(auth.tokenId, def.name, true);
        return ok(data);
      } catch (err) {
        await logCall(auth.tokenId, def.name, false);
        if (err instanceof ToolError) return fail(err.message);
        console.error(`mcp tool ${def.name} failed`, err);
        return fail("Something went wrong in Trackr. Try again in a moment.");
      }
    }) as never,
  );
}
