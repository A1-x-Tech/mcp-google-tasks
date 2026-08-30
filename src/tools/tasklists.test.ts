import { test } from "node:test";
import assert from "node:assert/strict";
import { registerTaskListTools } from "./tasklists.js";

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
    listTaskLists: make("listTaskLists"),
    getTaskList: make("getTaskList"),
    createTaskList: make("createTaskList"),
    updateTaskList: make("updateTaskList"),
    deleteTaskList: make("deleteTaskList"),
  };
  const tools: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Handler) => {
      tools[name] = handler;
    },
  };
  registerTaskListTools(server as never, client as never);
  return { calls, tools };
}

test("registers the five task-list tools", () => {
  const { tools } = harness();
  assert.deepEqual(Object.keys(tools).sort(), [
    "create_tasklist",
    "delete_tasklist",
    "get_tasklist",
    "list_tasklists",
    "update_tasklist",
  ]);
});

test("list_tasklists forwards pagination normalized", async () => {
  const { calls, tools } = harness();
  await tools.list_tasklists({ page_size: 50, page_token: "tok" });
  assert.equal(calls[0].method, "listTaskLists");
  assert.deepEqual(calls[0].params[0], { pageSize: 50, pageToken: "tok" });
});

test("get_tasklist passes the list id through", async () => {
  const { calls, tools } = harness();
  await tools.get_tasklist({ tasklist_id: "@default" });
  assert.equal(calls[0].method, "getTaskList");
  assert.deepEqual(calls[0].params, ["@default"]);
});

test("create_tasklist and update_tasklist forward the title", async () => {
  const { calls, tools } = harness();
  await tools.create_tasklist({ title: "Groceries" });
  assert.deepEqual(calls[0], { method: "createTaskList", params: ["Groceries"] });
  await tools.update_tasklist({ tasklist_id: "l-1", title: "Renamed" });
  assert.deepEqual(calls[1], { method: "updateTaskList", params: ["l-1", "Renamed"] });
});

test("delete_tasklist passes the list id through", async () => {
  const { calls, tools } = harness();
  await tools.delete_tasklist({ tasklist_id: "l-1" });
  assert.deepEqual(calls[0], { method: "deleteTaskList", params: ["l-1"] });
});

test("a client error is returned as an isError result, not thrown", async () => {
  const { tools } = harness({ throwOn: "createTaskList" });
  const res = await tools.create_tasklist({ title: "X" });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /boom/);
});
