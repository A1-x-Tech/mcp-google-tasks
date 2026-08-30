# Google Tasks: Create a task — MCP tool

**Google Tasks MCP tool:** Creates a task with notes, a date-only due date and optional subtask positioning.

Technical name: `create_task`

## What task it solves

> I want to add a task.

Creates a task in a task list and returns it with its generated `id`.

## When to use it

Use it to add to-dos. `parent` makes the new task a subtask in one call; `previous` places it after a given sibling (omit for the first position).

## What to provide

- `tasklist_id` — **required**. `"@default"` targets the default list.
- `title` — **required**. The task title (1..1024 characters).
- `notes` — **optional**. Free-text notes (max 8192 characters) — also the place for times of day.
- `due` — **optional**. Due date, e.g. `"2026-09-01"` (a time portion is accepted but discarded by the API).
- `parent` — **optional**. Parent task id in the same list — creates the task as a subtask.
- `previous` — **optional**. Sibling task id to insert after; omit to insert at the top.

## What it returns

The created task with `id`, `position`, `status: needsAction`, `webViewLink`.

## What changes in Google Tasks

A new open task appears in the chosen list (and under the chosen parent) in the user's Google Tasks. No existing data is touched.

## Example request

> Add a task "Send the report" due next Friday to my default list in Google Tasks.

## Errors and limitations

The API stores ONLY the calendar date of `due` — a due time cannot exist; keep times in `notes`. Recurring tasks cannot be created through the API, and neither can tasks assigned from Docs/Chat. Limits: title 1024 chars, notes 8192 chars. Calling this twice creates two tasks — after an ambiguous failure check with `list_tasks` instead of re-sending.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [List tasks](./list-tasks.md) — `list_tasks`
- [Update a task](./update-task.md) — `update_task`
- [Move a task](./move-task.md) — `move_task`
- [Complete a task](./complete-task.md) — `complete_task`

## Technical details

- **Impact:** changes data
- **Group:** Tasks
- **Description source:** `create_task` registration in `src/tools/tasks.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
