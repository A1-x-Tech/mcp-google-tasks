# Google Tasks MCP capabilities

This catalog contains 21 public pages—one for every registered MCP tool in `mcp-google-tasks`. Each page starts with the user's task, explains the result, and states whether the call changes real data.

Use this catalog to choose a ready-made capability. Full parameter schemas and API response details remain in the [technical reference](../TOOLS.md).

## Connection

- [Connection status](./auth-status.md) — Reports whether Google Tasks is connected, where the token comes from, when it expires and which account it belongs to. **Impact:** read-only.
- [Setup instructions](./setup-instructions.md) — Returns the step-by-step text for creating a Google Cloud OAuth client and enabling Google Tasks API, ready to show the user verbatim. **Impact:** read-only.
- [Save the OAuth client](./set-client.md) — Reads the OAuth client JSON downloaded from Google Cloud Console and stores it for every mcp-google-* server to reuse. **Impact:** changes data.
- [Start the login](./start-login.md) — Opens a loopback + PKCE login and returns the Google consent URL for the user to approve in their browser. **Impact:** changes data.
- [Finish the login](./finish-login.md) — Exchanges the approved consent for tokens, stores them owner-only and verifies that the connection really works. **Impact:** changes data.
- [Disconnect](./logout.md) — Revokes the stored token at Google and deletes the local login; environment credentials are left untouched. **Impact:** destructive operation.

## Task lists

- [List task lists](./list-tasklists.md) — Lists the user's task lists: id, title and updated timestamp for each. **Impact:** read-only.
- [Get a task list](./get-tasklist.md) — Fetches one task list's metadata by id. **Impact:** read-only.
- [Create a task list](./create-tasklist.md) — Creates a new task list and returns its generated id. **Impact:** changes data.
- [Rename a task list](./update-tasklist.md) — Renames a task list; the tasks inside are untouched. **Impact:** changes data.
- [Delete a task list](./delete-tasklist.md) — Permanently deletes a task list and every task in it. **Impact:** destructive operation.

## Tasks

- [List tasks](./list-tasks.md) — Lists the tasks of one task list with visibility filters, date bounds, pagination and the incremental-sync filter. **Impact:** read-only.
- [Get a task](./get-task.md) — Fetches one task by id, including hierarchy and assignment metadata. **Impact:** read-only.
- [Create a task](./create-task.md) — Creates a task with notes, a date-only due date and optional subtask positioning. **Impact:** changes data.
- [Update a task](./update-task.md) — Changes a task's title, notes and/or due date with PATCH semantics. **Impact:** changes data.
- [Move a task](./move-task.md) — Repositions a task: order, subtask nesting, or another list. **Impact:** changes data.

## Completion (reversible)

- [Complete a task](./complete-task.md) — Marks a task completed — the reversible way to finish work. **Impact:** changes data (reversible).
- [Reopen a task](./reopen-task.md) — Reopens a completed task and clears its completion timestamp. **Impact:** changes data (reversible).

## Deletion (destructive)

- [Delete a task](./delete-task.md) — Permanently deletes one task; not reversible, unlike completion. **Impact:** destructive operation.
- [Clear completed tasks](./clear-completed-tasks.md) — Sweeps every completed task in a list into the hidden state in one call. **Impact:** destructive operation.

## Additional API methods

- [Raw Google Tasks API call](./raw-request.md) — Escape hatch to any Google Tasks API v1 path the typed tools don't cover. **Impact:** destructive operation.

## For maintainers and publishers

- [MCP capability documentation contract](../CAPABILITY-DOCUMENTATION.md)
- [Technical tool reference](../TOOLS.md)
- [GitHub repository](https://github.com/A1-x-Tech/mcp-google-tasks)
