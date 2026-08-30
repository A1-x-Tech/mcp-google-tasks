# Google Tasks: Get a task — MCP tool

**Google Tasks MCP tool:** Fetches one task by id, including hierarchy and assignment metadata.

Technical name: `get_task`

## What task it solves

> I want to inspect one task.

Returns a single task: `title`, `notes`, `status`, `due` (date only), `completed` timestamp, `parent`, `position`, `links`, `webViewLink` and the read-only `assignmentInfo` for tasks assigned from Docs/Chat.

## When to use it

Use it when you hold a task id and need its current state — for example before an update, or to check whether a write landed after an ambiguous failure (writes are never retried automatically).

## What to provide

- `tasklist_id` — **required**. `"@default"` targets the default list.
- `task_id` — **required**. The task id from list_tasks or create_task output.

## What it returns

The full task object.

## What changes in Google Tasks

The tool reads Google Tasks data and does not change it.

## Example request

> Show me the details of that task in Google Tasks. Ask for any required identifiers that are missing.

## Errors and limitations

A wrong task or list id returns HTTP 404. `due` never carries a time of day — the API stores dates only.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [List tasks](./list-tasks.md) — `list_tasks`
- [Update a task](./update-task.md) — `update_task`
- [Complete a task](./complete-task.md) — `complete_task`

## Technical details

- **Impact:** read-only
- **Group:** Tasks
- **Description source:** `get_task` registration in `src/tools/tasks.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
