#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { GoogleTasksClient } from "./client.js";
import { ConfigError, DEFAULT_BASE, hasCredentials, loadConfig } from "./config.js";
import { instrumentToolCalls, Telemetry } from "./telemetry.js";
import type { GoogleTasksConfig } from "./types.js";
import { registerTaskListTools } from "./tools/tasklists.js";
import { registerTaskTools } from "./tools/tasks.js";
import { registerCompletionTools } from "./tools/completion.js";
import { registerRawTool } from "./tools/raw.js";

/**
 * Prose handed to the calling model in the `initialize` result — the only place
 * it learns what the tool list cannot say: which Google product this API is,
 * what the API refuses to do, and the behaviours that make a naive loop
 * expensive, lossy or duplicating.
 */
const INSTRUCTIONS =
  "Google Tasks API v1 manages the user's Google Tasks lists — not Calendar events, Keep notes or " +
  "Reminders. Due dates are DATES only: any time of day sent is discarded and never returned; " +
  "recurrence is invisible to the API entirely. Completing is not deleting: complete_task is " +
  "reversible via reopen_task, while delete_task and delete_tasklist are permanent (delete_tasklist " +
  "takes every task in the list with it; the default list cannot be deleted). Tasks completed in " +
  "Google's own apps are flagged hidden — list them with show_completed=true AND show_hidden=true. " +
  "Hierarchy is parent/previous at create_task or move_task only (parent and position are read-only " +
  "fields; positions are opaque strings — sort by them, never fabricate them); one nesting level is " +
  "what Google's UI supports. There are no push notifications: sync by polling list_tasks with " +
  "updated_min plus show_deleted/show_hidden. Task pages cap at 100 items (default 20; task-list " +
  "pages at 1000), the API has no text search — filter client-side — and the project quota is a " +
  "courtesy 50,000 queries/day, so poll incrementally. Writes hit live data and are never retried after a 5xx or " +
  "timeout: verify with get_task before re-sending; clear_completed_tasks hides a whole list's " +
  "completed tasks at once. Auth that suddenly breaks usually means the OAuth consent screen is " +
  "still in Testing, where refresh tokens die after 7 days.";

/**
 * Prepended to INSTRUCTIONS when no credentials are configured. The model reads
 * this before it picks a tool, so an unconfigured session opens with the fix
 * rather than with a failed call. There is no in-chat login here: credentials
 * come only from the environment, so the fix is an operator action + restart.
 */
const UNCONFIGURED_PREFIX =
  "ATTENTION: Google Tasks is not connected yet — no credentials are configured, so every " +
  "tool call will fail. The operator must set GOOGLE_TASKS_CLIENT_ID + " +
  "GOOGLE_TASKS_CLIENT_SECRET + GOOGLE_TASKS_REFRESH_TOKEN (recommended), or " +
  "GOOGLE_TASKS_ACCESS_TOKEN with a short-lived access token, in the MCP client's " +
  "server config and restart this server — the variables are read only at startup. ";

/** Reads the package version so the server reports its real version to MCP clients. */
function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/**
 * Loads the config without dying on a bad value. A server that exits here never
 * completes the MCP handshake, so the user sees a dead server and no reason.
 * Instead the problem is carried into the session, where the model can read it
 * and relay it: the config degrades to "no credentials" and every tool call
 * fails with the actionable message.
 */
function loadConfigOrDegraded(telemetry: Telemetry): {
  config: GoogleTasksConfig;
  problem?: ConfigError;
} {
  try {
    return { config: loadConfig() };
  } catch (err) {
    if (!(err instanceof ConfigError)) throw err;
    console.error(`Error: ${err.message}`);
    // Fire-and-forget now that the process survives: the historical
    // `startup_failed` funnel stays comparable, but nothing blocks startup.
    telemetry.send("startup_failed", { reason: err.reason });
    return {
      config: { apiBase: process.env.GOOGLE_TASKS_API_BASE || DEFAULT_BASE },
      problem: err,
    };
  }
}

async function main(): Promise<void> {
  // Anonymous usage pings (ids/names/versions only, never data or arguments);
  // opt out with ASKADS_TELEMETRY=0. Built before the config so missing
  // credentials can be reported; wired to the server before tools register.
  const telemetry = new Telemetry(readVersion());
  const { config, problem } = loadConfigOrDegraded(telemetry);
  const client = new GoogleTasksClient(config);

  // Decided once, at startup: credentials come only from the environment, so
  // "restart after setting the variables" is the accurate advice to give.
  const connected = hasCredentials(config);

  const server = new McpServer(
    {
      name: "mcp-google-tasks",
      version: readVersion(),
    },
    // Surfaces in the initialize result, before the client sees a single tool.
    {
      instructions: connected
        ? INSTRUCTIONS
        : UNCONFIGURED_PREFIX + (problem ? `Configuration problem: ${problem.message} ` : "") + INSTRUCTIONS,
    },
  );

  instrumentToolCalls(server, telemetry);
  server.server.oninitialized = () => {
    telemetry.setClientInfo(server.server.getClientVersion());
    // Split on purpose: `server_start` keeps meaning "a usable install started",
    // so the unconfigured case gets its own event instead of inflating that number.
    if (connected) telemetry.send("server_start");
    else telemetry.send("unconfigured_start", { reason: problem?.reason ?? "missing_credentials" });
  };

  registerTaskListTools(server, client);
  registerTaskTools(server, client);
  registerCompletionTools(server, client);
  registerRawTool(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `mcp-google-tasks running on stdio${connected ? "" : " (no credentials — set the environment variables and restart)"}`,
  );
}

main().catch((err) => {
  console.error("Fatal error starting mcp-google-tasks:", err);
  process.exit(1);
});
