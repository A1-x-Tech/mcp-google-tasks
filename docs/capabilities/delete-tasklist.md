# Google Tasks: Delete a task list — MCP tool

**Google Tasks MCP tool:** Permanently deletes a task list and every task in it.

Technical name: `delete_tasklist`

## What task it solves

> I want to delete an entire task list.

Removes a task list **and all of its tasks** permanently.

## When to use it

Only when the whole list — including everything inside — should disappear for good. To finish work without losing it, prefer `complete_task`; to empty a list of completed tasks, prefer `clear_completed_tasks`. Consider calling `list_tasks` first to show the user what would be lost.

## What to provide

- `tasklist_id` — **required**. The task list id from list_tasklists; `"@default"` cannot be deleted.

## What it returns

`{"deleted": true, "tasklist_id": …}` (the API itself returns an empty body).

## What changes in Google Tasks

The list and every task in it vanish from the user's Google Tasks everywhere. **There is no undo and no trash.** Tasks assigned from Docs/Chat that lived in the list are removed at their origin too.

## Example request

> Delete the "Old project" task list in Google Tasks. Show me its tasks first and wait for my confirmation.

## Errors and limitations

The user's default task list cannot be deleted — the API rejects it (HTTP 400). A wrong id returns HTTP 404. This write is never auto-retried; after an ambiguous failure check `list_tasklists` instead of re-sending.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Clear completed tasks](./clear-completed-tasks.md) — `clear_completed_tasks`
- [Delete a task](./delete-task.md) — `delete_task`
- [List tasks](./list-tasks.md) — `list_tasks`

## Technical details

- **Impact:** destructive operation
- **Group:** Task lists
- **Description source:** `delete_tasklist` registration in `src/tools/tasklists.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
