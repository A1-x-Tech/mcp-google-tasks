import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GoogleTasksClient } from "../client.js";
import { DESTRUCTIVE, fail, ok, taskIdSchema, tasklistIdSchema, UPDATE } from "./util.js";

/**
 * Completion is deliberately separated from deletion: completing a task is
 * reversible (reopen_task restores it), deleting is not. The two reversible
 * transitions are UPDATE; clear_completed_tasks hides many tasks at once and
 * cannot be undone in bulk, so it carries the destructive hints.
 */
export function registerCompletionTools(server: McpServer, client: GoogleTasksClient): void {
  server.registerTool(
    "complete_task",
    {
      title: "Complete a task",
      annotations: UPDATE,
      description:
        "Marks a task completed (status=completed; the API stamps the completed timestamp). This is REVERSIBLE — reopen_task undoes it — and is the right call for \"done\", unlike delete_task which erases the task. The API call touches only the addressed task: completing a parent does NOT cascade to its subtasks — complete them individually if the whole tree is done. A completed task stays listed until cleared: list_tasks still returns it with show_completed=true (+ show_hidden=true after a clear). Returns the updated task with status and completed.",
      inputSchema: { tasklist_id: tasklistIdSchema(), task_id: taskIdSchema() },
    },
    async ({ tasklist_id, task_id }) => {
      try {
        return ok(await client.setTaskStatus(tasklist_id, task_id, true));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "reopen_task",
    {
      title: "Reopen a task",
      annotations: UPDATE,
      description:
        "Reverts a completed task to needsAction and clears its completed timestamp — the undo for complete_task. Works on hidden tasks too (tasks cleared with clear_completed_tasks): reopening un-hides them. Cannot resurrect a deleted task — deletion is permanent. Returns the updated task.",
      inputSchema: { tasklist_id: tasklistIdSchema(), task_id: taskIdSchema() },
    },
    async ({ tasklist_id, task_id }) => {
      try {
        return ok(await client.setTaskStatus(tasklist_id, task_id, false));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "clear_completed_tasks",
    {
      title: "Clear completed tasks",
      annotations: DESTRUCTIVE,
      description:
        "Clears ALL completed tasks from one list in a single call: they are flagged hidden and vanish from default listings (the Google Tasks UI does this as \"Delete all completed\"). The tasks are not deleted — list_tasks with show_completed=true and show_hidden=true still returns them, and reopen_task can restore any of them individually — but there is no single call to un-clear a whole list, so treat it as destructive. Open (needsAction) tasks are untouched. Returns {cleared:true} with the tasklist_id echoed.",
      inputSchema: { tasklist_id: tasklistIdSchema() },
    },
    async ({ tasklist_id }) => {
      try {
        return ok(await client.clearCompletedTasks(tasklist_id));
      } catch (e) {
        return fail(e);
      }
    },
  );
}
