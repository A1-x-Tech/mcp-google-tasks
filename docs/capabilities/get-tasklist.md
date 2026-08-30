# Google Tasks: Get a task list — MCP tool

**Google Tasks MCP tool:** Fetches one task list's metadata by id.

Technical name: `get_tasklist`

## What task it solves

> I want to check a task list.

Returns one task list: `id`, `title`, `updated` timestamp and `selfLink`.

## When to use it

Use it to confirm a list exists or read its current title when you already hold its id. To browse all lists use `list_tasklists`; to read the tasks inside use `list_tasks`.

## What to provide

- `tasklist_id` — **required**. The task list id from list_tasklists or create_tasklist output; `"@default"` targets the default list.

## What it returns

The task list object. It carries only metadata — no tasks.

## What changes in Google Tasks

The tool reads Google Tasks data and does not change it.

## Example request

> Show me the details of my default task list in Google Tasks.

## Errors and limitations

A wrong or foreign id returns HTTP 404. This returns metadata only; the tasks come from `list_tasks`.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [List task lists](./list-tasklists.md) — `list_tasklists`
- [List tasks](./list-tasks.md) — `list_tasks`
- [Rename a task list](./update-tasklist.md) — `update_tasklist`

## Technical details

- **Impact:** read-only
- **Group:** Task lists
- **Description source:** `get_tasklist` registration in `src/tools/tasklists.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
