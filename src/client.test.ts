import { test } from "node:test";
import assert from "node:assert/strict";
import { GoogleTasksClient, normalizeDueDate } from "./client.js";
import { CredentialsError, MISSING_CREDENTIALS_MESSAGE } from "./config.js";
import type { GoogleTasksConfig } from "./types.js";

const BASE = "https://tasks.googleapis.com";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const LISTS = `${BASE}/tasks/v1/users/@me/lists`;

type Call = { url: string; method: string; auth: unknown; body: string | undefined };

/** A client on a static access token — no token-endpoint traffic expected. */
function staticConfig(extra: Partial<GoogleTasksConfig> = {}): GoogleTasksConfig {
  return { accessToken: "STATIC", apiBase: BASE, maxRetries: 0, retryBaseMs: 0, ...extra };
}

/** A client on the refresh flow. */
function refreshConfig(extra: Partial<GoogleTasksConfig> = {}): GoogleTasksConfig {
  return {
    clientId: "cid",
    clientSecret: "csec",
    refreshToken: "rtok",
    apiBase: BASE,
    maxRetries: 0,
    retryBaseMs: 0,
    ...extra,
  };
}

/** Installs a recording fetch stub; the handler decides each response. */
function mockFetch(handler: (url: string, init: RequestInit, n: number) => Response | Promise<Response>) {
  const original = globalThis.fetch;
  const calls: Call[] = [];
  globalThis.fetch = (async (url: unknown, init: unknown) => {
    const i = (init ?? {}) as RequestInit & { headers?: Record<string, string> };
    calls.push({
      url: String(url),
      method: String(i.method),
      auth: i.headers?.Authorization,
      body: typeof i.body === "string" ? i.body : undefined,
    });
    return handler(String(url), i, calls.length);
  }) as typeof fetch;
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

const okJson = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });

/** Default handler: token endpoint mints TOK-1, everything else returns { ok: true }. */
function defaultHandler(url: string): Response {
  if (url === TOKEN_URL) return okJson({ access_token: "TOK-1", expires_in: 3600 });
  return okJson({ ok: true });
}

// ---- Auth ----

/**
 * The degraded-start contract: a server without credentials still runs, so the
 * client must fail the call itself — with the exact actionable message, before
 * any fetch. Zero fetch calls proves the error skips the retry/backoff loop
 * and the forced 401 re-mint alike (maxRetries is deliberately non-zero here).
 */
test("no credentials at all: CredentialsError with the exact text, fetch never called", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleTasksClient({ apiBase: BASE, maxRetries: 3, retryBaseMs: 0 });
    await assert.rejects(
      () => client.listTaskLists(),
      (err: unknown) => {
        assert.ok(err instanceof CredentialsError, "must be a CredentialsError");
        assert.equal(err.message, MISSING_CREDENTIALS_MESSAGE);
        // The historical startup error, verbatim — the message is the product.
        assert.ok(
          err.message.startsWith(
            "Google OAuth credentials are required: set GOOGLE_TASKS_CLIENT_ID + " +
              "GOOGLE_TASKS_CLIENT_SECRET + GOOGLE_TASKS_REFRESH_TOKEN (recommended), " +
              "or GOOGLE_TASKS_ACCESS_TOKEN with a short-lived access token.",
          ),
          "the message must open with the historical startup error, verbatim",
        );
        assert.match(err.message, /restart the server/, "the fix must mention the restart");
        return true;
      },
    );
    assert.equal(mock.calls.length, 0, "must not fetch at all — no retries, no token mint, no replay");
  } finally {
    mock.restore();
  }
});

test("static access token: Bearer header, no token-endpoint traffic", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleTasksClient(staticConfig()).getTaskList("list-1");
    assert.equal(mock.calls.length, 1);
    assert.equal(mock.calls[0].url, `${LISTS}/list-1`);
    assert.equal(mock.calls[0].method, "GET");
    assert.equal(mock.calls[0].auth, "Bearer STATIC");
  } finally {
    mock.restore();
  }
});

test("refresh flow: mints a token first, then caches it across requests", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleTasksClient(refreshConfig());
    await client.getTaskList("a");
    await client.getTaskList("b");

    const tokenCalls = mock.calls.filter((c) => c.url === TOKEN_URL);
    assert.equal(tokenCalls.length, 1, "the second request must reuse the cached token");
    assert.equal(tokenCalls[0].method, "POST");
    const params = new URLSearchParams(tokenCalls[0].body);
    assert.equal(params.get("grant_type"), "refresh_token");
    assert.equal(params.get("client_id"), "cid");
    assert.equal(params.get("client_secret"), "csec");
    assert.equal(params.get("refresh_token"), "rtok");

    const apiCalls = mock.calls.filter((c) => c.url.startsWith(`${BASE}/`));
    assert.equal(apiCalls.length, 2);
    for (const call of apiCalls) assert.equal(call.auth, "Bearer TOK-1");
  } finally {
    mock.restore();
  }
});

