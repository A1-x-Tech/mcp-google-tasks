# Google Tasks: Clear completed tasks — MCP tool

**Google Tasks MCP tool:** Sweeps every completed task in a list into the hidden state in one call.

Technical name: `clear_completed_tasks`

## What task it solves

> I want to tidy a list of its completed tasks.

Marks ALL completed tasks in one task list as hidden — the API's "clear". They leave default `list_tasks` results; open tasks are untouched.

## When to use it

To declutter a list after a burst of finished work, without deleting anything task by task. It is the API twin of the UI's "Clear completed tasks" action.

## What to provide

- `tasklist_id` — **required**. `"@default"` targets the default list.

## What it returns

`{"cleared": true, "tasklist_id": …}` (the API itself returns an empty body).

## What changes in Google Tasks

Every completed task in the list becomes `hidden` at once. The operation is bulk and has NO un-clear — though each task still exists: `list_tasks` with `show_hidden=true` reads them and `reopen_task` revives one.

## Example request

> Clear all the completed tasks from my "Q4 launch" list in Google Tasks.

## Errors and limitations

Affects only tasks with `status: completed`; open tasks are never touched. There is no per-task selection and no single call to undo the sweep. A wrong list id returns HTTP 404.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Complete a task](./complete-task.md) — `complete_task`
- [Reopen a task](./reopen-task.md) — `reopen_task`
- [Delete a task list](./delete-tasklist.md) — `delete_tasklist`

## Technical details

- **Impact:** destructive operation
- **Group:** Deletion
- **Description source:** `clear_completed_tasks` registration in `src/tools/completion.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
