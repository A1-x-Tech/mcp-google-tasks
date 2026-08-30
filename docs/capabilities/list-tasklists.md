# Google Tasks: List task lists — MCP tool

**Google Tasks MCP tool:** Lists the user's task lists — the entry point for every other tool.

Technical name: `list_tasklists`

## What task it solves

> I want to see my task lists.

Returns the user's task lists: `id`, `title` and `updated` timestamp for each.

## When to use it

Start here: every task tool needs a task list id. Skip it only when the default list is enough — that one is addressable as `"@default"` without listing first.

## What to provide

- `page_size` — **optional**. Max task lists per page (1..1000; the API's default is 1000).
- `page_token` — **optional**. nextPageToken from the previous page.

## What it returns

The `items[]` array of task lists (`id`, `title`, `updated`, `selfLink`) and `nextPageToken` when more pages exist. Tasks themselves are not included — fetch them per list with `list_tasks`.

## What changes in Google Tasks

The tool reads Google Tasks data and does not change it.

## Example request

> List my task lists in Google Tasks.

## Errors and limitations

Up to 1000 lists per page, so a single call usually returns everything. Google caps the number of lists per account. There is no filter or search — match titles client-side.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Get a task list](./get-tasklist.md) — `get_tasklist`
- [Create a task list](./create-tasklist.md) — `create_tasklist`
- [List tasks](./list-tasks.md) — `list_tasks`

## Technical details

- **Impact:** read-only
- **Group:** Task lists
- **Description source:** `list_tasklists` registration in `src/tools/tasklists.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