test("a 401 forces one re-mint and replays the request", async () => {
  let minted = 0;
  let apiHits = 0;
  const mock = mockFetch((url) => {
    if (url === TOKEN_URL) {
      minted++;
      return okJson({ access_token: `TOK-${minted}`, expires_in: 3600 });
    }
    apiHits++;
    if (apiHits === 1) return new Response('{"error":{"message":"expired"}}', { status: 401 });
    return okJson({ ok: true });
  });
  try {
    const result = await new GoogleTasksClient(refreshConfig()).getTaskList("a");
    assert.deepEqual(result, { ok: true });
    assert.equal(minted, 2, "the 401 must force a second mint");
    const lastApi = mock.calls.filter((c) => c.url.startsWith(`${BASE}/`)).at(-1);
    assert.equal(lastApi?.auth, "Bearer TOK-2");
  } finally {
    mock.restore();
  }
});

test("a persistent 401 throws instead of looping", async () => {
  let apiHits = 0;
  const mock = mockFetch((url) => {
    if (url === TOKEN_URL) return okJson({ access_token: "TOK", expires_in: 3600 });
    apiHits++;
    return new Response('{"error":{"message":"nope","status":"UNAUTHENTICATED"}}', { status: 401 });
  });
  try {
    await assert.rejects(
      () => new GoogleTasksClient(refreshConfig()).getTaskList("a"),
      /HTTP 401: \[UNAUTHENTICATED\] nope/,
    );
    assert.equal(apiHits, 2, "exactly one replay after the forced re-mint");
  } finally {
    mock.restore();
  }
});

test("a failed token exchange surfaces the OAuth error", async () => {
  const mock = mockFetch((url) => {
    if (url === TOKEN_URL) {
      return new Response('{"error":"invalid_grant","error_description":"Token has been revoked."}', {
        status: 400,
      });
    }
    return okJson({ ok: true });
  });
  try {
    await assert.rejects(
      () => new GoogleTasksClient(refreshConfig()).getTaskList("a"),
      /HTTP 400: invalid_grant: Token has been revoked\./,
    );
  } finally {
    mock.restore();
  }
});

// ---- Task list endpoint mapping ----

test("listTaskLists maps page_size/page_token to maxResults/pageToken", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleTasksClient(staticConfig()).listTaskLists({ pageSize: 50, pageToken: "tok" });
    const url = new URL(mock.calls[0].url);
    assert.equal(url.pathname, "/tasks/v1/users/@me/lists");
    assert.equal(url.searchParams.get("maxResults"), "50");
    assert.equal(url.searchParams.get("pageToken"), "tok");
    assert.equal(mock.calls[0].method, "GET");
    assert.equal(mock.calls[0].body, undefined);
  } finally {
    mock.restore();
  }
});

test("listTaskLists sends no query when nothing is set", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleTasksClient(staticConfig()).listTaskLists();
    assert.equal(mock.calls[0].url, `${LISTS}`);
  } finally {
    mock.restore();
  }
});

test("getTaskList URL-encodes the id (the @default alias included)", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleTasksClient(staticConfig()).getTaskList("@default");
    assert.equal(mock.calls[0].url, `${LISTS}/%40default`);
  } finally {
    mock.restore();
  }
});

test("createTaskList POSTs only the title", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleTasksClient(staticConfig()).createTaskList("Groceries");
    assert.equal(mock.calls[0].url, LISTS);
    assert.equal(mock.calls[0].method, "POST");
    assert.deepEqual(JSON.parse(mock.calls[0].body!), { title: "Groceries" });
  } finally {
    mock.restore();
  }
});

test("updateTaskList PATCHes the title", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleTasksClient(staticConfig()).updateTaskList("list-1", "Renamed");
    assert.equal(mock.calls[0].url, `${LISTS}/list-1`);
    assert.equal(mock.calls[0].method, "PATCH");
    assert.deepEqual(JSON.parse(mock.calls[0].body!), { title: "Renamed" });
  } finally {
    mock.restore();
  }
});

