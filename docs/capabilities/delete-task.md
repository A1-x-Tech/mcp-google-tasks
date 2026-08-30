# Google Tasks: Delete a task — MCP tool

**Google Tasks MCP tool:** Permanently deletes one task; not reversible, unlike completion.

Technical name: `delete_task`

## What task it solves

> I want to delete a task for good.

Permanently removes a task from its list.

## When to use it

Only when the task should disappear entirely — a duplicate, something added by mistake. For finished work prefer `complete_task`: completion is reversible, deletion is NOT (`reopen_task` cannot bring a deleted task back).

## What to provide

- `tasklist_id` — **required**. `"@default"` targets the default list.
- `task_id` — **required**. The task id from list_tasks or create_task output.

## What it returns

`{"deleted": true, "tasklist_id": …, "task_id": …}` (the API itself returns an empty body).

## What changes in Google Tasks

The task disappears from the user's Google Tasks. Deleting a task assigned from Docs/Chat also removes it in the originating document or space. Recently deleted tasks may briefly remain visible to `list_tasks` with `show_deleted=true` before being purged.

## Example request

> Delete the duplicate "Send the report" task in Google Tasks. Confirm which one before deleting.

## Errors and limitations

No undo and no trash. A wrong id returns HTTP 404. As a write it is never auto-retried — after an ambiguous failure check with `list_tasks` before repeating, or a second delete may hit the wrong target.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Complete a task](./complete-task.md) — `complete_task`
- [Clear completed tasks](./clear-completed-tasks.md) — `clear_completed_tasks`
- [Delete a task list](./delete-tasklist.md) — `delete_tasklist`

## Technical details

- **Impact:** destructive operation
- **Group:** Deletion
- **Description source:** `delete_task` registration in `src/tools/tasks.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
