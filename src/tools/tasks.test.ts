import { test } from "node:test";
import assert from "node:assert/strict";
import { registerTaskTools } from "./tasks.js";

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
    listTasks: make("listTasks"),
    getTask: make("getTask"),
    createTask: make("createTask"),
    updateTask: make("updateTask"),
    moveTask: make("moveTask"),
    deleteTask: make("deleteTask"),
  };
  const tools: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Handler) => {
      tools[name] = handler;
    },
  };
  registerTaskTools(server as never, client as never);
  return { calls, tools };
}

test("registers the six task tools", () => {
  const { tools } = harness();
  assert.deepEqual(Object.keys(tools).sort(), [
    "create_task",
    "delete_task",
    "get_task",
    "list_tasks",
    "move_task",
    "update_task",
  ]);
});

test("list_tasks forwards every filter normalized", async () => {
  const { calls, tools } = harness();
  await tools.list_tasks({
    tasklist_id: "l-1",
    updated_min: "2026-08-01T00:00:00Z",
    due_min: "2026-08-02T00:00:00Z",
    due_max: "2026-08-03T00:00:00Z",
    completed_min: "2026-08-04T00:00:00Z",
    completed_max: "2026-08-05T00:00:00Z",
    show_completed: true,
    show_hidden: true,
    show_deleted: false,
    show_assigned: true,
    page_size: 100,
    page_token: "tok",
  });
  assert.equal(calls[0].method, "listTasks");
  assert.deepEqual(calls[0].params[0], {
    taskListId: "l-1",
    updatedMin: "2026-08-01T00:00:00Z",
    dueMin: "2026-08-02T00:00:00Z",
    dueMax: "2026-08-03T00:00:00Z",
    completedMin: "2026-08-04T00:00:00Z",
    completedMax: "2026-08-05T00:00:00Z",
    showCompleted: true,
    showHidden: true,
    showDeleted: false,
    showAssigned: true,
    pageSize: 100,
    pageToken: "tok",
  });
});

test("get_task passes both ids through", async () => {
  const { calls, tools } = harness();
  await tools.get_task({ tasklist_id: "l-1", task_id: "t-1" });
  assert.deepEqual(calls[0], { method: "getTask", params: ["l-1", "t-1"] });
});

test("create_task forwards title/notes/due/parent/previous normalized", async () => {
  const { calls, tools } = harness();
  await tools.create_task({
    tasklist_id: "l-1",
    title: "Buy milk",
    notes: "2 liters",
    due: "2026-09-01",
    parent: "p-1",
    previous: "s-1",
  });
  assert.equal(calls[0].method, "createTask");
  assert.deepEqual(calls[0].params[0], {
    taskListId: "l-1",
    title: "Buy milk",
    notes: "2 liters",
    due: "2026-09-01",
    parent: "p-1",
    previous: "s-1",
  });
});

test("update_task forwards fields and the clear flags normalized", async () => {
  const { calls, tools } = harness();
  await tools.update_task({ tasklist_id: "l", task_id: "t", title: "New", clear_due: true });
  assert.equal(calls[0].method, "updateTask");
  assert.deepEqual(calls[0].params[0], {
    taskListId: "l",
    taskId: "t",
    title: "New",
    notes: undefined,
    due: undefined,
    clearDue: true,
    clearNotes: undefined,
  });
});

test("update_task rejects due+clear_due and notes+clear_notes without calling the client", async () => {
  const { calls, tools } = harness();
  const res1 = await tools.update_task({
    tasklist_id: "l",
    task_id: "t",
    due: "2026-09-01",
    clear_due: true,
  });
  assert.equal(res1.isError, true);
  assert.match(res1.content[0].text, /mutually exclusive/);
  const res2 = await tools.update_task({
    tasklist_id: "l",
    task_id: "t",
    notes: "text",
    clear_notes: true,
  });
  assert.equal(res2.isError, true);
  assert.equal(calls.length, 0, "conflicting inputs must never reach the client");
});

test("move_task forwards hierarchy and the destination list normalized", async () => {
  const { calls, tools } = harness();
  await tools.move_task({
    tasklist_id: "l-1",
    task_id: "t-1",
    parent: "p-1",
    previous: "s-1",
    destination_tasklist: "l-2",
  });
  assert.equal(calls[0].method, "moveTask");
  assert.deepEqual(calls[0].params[0], {
    taskListId: "l-1",
    taskId: "t-1",
    parent: "p-1",
    previous: "s-1",
    destinationTasklist: "l-2",
  });
});

test("delete_task passes both ids through", async () => {
  const { calls, tools } = harness();
  await tools.delete_task({ tasklist_id: "l-1", task_id: "t-1" });
  assert.deepEqual(calls[0], { method: "deleteTask", params: ["l-1", "t-1"] });
});

test("a client error is returned as an isError result, not thrown", async () => {
  const { tools } = harness({ throwOn: "createTask" });
  const res = await tools.create_task({ tasklist_id: "l", title: "X" });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /boom/);
});
