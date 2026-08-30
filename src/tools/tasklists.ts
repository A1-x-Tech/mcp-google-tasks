import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleTasksClient } from "../client.js";
import { DESTRUCTIVE, fail, ok, READ_ONLY, tasklistIdSchema, UPDATE, WRITE } from "./util.js";

export function registerTaskListTools(server: McpServer, client: GoogleTasksClient): void {
  server.registerTool(
    "list_tasklists",
    {
      title: "List task lists",
      annotations: READ_ONLY,
      description:
        "Lists the user's task lists: id, title, updated (RFC3339). Every task lives in exactly one list, so this is the entry point — task tools need a tasklist_id from here (or the \"@default\" alias for the default list). Paginate with page_token from nextPageToken; page_size caps a page at 1000 and the API's default is already 1000, so one call usually returns everything. The API has no search or ordering — filter client-side.",
      inputSchema: {
        page_size: z
          .number()
          .int()
          .min(1)
          .max(1000)
          .optional()
          .describe("Max task lists per page (1..1000; the API's default is 1000)."),
        page_token: z.string().optional().describe("nextPageToken from the previous page."),
      },
    },
    async ({ page_size, page_token }) => {
      try {
        return ok(await client.listTaskLists({ pageSize: page_size, pageToken: page_token }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "get_tasklist",
    {
      title: "Get a task list",
      annotations: READ_ONLY,
      description:
        'Fetches one task list by id: id, title, updated, selfLink. Accepts "@default" for the user\'s default list — useful to resolve its real id. The list resource carries only metadata; the tasks themselves come from list_tasks.',
      inputSchema: { tasklist_id: tasklistIdSchema() },
    },
    async ({ tasklist_id }) => {
      try {
        return ok(await client.getTaskList(tasklist_id));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "create_tasklist",
    {
      title: "Create a task list",
      annotations: WRITE,
      description:
        "Creates a new task list and returns it (id, title, updated). The API accepts only a title — there are no other list-level settings. The returned id is the tasklist_id every task tool needs. Google caps the number of lists per account; a quota failure surfaces as an HTTP error, not silence.",
      inputSchema: {
        title: z.string().min(1).max(1024).describe("The list title shown in Google Tasks (max 1024 chars)."),
      },
    },
    async ({ title }) => {
      try {
        return ok(await client.createTaskList(title));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "update_tasklist",
    {
      title: "Rename a task list",
      annotations: UPDATE,
      description:
        "Renames a task list (PATCH — the title is the only field the API lets you change). Tasks, their order and their completion state are untouched. Returns the updated list resource.",
      inputSchema: {
        tasklist_id: tasklistIdSchema(),
        title: z.string().min(1).max(1024).describe("The new list title (max 1024 chars)."),
      },
    },
    async ({ tasklist_id, title }) => {
      try {
        return ok(await client.updateTaskList(tasklist_id, title));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "delete_tasklist",
    {
      title: "Delete a task list",
      annotations: DESTRUCTIVE,
      description:
        "Deletes a task list AND every task in it, permanently — there is no undo and no trash. The user's default task list cannot be deleted (the API rejects it). To empty a list but keep it, use clear_completed_tasks or delete tasks one by one instead. Returns {deleted:true} with the tasklist_id echoed.",
      inputSchema: { tasklist_id: tasklistIdSchema() },
    },
    async ({ tasklist_id }) => {
      try {
        return ok(await client.deleteTaskList(tasklist_id));
      } catch (e) {
        return fail(e);
      }
    },
  );
}
