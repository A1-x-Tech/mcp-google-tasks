import { test } from "node:test";
import assert from "node:assert/strict";
import { registerTaskListTools } from "./tasklists.js";
import { registerTaskTools } from "./tasks.js";
import { registerCompletionTools } from "./completion.js";
import { registerRawTool } from "./raw.js";
import { DESTRUCTIVE, READ_ONLY, UPDATE, WRITE } from "./util.js";

interface Annotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

/** Registers every tool against a fake server, capturing each tool's annotations. */
function collectAnnotations(): Record<string, Annotations | undefined> {
  const annotations: Record<string, Annotations | undefined> = {};
  const server = {
    registerTool: (name: string, cfg: { annotations?: Annotations }) => {
      annotations[name] = cfg.annotations;
    },
  };
  // Registration reads the client only inside handlers, so a stub is fine here.
  registerTaskListTools(server as never, {} as never);
  registerTaskTools(server as never, {} as never);
  registerCompletionTools(server as never, {} as never);
  registerRawTool(server as never, {} as never);
  return annotations;
}

const ANN = collectAnnotations();

/**
 * The Tasks API mixes reads and writes, so instead of one blanket invariant the
 * expected hints are pinned per tool. Changing a tool's annotation must be a
 * conscious decision that updates this map.
 */
const EXPECTED: Record<string, Annotations> = {
  list_tasklists: READ_ONLY,
  get_tasklist: READ_ONLY,
  create_tasklist: WRITE,
  update_tasklist: UPDATE,
  delete_tasklist: DESTRUCTIVE,
  list_tasks: READ_ONLY,
  get_task: READ_ONLY,
  create_task: WRITE,
  update_task: UPDATE,
  move_task: WRITE,
  delete_task: DESTRUCTIVE,
  complete_task: UPDATE,
  reopen_task: UPDATE,
  clear_completed_tasks: DESTRUCTIVE,
  raw_request: DESTRUCTIVE,
};

test("registers all fifteen tools with annotations", () => {
  assert.deepEqual(Object.keys(ANN).sort(), Object.keys(EXPECTED).sort());
  for (const [name, a] of Object.entries(ANN)) {
    assert.ok(a, `${name} is missing annotations`);
  }
});

test("every tool carries exactly its pinned hints (all four set)", () => {
  for (const [name, expected] of Object.entries(EXPECTED)) {
    assert.deepEqual(ANN[name], expected, `${name} annotations drifted`);
  }
});

/**
 * The issue's core safety split: reversible completion must never look like
 * deletion. complete/reopen converge on replay and can undo each other, so
 * they are idempotent updates; the deletes are non-idempotent destructive.
 */
test("reversible completion is separated from destructive deletion", () => {
  for (const name of ["complete_task", "reopen_task"]) {
    assert.equal(ANN[name]?.idempotentHint, true, `${name} must be idempotent (reversible)`);
  }
  for (const name of ["delete_task", "delete_tasklist", "clear_completed_tasks"]) {
    assert.equal(ANN[name]?.destructiveHint, true, `${name} must be destructive`);
    assert.equal(ANN[name]?.idempotentHint, false, `${name} must be non-idempotent`);
  }
});

test("list/get tools stay read-only", () => {
  for (const name of ["list_tasklists", "get_tasklist", "list_tasks", "get_task"]) {
    assert.equal(ANN[name]?.readOnlyHint, true, `${name} must be read-only`);
  }
});