test("deleteTaskList issues DELETE and reports {deleted:true} on the empty 204", async () => {
  const mock = mockFetch(() => new Response(null, { status: 204 }));
  try {
    const result = await new GoogleTasksClient(staticConfig()).deleteTaskList("list-1");
    assert.equal(mock.calls[0].method, "DELETE");
    assert.equal(mock.calls[0].url, `${LISTS}/list-1`);
    assert.deepEqual(result, { deleted: true, tasklist_id: "list-1" });
  } finally {
    mock.restore();
  }
});

// ---- Task endpoint mapping ----

test("listTasks maps every normalized filter to its wire query parameter", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleTasksClient(staticConfig()).listTasks({
      taskListId: "list-1",
      updatedMin: "2026-08-01T00:00:00Z",
      dueMin: "2026-08-02T00:00:00Z",
      dueMax: "2026-08-03T00:00:00Z",
      completedMin: "2026-08-04T00:00:00Z",
      completedMax: "2026-08-05T00:00:00Z",
      showCompleted: true,
      showHidden: true,
      showDeleted: true,
      showAssigned: false,
      pageSize: 100,
      pageToken: "tok",
    });
    const url = new URL(mock.calls[0].url);
    assert.equal(url.pathname, "/tasks/v1/lists/list-1/tasks");
    assert.equal(url.searchParams.get("updatedMin"), "2026-08-01T00:00:00Z");
    assert.equal(url.searchParams.get("dueMin"), "2026-08-02T00:00:00Z");
    assert.equal(url.searchParams.get("dueMax"), "2026-08-03T00:00:00Z");
    assert.equal(url.searchParams.get("completedMin"), "2026-08-04T00:00:00Z");
    assert.equal(url.searchParams.get("completedMax"), "2026-08-05T00:00:00Z");
    assert.equal(url.searchParams.get("showCompleted"), "true");
    assert.equal(url.searchParams.get("showHidden"), "true");
    assert.equal(url.searchParams.get("showDeleted"), "true");
    assert.equal(url.searchParams.get("showAssigned"), "false");
    assert.equal(url.searchParams.get("maxResults"), "100");
    assert.equal(url.searchParams.get("pageToken"), "tok");
    assert.equal(mock.calls[0].method, "GET");
  } finally {
    mock.restore();
  }
});

test("listTasks leaves unset filters out so the API defaults stay in charge", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleTasksClient(staticConfig()).listTasks({ taskListId: "list-1" });
    assert.equal(mock.calls[0].url, `${BASE}/tasks/v1/lists/list-1/tasks`);
  } finally {
    mock.restore();
  }
});

test("getTask hits the task path with both ids encoded", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleTasksClient(staticConfig()).getTask("l/1", "t 2");
    assert.equal(mock.calls[0].url, `${BASE}/tasks/v1/lists/l%2F1/tasks/t%202`);
  } finally {
    mock.restore();
  }
});

test("createTask: body carries title/notes/due, hierarchy rides in the query", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleTasksClient(staticConfig()).createTask({
      taskListId: "list-1",
      title: "Buy milk",
      notes: "2 liters",
      due: "2026-09-01",
      parent: "parent-1",
      previous: "prev-1",
    });
    const url = new URL(mock.calls[0].url);
    assert.equal(url.pathname, "/tasks/v1/lists/list-1/tasks");
    assert.equal(url.searchParams.get("parent"), "parent-1");
    assert.equal(url.searchParams.get("previous"), "prev-1");
    assert.equal(mock.calls[0].method, "POST");
    assert.deepEqual(JSON.parse(mock.calls[0].body!), {
      title: "Buy milk",
      notes: "2 liters",
      due: "2026-09-01T00:00:00.000Z",
    });
  } finally {
    mock.restore();
  }
});

test("createTask without extras sends a minimal body and no query", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleTasksClient(staticConfig()).createTask({ taskListId: "list-1", title: "Q" });
    assert.equal(mock.calls[0].url, `${BASE}/tasks/v1/lists/list-1/tasks`);
    assert.deepEqual(JSON.parse(mock.calls[0].body!), { title: "Q" });
  } finally {
    mock.restore();
  }
});

test("updateTask PATCHes only the provided fields and normalizes due", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleTasksClient(staticConfig()).updateTask({
      taskListId: "list-1",
      taskId: "task-1",
      title: "New",
      due: "2026-10-05",
    });
    assert.equal(mock.calls[0].method, "PATCH");
    assert.equal(mock.calls[0].url, `${BASE}/tasks/v1/lists/list-1/tasks/task-1`);
    assert.deepEqual(JSON.parse(mock.calls[0].body!), { title: "New", due: "2026-10-05T00:00:00.000Z" });
  } finally {
    mock.restore();
  }
});

