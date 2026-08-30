# Google Tasks: Reopen a task — MCP tool

**Google Tasks MCP tool:** Reopens a completed task and clears its completion timestamp.

Technical name: `reopen_task`

## What task it solves

> I want to un-complete a task.

Sets a completed task's status back to `needsAction` and clears the completion timestamp.

## When to use it

When a task was completed by mistake or the work turned out unfinished. Also the recovery path for a task swept by `clear_completed_tasks` — find its id with `list_tasks` `show_hidden=true` first.

## What to provide

- `tasklist_id` — **required**. `"@default"` targets the default list.
- `task_id` — **required**. The task id from list_tasks (use show_hidden=true for swept tasks).

## What it returns

The updated task with `status: "needsAction"` and no `completed` timestamp.

## What changes in Google Tasks

The task shows as open again in the user's Google Tasks (and reappears in default listings if it was hidden). The previous completion timestamp is discarded.

## Example request

> Reopen "Send the report" in Google Tasks — it isn't actually done.

## Errors and limitations

Cannot resurrect a deleted task — `delete_task` is permanent. Reopening an already-open task converges (idempotent). A wrong id returns HTTP 404.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Complete a task](./complete-task.md) — `complete_task`
- [Clear completed tasks](./clear-completed-tasks.md) — `clear_completed_tasks`
- [List tasks](./list-tasks.md) — `list_tasks`

## Technical details

- **Impact:** changes data (reversible via `complete_task`)
- **Group:** Completion
- **Description source:** `reopen_task` registration in `src/tools/completion.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
