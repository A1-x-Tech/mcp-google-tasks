# Google Tasks: Move a task — MCP tool

**Google Tasks MCP tool:** Repositions a task — order, subtask nesting, or another list.

Technical name: `move_task`

## What task it solves

> I want to reorder or re-nest a task.

Moves a task to a new position (`previous`), under a parent as a subtask (`parent`), back to the top level (omit `parent`), or into another task list (`destination_tasklist`).

## When to use it

The ONLY way to change order or hierarchy — the `position` field is read-only, so patching it is impossible. Use it after `create_task` when the default placement is wrong, or to build parent/child structures.

## What to provide

- `tasklist_id` — **required**. The list the task is currently in.
- `task_id` — **required**. The task id from list_tasks or create_task output.
- `parent` — **optional**. New parent task id (subtask nesting); omit to place the task at the top level.
- `previous` — **optional**. Sibling task id to place the task after; omit for the first position.
- `destination_tasklist` — **optional**. Target task list id — moves the task (and its subtasks) to that list.

## What it returns

The task with its new `position` (and `parent` when nested).

## What changes in Google Tasks

The task's place in the user's Google Tasks changes — among siblings, in the tree, or across lists. Nothing is created or deleted; subtasks follow a moved parent.

## Example request

> Move "Write the summary" under "Send the report" as a subtask in Google Tasks.

## Errors and limitations

`parent` and `previous` must be task ids in the target list. The Google Tasks UI shows one level of nesting. Tasks assigned from Docs/Chat cannot be moved to another list. As a write it is never auto-retried — verify with `get_task` after an ambiguous failure.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Create a task](./create-task.md) — `create_task`
- [List tasks](./list-tasks.md) — `list_tasks`
- [Update a task](./update-task.md) — `update_task`

## Technical details

- **Impact:** changes data
- **Group:** Tasks
- **Description source:** `move_task` registration in `src/tools/tasks.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