test("updateTask clears due/notes with explicit nulls and rejects an empty change", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleTasksClient(staticConfig());
    await client.updateTask({ taskListId: "l", taskId: "t", clearDue: true, clearNotes: true });
    assert.deepEqual(JSON.parse(mock.calls[0].body!), { due: null, notes: null });
    await assert.rejects(
      () => client.updateTask({ taskListId: "l", taskId: "t" }),
      /At least one of title, notes, due, clear_due or clear_notes/,
    );
    assert.equal(mock.calls.length, 1, "the empty update must fail before any fetch");
  } finally {
    mock.restore();
  }
});

test("moveTask POSTs to /move with parent/previous/destinationTasklist as query", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleTasksClient(staticConfig()).moveTask({
      taskListId: "list-1",
      taskId: "task-1",
      parent: "p-1",
      previous: "s-1",
      destinationTasklist: "list-2",
    });
    const url = new URL(mock.calls[0].url);
    assert.equal(url.pathname, "/tasks/v1/lists/list-1/tasks/task-1/move");
    assert.equal(url.searchParams.get("parent"), "p-1");
    assert.equal(url.searchParams.get("previous"), "s-1");
    assert.equal(url.searchParams.get("destinationTasklist"), "list-2");
    assert.equal(mock.calls[0].method, "POST");
  } finally {
    mock.restore();
  }
});

test("moveTask with no targets still POSTs (moves the task to the top)", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleTasksClient(staticConfig()).moveTask({ taskListId: "l", taskId: "t" });
    assert.equal(mock.calls[0].url, `${BASE}/tasks/v1/lists/l/tasks/t/move`);
  } finally {
    mock.restore();
  }
});

test("deleteTask issues DELETE and reports {deleted:true} on the empty 204", async () => {
  const mock = mockFetch(() => new Response(null, { status: 204 }));
  try {
    const result = await new GoogleTasksClient(staticConfig()).deleteTask("list-1", "task-1");
    assert.equal(mock.calls[0].method, "DELETE");
    assert.equal(mock.calls[0].url, `${BASE}/tasks/v1/lists/list-1/tasks/task-1`);
    assert.deepEqual(result, { deleted: true, tasklist_id: "list-1", task_id: "task-1" });
  } finally {
    mock.restore();
  }
});

test("setTaskStatus completes with status=completed and reopens with an explicit null", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleTasksClient(staticConfig());
    await client.setTaskStatus("l", "t", true);
    assert.equal(mock.calls[0].method, "PATCH");
    assert.deepEqual(JSON.parse(mock.calls[0].body!), { status: "completed" });
    await client.setTaskStatus("l", "t", false);
    assert.deepEqual(JSON.parse(mock.calls[1].body!), { status: "needsAction", completed: null });
  } finally {
    mock.restore();
  }
});

test("clearCompletedTasks POSTs to /clear and reports {cleared:true} on the empty body", async () => {
  const mock = mockFetch(() => new Response(null, { status: 204 }));
  try {
    const result = await new GoogleTasksClient(staticConfig()).clearCompletedTasks("list-1");
    assert.equal(mock.calls[0].method, "POST");
    assert.equal(mock.calls[0].url, `${BASE}/tasks/v1/lists/list-1/clear`);
    assert.deepEqual(result, { cleared: true, tasklist_id: "list-1" });
  } finally {
    mock.restore();
  }
});

// ---- Due date normalization ----

test("normalizeDueDate turns YYYY-MM-DD into midnight UTC and passes RFC3339 through", () => {
  assert.equal(normalizeDueDate("2026-09-01"), "2026-09-01T00:00:00.000Z");
  assert.equal(normalizeDueDate("2026-09-01T12:30:00Z"), "2026-09-01T12:30:00Z");
  assert.equal(normalizeDueDate("2026-09-01T12:30:00+03:00"), "2026-09-01T12:30:00+03:00");
});

// ---- Retry / timeout / SSRF behavior ----

test("request() retries a 429 for reads and writes alike", async () => {
  for (const run of [
    () => new GoogleTasksClient(staticConfig({ maxRetries: 3 })).getTaskList("l"),
    () => new GoogleTasksClient(staticConfig({ maxRetries: 3 })).deleteTask("l", "t"),
  ]) {
    let n = 0;
    const mock = mockFetch(() => {
      n++;
      if (n === 1) return new Response("slow down", { status: 429 });
      return okJson({ ok: true });
    });
    try {
      assert.deepEqual(await run(), { ok: true });
      assert.equal(n, 2);
    } finally {
      mock.restore();
    }
  }
});

