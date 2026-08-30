import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleTasksClient, HttpMethod } from "../client.js";
import { DESTRUCTIVE, fail, ok } from "./util.js";

export function registerRawTool(server: McpServer, client: GoogleTasksClient): void {
  server.registerTool(
    "raw_request",
    {
      title: "Raw Google Tasks API call",
      // Full API surface incl. deletes and clears — annotate for the worst case
      // a call can do, not the average.
      annotations: DESTRUCTIVE,
      description:
        'Escape hatch to call any Google Tasks API v1 path directly, for requests the typed tools don\'t cover — e.g. a full-resource PUT ("tasks/v1/lists/<listId>/tasks/<taskId>", method PUT, body with the complete task), or a query combination the typed filters don\'t expose. The path is relative to https://tasks.googleapis.com and may carry a query string (e.g. "tasks/v1/lists/<listId>/tasks?showDeleted=true"). The Bearer token is added automatically; the method defaults to GET. PATCH/PUT/POST/DELETE hit live data with no confirmation — prefer the typed tools when one fits.',
      inputSchema: {
        path: z
          .string()
          .min(1)
          .describe('API path relative to https://tasks.googleapis.com, e.g. "tasks/v1/users/@me/lists".'),
        method: z
          .enum(["GET", "POST", "PATCH", "PUT", "DELETE"])
          .optional()
          .describe("HTTP method. Defaults to GET."),
        body: z
          .record(z.any())
          .optional()
          .describe("JSON request body — sent for POST/PATCH/PUT/DELETE, ignored for GET."),
      },
    },
    async ({ path, method, body }) => {
      try {
        const m = (method ?? "GET") as HttpMethod;
        return ok(await client.request(m, path, body));
      } catch (e) {
        return fail(e);
      }
    },
  );
}
