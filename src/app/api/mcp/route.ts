import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createTrackrServer } from "@/server/mcp/server";
import { authenticateBearer, isRateLimited } from "@/server/mcp/tokens";

/**
 * The Claude connector: a stateless MCP endpoint (Streamable HTTP, JSON
 * responses) for serverless hosting. Every request is authenticated with a
 * personal access token in the Authorization header, and everything it can
 * reach is scoped to that token's owner.
 */

const json = (status: number, body: unknown, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

export async function POST(request: Request) {
  const result = await authenticateBearer(request.headers.get("authorization"));
  if (!result.ok) {
    // One answer for every failure, so nothing reveals whether a token exists.
    return json(
      401,
      { error: "invalid_token" },
      { "www-authenticate": 'Bearer realm="trackr", error="invalid_token"' },
    );
  }
  if (await isRateLimited(result.auth.tokenId)) {
    return json(
      429,
      { error: "rate_limited", message: "Too many requests. Wait a minute." },
      { "retry-after": "60" },
    );
  }

  // Stateless: a fresh server and transport per request, closed afterwards.
  const server = createTrackrServer(result.auth);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    await transport.close();
    await server.close();
  }
}

// Stateless servers have no stream to open or session to end.
const notAllowed = () =>
  json(405, { error: "method_not_allowed" }, { allow: "POST" });
export const GET = notAllowed;
export const DELETE = notAllowed;
