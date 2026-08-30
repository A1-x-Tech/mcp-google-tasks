import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { GoogleTasksClient } from "../dist/client.js";
import { registerTaskListTools } from "../dist/tools/tasklists.js";
import { registerTaskTools } from "../dist/tools/tasks.js";
import { registerCompletionTools } from "../dist/tools/completion.js";
import { registerRawTool } from "../dist/tools/raw.js";

const ALL_TOOLS = [
  "clear_completed_tasks",
  "complete_task",
  "create_task",
  "create_tasklist",
  "delete_task",
  "delete_tasklist",
  "get_task",
  "get_tasklist",
  "list_tasklists",
  "list_tasks",
  "move_task",
  "raw_request",
  "reopen_task",
  "update_task",
  "update_tasklist",
];

test("dist client rejects foreign-origin paths before sending the Bearer token", async () => {
  const original = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response("{}", { status: 200 });
  };
  try {
    const client = new GoogleTasksClient({
      accessToken: "SECRET",
      apiBase: "https://tasks.googleapis.com",
      timeoutMs: 1000,
      maxRetries: 0,
    });
    await assert.rejects(() => client.request("GET", "https://example.invalid/steal"), /foreign origin/);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = original;
  }
});

test("dist client sends the Bearer token and JSON bodies", async () => {
  const original = globalThis.fetch;
  let seen;
  globalThis.fetch = async (url, init) => {
    seen = { url: String(url), auth: init.headers.Authorization, body: JSON.parse(init.body) };
    return new Response('{"id":"list-1"}', { status: 200 });
  };
  try {
    const client = new GoogleTasksClient({
      accessToken: "SECRET",
      apiBase: "https://tasks.googleapis.com",
      timeoutMs: 1000,
      maxRetries: 0,
    });
    await client.createTaskList("Smoke");
    assert.equal(seen.url, "https://tasks.googleapis.com/tasks/v1/users/@me/lists");
    assert.equal(seen.auth, "Bearer SECRET");
    assert.deepEqual(seen.body, { title: "Smoke" });
  } finally {
    globalThis.fetch = original;
  }
});

test("dist registers the expected tools", () => {
  const names = [];
  const server = {
    registerTool(name) {
      names.push(name);
    },
  };
  const client = {};

  registerTaskListTools(server, client);
  registerTaskTools(server, client);
  registerCompletionTools(server, client);
  registerRawTool(server, client);

  assert.deepEqual(names.sort(), ALL_TOOLS);
});

test("dist binary completes a real MCP handshake over stdio and lists every tool", async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL("../dist/index.js", import.meta.url))],
    env: {
      ...process.env,
      GOOGLE_TASKS_ACCESS_TOKEN: "test-token",
      ASKADS_TELEMETRY: "0", // keep the suite offline
    },
    stderr: "pipe",
  });
  const client = new Client({ name: "dist-smoke", version: "0.0.0" });
  await client.connect(transport);
  try {
    const server = client.getServerVersion();
    assert.equal(server?.name, "mcp-google-tasks");
    assert.match(String(server?.version), /^\d+\.\d+\.\d+$/);

    // The instructions the calling model reads before it picks any tool.
    const instructions = client.getInstructions();
    assert.equal(typeof instructions, "string");
    assert.ok(instructions.trim().length > 0, "initialize result carries no instructions");
    assert.match(instructions, /Google Tasks API v1/);

    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), ALL_TOOLS);

    const listTasks = tools.find((t) => t.name === "list_tasks");
    assert.equal(listTasks.annotations?.readOnlyHint, true);
    assert.ok(listTasks.inputSchema?.properties?.tasklist_id, "input schema must reach the client");

    // The reversible/destructive split must be visible to every MCP client.
    const completeTask = tools.find((t) => t.name === "complete_task");
    assert.equal(completeTask.annotations?.idempotentHint, true);
    const deleteTask = tools.find((t) => t.name === "delete_task");
    assert.equal(deleteTask.annotations?.destructiveHint, true);
  } finally {
    await client.close();
  }
});

/**
 * The degraded-start contract: without any credentials the binary must not
 * exit(1) before the handshake, leaving the client a dead server and no reason.
 * It must start, list every tool, open the instructions with the fix, and
 * answer a tool call with the actionable error — offline: the CredentialsError
 * fires before any fetch, so this test never touches the network.
 */
test("dist binary starts without credentials: handshake, tool list, actionable call error", async () => {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key, value]) => value !== undefined && !key.startsWith("GOOGLE_TASKS_"),
    ),
  );
  env.ASKADS_TELEMETRY = "0"; // keep the suite offline
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL("../dist/index.js", import.meta.url))],
    env,
    stderr: "pipe",
  });
  const client = new Client({ name: "dist-smoke-unconfigured", version: "0.0.0" });
  await client.connect(transport);
  try {
    // The model must read the fix before it picks a tool.
    const instructions = client.getInstructions() ?? "";
    assert.match(instructions, /not connected/);
    assert.match(instructions, /GOOGLE_TASKS_CLIENT_ID/);
    assert.match(instructions, /restart/);

    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), ALL_TOOLS);

    // A tool call fails with the exact message instead of killing the server.
    const result = await client.callTool({ name: "list_tasklists", arguments: {} });
    assert.equal(result.isError, true);
    const text = result.content.map((c) => c.text ?? "").join(" ");
    assert.match(text, /Google OAuth credentials are required: set GOOGLE_TASKS_CLIENT_ID/);
    assert.match(text, /restart the server/);
  } finally {
    await client.close();
  }
});
