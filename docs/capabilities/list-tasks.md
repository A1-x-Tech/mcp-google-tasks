# Google Tasks: List tasks — MCP tool

**Google Tasks MCP tool:** Lists the tasks of one task list with visibility filters, date bounds, pagination and the incremental-sync filter.

Technical name: `list_tasks`

## What task it solves

> I want to see the tasks in a list.

Returns tasks of one task list: `id`, `title`, `notes`, `status` (needsAction/completed), `due` (date only), `completed` timestamp, `parent` (set on subtasks), `position` (sort key among siblings) and `webViewLink`.

## When to use it

Use it to read a list, to find task ids for the mutation tools, and to sync changes incrementally with `updated_min`. Also the safe way to verify whether a write landed after an ambiguous failure.

## What to provide

- `tasklist_id` — **required**. `"@default"` targets the default list.
- `show_completed` — **optional**. Include completed tasks (default true).
- `show_hidden` — **optional**. Include tasks swept by clear_completed_tasks / the UI (default false).
- `show_deleted` — **optional**. Include deleted tasks — needed to sync deletions (default false).
- `show_assigned` — **optional**. Include tasks assigned from Google Docs / Chat spaces (default false).
- `due_min` / `due_max` — **optional**. RFC3339 bounds on the due date (exclusive).
- `completed_min` / `completed_max` — **optional**. RFC3339 bounds on the completion time (exclusive).
- `updated_min` — **optional**. RFC3339 lower bound on last modification — the incremental-sync filter; combine with show_deleted and show_hidden.
- `page_size` — **optional**. Max tasks per page (1..100; API default 20).
- `page_token` — **optional**. nextPageToken from the previous page.

## What it returns

The `items[]` array of tasks and `nextPageToken` when more pages exist. Sort siblings client-side by `position` (lexicographic).

## What changes in Google Tasks

The tool reads Google Tasks data and does not change it.

## Example request

> Show me the open tasks in my "Q4 launch" list in Google Tasks, due before the end of the month.

## Errors and limitations

Max 100 tasks per page. There is no server-side sort or text search — order and filter client-side. For sync, poll with `updated_min` set to the newest `updated` seen plus `show_deleted=true` and `show_hidden=true`; a rejected (too old) `updated_min` (HTTP 400) means fall back to a full re-list.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Get a task](./get-task.md) — `get_task`
- [Create a task](./create-task.md) — `create_task`
- [List task lists](./list-tasklists.md) — `list_tasklists`

## Technical details

- **Impact:** read-only
- **Group:** Tasks
- **Description source:** `list_tasks` registration in `src/tools/tasks.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
