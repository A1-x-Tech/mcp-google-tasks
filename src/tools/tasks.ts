import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleTasksClient } from "../client.js";
import {
  DESTRUCTIVE,
  dueDateSchema,
  fail,
  ok,
  READ_ONLY,
  rfc3339Timestamp,
  taskIdSchema,
  tasklistIdSchema,
  UPDATE,
  WRITE,
} from "./util.js";

export function registerTaskTools(server: McpServer, client: GoogleTasksClient): void {
  server.registerTool(
    "list_tasks",
    {
      title: "List tasks",
      annotations: READ_ONLY,
      description:
        "Lists tasks in one list: id, title, notes, status (needsAction|completed), due (date only — the API never stores a time of day), completed timestamp, parent (subtask's parent id), position (opaque sort key within siblings — sort by it client-side; change it only via move_task), updated, deleted/hidden flags, webViewLink. IMPORTANT: tasks completed in Google's own apps are also flagged hidden — pass show_completed=true AND show_hidden=true to reliably see all completed tasks. For incremental sync poll with updated_min plus show_deleted=true and show_hidden=true, so deletions and clears are not missed (the API has no push notifications). due_min/due_max bound the due date; completed_min/completed_max the completion time. Paginate with page_token; page_size caps at 100 (API default 20). Filtering by due/completed dates implies those fields exist — tasks without a due date never match due bounds.",
      inputSchema: {
        tasklist_id: tasklistIdSchema(),
        updated_min: rfc3339Timestamp()
          .optional()
          .describe("Only tasks modified after this RFC3339 UTC timestamp (updatedMin) — the sync filter."),
        due_min: rfc3339Timestamp().optional().describe("Lower bound on the due date (RFC3339)."),
        due_max: rfc3339Timestamp().optional().describe("Upper bound on the due date (RFC3339)."),
        completed_min: rfc3339Timestamp()
          .optional()
          .describe("Lower bound on the completion date (RFC3339)."),
        completed_max: rfc3339Timestamp()
          .optional()
          .describe("Upper bound on the completion date (RFC3339)."),
        show_completed: z
          .boolean()
          .optional()
          .describe("Include completed tasks (API default true; needs show_hidden=true to catch tasks completed in Google's UI)."),
        show_hidden: z.boolean().optional().describe("Include hidden tasks (API default false)."),
        show_deleted: z.boolean().optional().describe("Include deleted tasks (API default false; for sync)."),
        show_assigned: z
          .boolean()
          .optional()
          .describe("Include tasks assigned to the user from Google Docs / Chat spaces (API default false)."),
        page_size: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Max tasks per page (1..100; the API's default is 20)."),
        page_token: z.string().optional().describe("nextPageToken from the previous page."),
      },
    },
    async (args) => {
      try {
        return ok(
          await client.listTasks({
            taskListId: args.tasklist_id,
            updatedMin: args.updated_min,
            dueMin: args.due_min,
            dueMax: args.due_max,
            completedMin: args.completed_min,
            completedMax: args.completed_max,
            showCompleted: args.show_completed,
            showHidden: args.show_hidden,
            showDeleted: args.show_deleted,
            showAssigned: args.show_assigned,
            pageSize: args.page_size,
            pageToken: args.page_token,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "get_task",
    {
      title: "Get a task",
      annotations: READ_ONLY,
      description:
        "Fetches one task by id: title, notes, status, due (date only), completed timestamp, parent, position, updated, deleted/hidden flags, links and webViewLink. Also the safe way to verify state after an ambiguous write failure — writes are never retried automatically.",
      inputSchema: { tasklist_id: tasklistIdSchema(), task_id: taskIdSchema() },
    },
    async ({ tasklist_id, task_id }) => {
      try {
        return ok(await client.getTask(tasklist_id, task_id));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "create_task",
    {
      title: "Create a task",
      annotations: WRITE,
      description:
        "Creates a task in a list and returns it (id, title, position, webViewLink, ...). due accepts YYYY-MM-DD or an RFC3339 timestamp, but Google Tasks stores only the DATE — any time of day is discarded and never returned. notes is plain text (max 8192 chars); title max 1024 chars. Hierarchy and order are set at creation via parent (the id of an existing task in the same list — the new task becomes its subtask; Google Tasks supports one level of nesting reliably) and previous (the sibling to insert after; omit both to land at the top of the list). New tasks start as needsAction — use complete_task to complete. Recurrence cannot be created or read through the API.",
      inputSchema: {
        tasklist_id: tasklistIdSchema(),
        title: z.string().min(1).max(1024).describe("The task title (max 1024 chars)."),
        notes: z.string().max(8192).optional().describe("Free-text notes shown under the title (max 8192 chars)."),
        due: dueDateSchema()
          .optional()
          .describe("Due date: YYYY-MM-DD or RFC3339. Only the date is stored — the time part is discarded."),
        parent: taskIdSchema()
          .optional()
          .describe("Parent task id in the same list — makes the new task a subtask."),
        previous: taskIdSchema()
          .optional()
          .describe("Sibling task id to insert after (same parent). Omit to insert at the first position."),
      },
    },
    async ({ tasklist_id, title, notes, due, parent, previous }) => {
      try {
        return ok(
          await client.createTask({ taskListId: tasklist_id, title, notes, due, parent, previous }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "update_task",
    {
      title: "Update a task",
      annotations: UPDATE,
      description:
        "Changes a task's title, notes and/or due date (PATCH — only the provided fields change, at least one is required). clear_due=true / clear_notes=true erase the field entirely (you cannot clear by sending an empty string a Google API would keep). This tool does NOT change completion status (use complete_task / reopen_task), and cannot re-parent or reorder (use move_task) — parent and position are read-only in the task resource. Returns the updated task.",
      inputSchema: {
        tasklist_id: tasklistIdSchema(),
        task_id: taskIdSchema(),
        title: z.string().min(1).max(1024).optional().describe("New task title (max 1024 chars)."),
        notes: z.string().max(8192).optional().describe("New notes text (max 8192 chars; replaces the old notes)."),
        due: dueDateSchema()
          .optional()
          .describe("New due date: YYYY-MM-DD or RFC3339 (only the date is stored)."),
        clear_due: z.boolean().optional().describe("true removes the due date entirely (do not combine with due)."),
        clear_notes: z
          .boolean()
          .optional()
          .describe("true removes the notes entirely (do not combine with notes)."),
      },
    },
    async ({ tasklist_id, task_id, title, notes, due, clear_due, clear_notes }) => {
      try {
        if (clear_due && due !== undefined) {
          return fail(new Error("due and clear_due are mutually exclusive — pass one of them."));
        }
        if (clear_notes && notes !== undefined) {
          return fail(new Error("notes and clear_notes are mutually exclusive — pass one of them."));
        }
        return ok(
          await client.updateTask({
            taskListId: tasklist_id,
            taskId: task_id,
            title,
            notes,
            due,
            clearDue: clear_due,
            clearNotes: clear_notes,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "move_task",
    {
      title: "Move a task",
      annotations: WRITE,
      description:
        "Moves a task: under a parent (subtask), after a sibling (previous), and/or into another list (destination_tasklist). Omitting parent puts it at the top level; omitting previous puts it first among its siblings — so calling with neither moves the task to the very top of its list. This is the ONLY way to change hierarchy or order (parent/position are read-only fields; positions are opaque strings maintained by the API). Constraints: parent and previous must be in the task's (destination) list; assigned tasks and recurrent tasks cannot be moved between lists. Returns the task with its new position.",
      inputSchema: {
        tasklist_id: tasklistIdSchema(),
        task_id: taskIdSchema(),
        parent: taskIdSchema()
          .optional()
          .describe("New parent task id — the task becomes its subtask. Omit for the top level."),
        previous: taskIdSchema()
          .optional()
          .describe("Sibling task id to place the task after (same parent). Omit for the first position."),
        destination_tasklist: tasklistIdSchema()
          .optional()
          .describe("Move the task into this other task list."),
      },
    },
    async ({ tasklist_id, task_id, parent, previous, destination_tasklist }) => {
      try {
        return ok(
          await client.moveTask({
            taskListId: tasklist_id,
            taskId: task_id,
            parent,
            previous,
            destinationTasklist: destination_tasklist,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "delete_task",
    {
      title: "Delete a task",
      annotations: DESTRUCTIVE,
      description:
        "Deletes a task permanently — this is NOT the same as completing it. To mark work done (reversibly), use complete_task instead. A deleted task disappears from default listings immediately; for a while it remains visible to list_tasks with show_deleted=true (deleted:true) so sync clients can observe the deletion, then it is gone for good. Deleting a parent task also deletes its subtasks. Returns {deleted:true} with the ids echoed.",
      inputSchema: { tasklist_id: tasklistIdSchema(), task_id: taskIdSchema() },
    },
    async ({ tasklist_id, task_id }) => {
      try {
        return ok(await client.deleteTask(tasklist_id, task_id));
      } catch (e) {
        return fail(e);
      }
    },
  );
}
