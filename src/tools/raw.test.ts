import { test } from "node:test";
import assert from "node:assert/strict";
import { GoogleTasksClient } from "../client.js";
import { registerRawTool } from "./raw.js";

type Args = Record<string, unknown>;
type Handler = (args: Args) => Promise<{ content: { text: string }[]; isError?: boolean }>;

/** Registers raw_request against a real client with a recording fetch stub. */
function harness() {
  const original = globalThis.fetch;
  const calls: { url: string; method: string; auth: unknown; body: unknown }[] = [];
  globalThis.fetch = (async (url: unknown, init: unknown) => {
    const i = (init ?? {}) as { method: string; headers?: Record<string, string>; body?: string };
    calls.push({
      url: String(url),
      method: i.method,
      auth: i.headers?.Authorization,
      body: i.body ? JSON.parse(i.body) : undefined,
    });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  const client = new GoogleTasksClient({
    accessToken: "TKN",
    apiBase: "https://tasks.googleapis.com",
    maxRetries: 0,
  });
  const tools: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _cfg: unknown, h: Handler) => {
      tools[name] = h;
    },
  };
  registerRawTool(server as never, client);
  return {
    tools,
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

test("raw_request defaults to GET with the Bearer token", async () => {
  const { tools, calls, restore } = harness();
  try {
    const res = await tools.raw_request({ path: "tasks/v1/users/@me/lists" });
    assert.equal(res.isError, undefined);
    assert.equal(calls[0].method, "GET");
    assert.equal(calls[0].url, "https://tasks.googleapis.com/tasks/v1/users/@me/lists");
    assert.equal(calls[0].auth, "Bearer TKN");
    assert.equal(calls[0].body, undefined);
  } finally {
    restore();
  }
});

test("raw_request PATCHes a JSON body to a relative path", async () => {
  const { tools, calls, restore } = harness();
  try {
    await tools.raw_request({
      path: "tasks/v1/lists/l-1/tasks/t-1",
      method: "PATCH",
      body: { title: "renamed" },
    });
    assert.equal(calls[0].method, "PATCH");
    assert.equal(calls[0].url, "https://tasks.googleapis.com/tasks/v1/lists/l-1/tasks/t-1");
    assert.deepEqual(calls[0].body, { title: "renamed" });
  } finally {
    restore();
  }
});

test("raw_request sends the body for DELETE and drops it for GET", async () => {
  const { tools, calls, restore } = harness();
  try {
    // The schema description promises "sent for POST/PATCH/PUT/DELETE, ignored
    // for GET" — pin both halves so the wording and the wire stay in sync.
    await tools.raw_request({
      path: "tasks/v1/lists/l-1/tasks/t-1",
      method: "DELETE",
      body: { reason: "cleanup" },
    });
    assert.equal(calls[0].method, "DELETE");
    assert.deepEqual(calls[0].body, { reason: "cleanup" });

    await tools.raw_request({
      path: "tasks/v1/users/@me/lists",
      method: "GET",
      body: { ignored: true },
    });
    assert.equal(calls[1].method, "GET");
    assert.equal(calls[1].body, undefined);
  } finally {
    restore();
  }
});

test("raw_request rejects an absolute path as an isError result, without fetching", async () => {
  for (const evil of ["https://evil.example/steal", "http://evil.example/x", "\\\\evil.example/x"]) {
    const { tools, calls, restore } = harness();
    try {
      const res = await tools.raw_request({ path: evil });
      assert.equal(res.isError, true, `${JSON.stringify(evil)} should be isError`);
      assert.match(res.content[0].text, /foreign origin/);
      assert.equal(calls.length, 0, `must not fetch for ${JSON.stringify(evil)}`);
    } finally {
      restore();
    }
  }
});
