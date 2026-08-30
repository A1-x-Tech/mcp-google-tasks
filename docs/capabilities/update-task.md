# Google Tasks: Update a task — MCP tool

**Google Tasks MCP tool:** Changes a task's title, notes and/or due date with PATCH semantics.

Technical name: `update_task`

## What task it solves

> I want to edit a task.

Updates a task's `title`, `notes` and/or `due` — only the provided fields are touched; at least one is required.

## When to use it

Use it for content edits. Status and position are deliberately elsewhere: `complete_task` / `reopen_task` for completion, `move_task` for order and hierarchy.

## What to provide

- `tasklist_id` — **required**. `"@default"` targets the default list.
- `task_id` — **required**. The task id from list_tasks or create_task output.
- `title` — **optional**. New title (1..1024 characters).
- `notes` — **optional**. New notes (max 8192 characters).
- `due` — **optional**. New due date, e.g. `"2026-09-01"` (date only is stored).
- `clear_due` — **optional**. Remove the due date (mutually exclusive with due).
- `clear_notes` — **optional**. Remove the notes (mutually exclusive with notes).

## What it returns

The updated task.

## What changes in Google Tasks

The named fields are overwritten in place; everything else on the task stays as it was. Overwritten values are not recoverable — re-send the old value to revert.

## Example request

> Change the due date of "Send the report" to next Monday in Google Tasks.

## Errors and limitations

`clear_due` / `clear_notes` remove a field properly (an empty string would be stored verbatim). `due` stores only the calendar date. Passing no field at all, or a field together with its clear flag, is rejected before any network call.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Get a task](./get-task.md) — `get_task`
- [Complete a task](./complete-task.md) — `complete_task`
- [Move a task](./move-task.md) — `move_task`

## Technical details

- **Impact:** changes data (overwrites only the fields provided)
- **Group:** Tasks
- **Description source:** `update_task` registration in `src/tools/tasks.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
