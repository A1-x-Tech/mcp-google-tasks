# Google Tasks: Rename a task list — MCP tool

**Google Tasks MCP tool:** Renames a task list; the tasks inside are untouched.

Technical name: `update_tasklist`

## What task it solves

> I want to rename a task list.

Changes a task list's title — the only writable field a task list has.

## When to use it

Use it when a list should carry a different name. It never moves, merges or deletes tasks; for those use `move_task` / `delete_tasklist`.

## What to provide

- `tasklist_id` — **required**. The task list id from list_tasklists or create_tasklist output; `"@default"` targets the default list.
- `title` — **required**. The new title (1..1024 characters).

## What it returns

The updated task list with the new `title` and `updated` timestamp.

## What changes in Google Tasks

The list's visible name changes everywhere Google Tasks is shown. The old title is overwritten — repeat the call with the previous title to revert.

## Example request

> Rename my "Q4 launch" task list to "Q4 launch — done" in Google Tasks.

## Errors and limitations

Title is capped at 1024 characters. A wrong id returns HTTP 404. The rename overwrites the previous title without confirmation.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [List task lists](./list-tasklists.md) — `list_tasklists`
- [Get a task list](./get-tasklist.md) — `get_tasklist`
- [Delete a task list](./delete-tasklist.md) — `delete_tasklist`

## Technical details

- **Impact:** changes data (renames the list; its tasks are untouched)
- **Group:** Task lists
- **Description source:** `update_tasklist` registration in `src/tools/tasklists.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
