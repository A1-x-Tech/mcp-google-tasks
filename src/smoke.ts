import { ConfigError, CredentialsError, loadConfig } from "./config.js";
import { GoogleTasksClient } from "./client.js";

/**
 * Live smoke check.
 *
 * Default (read-only): lists the user's task lists — the credentials and a real
 * API read are exercised, nothing is written.
 *
 * Opt-in write scenario (`--write` or GOOGLE_TASKS_SMOKE_WRITE=1): runs the full lifecycle
 * on a DISPOSABLE task list created for the run — create list → create task →
 * complete → reopen → move → delete task → delete list — and cleans up in a
 * finally block, so the disposable list is removed after success AND after a
 * failure. It never touches pre-existing lists or tasks.
 */
async function main(): Promise<void> {
  const client = new GoogleTasksClient(loadConfig());

  const writeMode = process.argv.includes("--write") || process.env.GOOGLE_TASKS_SMOKE_WRITE === "1";
  if (!writeMode) {
    const lists = (await client.listTaskLists({ pageSize: 10 })) as { items?: { title?: string }[] };
    console.log(
      JSON.stringify({ ok: true, mode: "read-only", taskLists: lists.items?.length ?? 0 }, null, 2),
    );
    return;
  }

  const stamp = `mcp-smoke-${Date.now()}`;
  const list = (await client.createTaskList(stamp)) as { id: string };
  let steps = 0;
  try {
    const task = (await client.createTask({
      taskListId: list.id,
      title: "smoke task",
      notes: "created by npm run smoke",
      due: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
    })) as { id: string };
    steps++;
    await client.setTaskStatus(list.id, task.id, true);
    steps++;
    await client.setTaskStatus(list.id, task.id, false);
    steps++;
    await client.moveTask({ taskListId: list.id, taskId: task.id });
    steps++;
    await client.deleteTask(list.id, task.id);
    steps++;
    console.log(JSON.stringify({ ok: true, mode: "write", list: stamp, steps }, null, 2));
  } finally {
    // Cleanup runs after success and after any failure above: the disposable
    // list (and anything left inside it) is deleted either way.
    await client.deleteTaskList(list.id).catch((err) => {
      console.error(`cleanup failed — delete task list "${stamp}" manually:`, err?.message ?? err);
    });
  }
}

main().catch((err) => {
  // Missing or malformed credentials are a user error, not a bug: no stack.
  const userError = err instanceof ConfigError || err instanceof CredentialsError;
  console.error("smoke failed:", userError ? err.message : err);
  process.exit(1);
});
