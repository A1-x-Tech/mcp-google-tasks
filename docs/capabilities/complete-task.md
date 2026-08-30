# Google Tasks: Complete a task — MCP tool

**Google Tasks MCP tool:** Marks a task completed — the reversible way to finish work.

Technical name: `complete_task`

## What task it solves

> I want to mark a task as done.

Sets the task's status to `completed`; the API stamps the completion time.

## When to use it

Whenever work is finished. Prefer this over `delete_task` for finished work — completion is REVERSIBLE (`reopen_task` undoes it), deletion is not.

## What to provide

- `tasklist_id` — **required**. `"@default"` targets the default list.
- `task_id` — **required**. The task id from list_tasks or create_task output.

## What it returns

The updated task with `status: "completed"` and the `completed` timestamp.

## What changes in Google Tasks

The task shows as checked-off in the user's Google Tasks. It stays visible to `list_tasks` (show_completed defaults to true) until swept by `clear_completed_tasks` or the UI. Fully reversible via `reopen_task`.

## Example request

> Mark "Send the report" as done in Google Tasks.

## Errors and limitations

Completing a parent does NOT complete its subtasks — complete each subtask first if the whole tree is done. Completing an already-completed task converges (idempotent). A wrong id returns HTTP 404.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Reopen a task](./reopen-task.md) — `reopen_task`
- [Clear completed tasks](./clear-completed-tasks.md) — `clear_completed_tasks`
- [Delete a task](./delete-task.md) — `delete_task`

## Technical details

- **Impact:** changes data (reversible via `reopen_task`)
- **Group:** Completion
- **Description source:** `complete_task` registration in `src/tools/completion.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
