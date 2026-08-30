# Google Tasks: Create a task list — MCP tool

**Google Tasks MCP tool:** Creates a new task list and returns its generated id.

Technical name: `create_tasklist`

## What task it solves

> I want to create a new task list.

Creates a task list with the given title and returns it with the generated `id` the task tools need.

## When to use it

Use it to open a new area of work (a project, a shopping list) before adding tasks to it. If a list with that name may already exist, check `list_tasklists` first — titles are not unique and calling this twice creates two lists.

## What to provide

- `title` — **required**. The task list title (1..1024 characters).

## What it returns

The created task list: `id`, `title`, `updated`, `selfLink`. Keep the `id` for `create_task` / `list_tasks`.

## What changes in Google Tasks

A new, empty task list appears in the user's Google Tasks (Gmail/Calendar side panel and mobile apps). No existing data is touched.

## Example request

> Create a task list called "Q4 launch" in Google Tasks.

## Errors and limitations

Title is capped at 1024 characters; Google caps the number of lists per account. This is a create — after an ambiguous failure check `list_tasklists` before re-sending, or you may end up with duplicates.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [List task lists](./list-tasklists.md) — `list_tasklists`
- [Create a task](./create-task.md) — `create_task`
- [Delete a task list](./delete-tasklist.md) — `delete_tasklist`

## Technical details

- **Impact:** changes data
- **Group:** Task lists
- **Description source:** `create_tasklist` registration in `src/tools/tasklists.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
