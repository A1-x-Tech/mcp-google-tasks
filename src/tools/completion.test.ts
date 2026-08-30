import { test } from "node:test";
import assert from "node:assert/strict";
import { registerCompletionTools } from "./completion.js";

type Args = Record<string, unknown>;
type Handler = (args: Args) => Promise<{ content: { text: string }[]; isError?: boolean }>;

/** Fake server + fake client so the tool handlers run without network. */
function harness(opts: { throwOn?: string } = {}) {
  const calls: { method: string; params: unknown[] }[] = [];
  const make =
    (method: string) =>
    async (...params: unknown[]) => {
      calls.push({ method, params });
      if (opts.throwOn === method) throw new Error("boom");
      return { ok: true };
    };
  const client = {
    setTaskStatus: make("setTaskStatus"),
    clearCompletedTasks: make("clearCompletedTasks"),
  };
  const tools: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Handler) => {
      tools[name] = handler;
    },
  };
  registerCompletionTools(server as never, client as never);
  return { calls, tools };
}

test("registers the three completion tools", () => {
  const { tools } = harness();
  assert.deepEqual(Object.keys(tools).sort(), [
    "clear_completed_tasks",
    "complete_task",
    "reopen_task",
  ]);
});

/**
 * The reversible/destructive split the tools promise: complete flips the status
 * to completed, reopen flips it back — both go through the same status setter,
 * never through a delete.
 */
test("complete_task sets completed=true and reopen_task sets completed=false", async () => {
  const { calls, tools } = harness();
  await tools.complete_task({ tasklist_id: "l-1", task_id: "t-1" });
  assert.deepEqual(calls[0], { method: "setTaskStatus", params: ["l-1", "t-1", true] });
  await tools.reopen_task({ tasklist_id: "l-1", task_id: "t-1" });
  assert.deepEqual(calls[1], { method: "setTaskStatus", params: ["l-1", "t-1", false] });
});

test("clear_completed_tasks passes the list id through", async () => {
  const { calls, tools } = harness();
  await tools.clear_completed_tasks({ tasklist_id: "l-1" });
  assert.deepEqual(calls[0], { method: "clearCompletedTasks", params: ["l-1"] });
});

test("a client error is returned as an isError result, not thrown", async () => {
  const { tools } = harness({ throwOn: "setTaskStatus" });
  const res = await tools.complete_task({ tasklist_id: "l", task_id: "t" });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /boom/);
});