test("request() retries a 5xx only for GET — a write is never replayed", async () => {
  let n = 0;
  const mock = mockFetch(() => {
    n++;
    if (n === 1) return new Response("unavailable", { status: 503 });
    return okJson({ ok: true });
  });
  try {
    const result = await new GoogleTasksClient(staticConfig({ maxRetries: 3 })).getTaskList("l");
    assert.deepEqual(result, { ok: true });
    assert.equal(n, 2, "the read is retried");
  } finally {
    mock.restore();
  }

  n = 0;
  const mock2 = mockFetch(() => {
    n++;
    return new Response("unavailable", { status: 503 });
  });
  try {
    await assert.rejects(
      () => new GoogleTasksClient(staticConfig({ maxRetries: 3 })).deleteTask("l", "t"),
      /HTTP 503/,
    );
    assert.equal(n, 1, "a 503 on a write must not be replayed — the delete may have committed");
  } finally {
    mock2.restore();
  }
});

test("request() retries a network error only for GET", async () => {
  let n = 0;
  const mock = mockFetch(() => {
    n++;
    if (n === 1) throw new Error("ECONNRESET");
    return okJson({ ok: true });
  });
  try {
    const result = await new GoogleTasksClient(staticConfig({ maxRetries: 2 })).getTaskList("l");
    assert.deepEqual(result, { ok: true });
    assert.equal(n, 2);
  } finally {
    mock.restore();
  }

  n = 0;
  const mock2 = mockFetch(() => {
    n++;
    throw new Error("ECONNRESET");
  });
  try {
    await assert.rejects(
      () =>
        new GoogleTasksClient(staticConfig({ maxRetries: 2 })).createTask({
          taskListId: "l",
          title: "T",
        }),
      /ECONNRESET/,
    );
    assert.equal(n, 1, "a network error on a write must not be replayed");
  } finally {
    mock2.restore();
  }
});

test("request() does not retry a 400 and gives up after maxRetries on 429", async () => {
  let n = 0;
  const mock = mockFetch(() => {
    n++;
    return new Response('{"error":{"message":"bad","status":"INVALID_ARGUMENT"}}', { status: 400 });
  });
  try {
    await assert.rejects(
      () => new GoogleTasksClient(staticConfig({ maxRetries: 3 })).getTaskList("l"),
      /HTTP 400: \[INVALID_ARGUMENT\] bad/,
    );
    assert.equal(n, 1);
  } finally {
    mock.restore();
  }

  n = 0;
  const mock2 = mockFetch(() => {
    n++;
    return new Response("slow down", { status: 429 });
  });
  try {
    await assert.rejects(
      () => new GoogleTasksClient(staticConfig({ maxRetries: 2 })).getTaskList("l"),
      /HTTP 429/,
    );
    assert.equal(n, 3); // initial + 2 retries
  } finally {
    mock2.restore();
  }
});

test("request() aborts and reports a timeout when the request hangs", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = ((_url: unknown, init: unknown) =>
    new Promise((_resolve, reject) => {
      const signal = (init as RequestInit).signal as AbortSignal;
      signal.addEventListener("abort", () =>
        reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
      );
    })) as typeof fetch;
  try {
    const client = new GoogleTasksClient(staticConfig({ timeoutMs: 10, maxRetries: 0 }));
    await client.getTaskList("l").then(
      () => assert.fail("must reject"),
      (err) => assert.match(String(err), /timed out after 10ms/),
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("request() rejects an absolute path (SSRF) and never fetches a foreign origin", async () => {
  for (const evil of ["https://evil.example/steal", "http://evil.example/x", "\\\\evil.example/x"]) {
    const mock = mockFetch(() => okJson({}));
    try {
      await assert.rejects(
        () => new GoogleTasksClient(staticConfig()).request("GET", evil),
        /foreign origin/,
      );
      assert.equal(mock.calls.length, 0, `must not fetch for ${JSON.stringify(evil)}`);
    } finally {
      mock.restore();
    }
  }
});

test("request() still accepts a relative API path with a query string", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const result = await new GoogleTasksClient(staticConfig()).request(
      "GET",
      "tasks/v1/lists/l/tasks?showDeleted=true",
    );
    assert.deepEqual(result, { ok: true });
    assert.equal(mock.calls[0].url, `${BASE}/tasks/v1/lists/l/tasks?showDeleted=true`);
  } finally {
    mock.restore();
  }
});
