# Tools

For task-oriented guidance, open the [MCP capability catalog](./capabilities/index.md). This page remains the technical reference for schemas and API responses.

The Google Tasks API mixes reads and writes, so every tool carries explicit MCP
annotations: reads are `readOnlyHint`, updates are idempotent-but-overwriting,
deletes are destructive. Inputs use a normalized snake_case vocabulary; the
client maps them to the API's wire values (camelCase query params like
`showCompleted`/`dueMin`, the `needsAction`/`completed` status enum, JSON
`null`s that clear fields in a PATCH) and handles OAuth entirely on its own.

`tasklist_id` comes from `list_tasklists` or `create_tasklist`; the special id
`"@default"` addresses the user's default list everywhere. `task_id` comes from
`list_tasks` / `create_task`.

## Task lists

| Tool | Description |
|---|---|
| `list_tasklists` | Lists task lists (`id`, `title`, `updated`). Paginate with `page_token`; `page_size` ≤ 1000 (API default 1000, so one call usually returns everything). |
| `get_tasklist` | One task list's metadata by id. The tasks come from `list_tasks`. |
| `create_tasklist` | Creates a list (title ≤ 1024 chars) and returns its generated id. Titles are not unique — calling twice creates two lists. Google caps the number of lists per account; the cap surfaces as an HTTP error, not silence. |
| `update_tasklist` | Renames a list (`title` is the only writable field). PATCH — tasks untouched. |
| `delete_tasklist` | **Permanently** deletes the list **and every task in it**. The default list cannot be deleted (API 400). No undo. |

## Tasks

| Tool | Description |
|---|---|
| `list_tasks` | Tasks of one list: `id`, `title`, `notes`, `status`, `due`, `completed`, `parent`, `position`, `webViewLink`. Filters: `show_completed` (default true), `show_hidden`, `show_deleted`, `show_assigned` (all default false), `due_min`/`due_max`, `completed_min`/`completed_max`, `updated_min` (all RFC3339, exclusive). `page_size` ≤ 100 (API default 20), paginate with `page_token`. **No server-side sort/search** — sort siblings by `position` (lexicographic), filter client-side. |
| `get_task` | One task by id, incl. read-only `assignmentInfo` for tasks assigned from Docs/Chat. Also the safe post-failure check: writes are never auto-retried. |
| `create_task` | Creates a task: `title` (≤1024), `notes` (≤8192), `due` (`YYYY-MM-DD` or RFC3339 — **date only is stored**), `parent` (subtask), `previous` (insert after that sibling; omitted = first). `parent`/`previous` are wire query params of `tasks.insert`. Recurring tasks cannot be created. |
| `update_task` | PATCH of `title` / `notes` / `due`; only provided fields change, ≥1 required. `clear_due` / `clear_notes` send explicit JSON `null` (an empty string would be stored verbatim). Status/position are deliberately elsewhere (`complete_task`/`reopen_task`, `move_task`). |
| `move_task` | The only way to change order/hierarchy (`position` is read-only): `previous` = new predecessor sibling, `parent` = nest as subtask (omit to un-nest to top level), `destination_tasklist` = move to another list (subtasks follow; assigned tasks cannot change lists). |

## Completion (reversible) vs deletion (destructive)

| Tool | Description |
|---|---|
| `complete_task` | `status=completed` (the API stamps `completed`). Reversible via `reopen_task`. Does **not** cascade to subtasks. |
| `reopen_task` | `status=needsAction` + clears the `completed` stamp (the API rejects a needsAction task with one). Also un-hides a task swept by `clear_completed_tasks` (find it with `show_hidden=true`). |
| `delete_task` | **Permanent** — `reopen_task` cannot bring it back. Deleting an assigned task also removes it in the originating Doc/Chat. |
| `clear_completed_tasks` | Bulk sweep: every completed task in the list becomes `hidden` and leaves default `list_tasks` results. No un-clear; individual tasks remain readable with `show_hidden=true` and revive via `reopen_task`. |

## Escape hatch

| Tool | Description |
|---|---|
| `raw_request` | Calls any Tasks API v1 path directly (`GET`/`POST`/`PATCH`/`PUT`/`DELETE`, default GET) — e.g. a full-replace `PUT` update. The path may carry a query string. A path resolving to a foreign origin is rejected (SSRF guard), so the Bearer token never leaves `tasks.googleapis.com`. Wire names apply (camelCase params, `needsAction`/`completed`). |

## Notes

- **Retry policy:** 429 is retried with backoff for every method (the request was rejected
  before executing); 5xx and network errors are retried **only for GET** — replaying a write
  after an ambiguous failure could duplicate it.
- **OAuth:** access tokens are minted from the refresh token automatically, cached until ~60s
  before expiry, and re-minted once on a 401. Scope: `https://www.googleapis.com/auth/tasks`.
- **Due dates are date-only** — the API discards the time portion of `due` and cannot return
  one; keep times of day in `notes`.
- **Incremental sync:** poll `list_tasks` with `updated_min` = the newest `updated` seen, plus
  `show_deleted=true` and `show_hidden=true`; on a rejected (too old) `updated_min` do a full
  re-list.
- **Quota:** the Tasks API has a courtesy limit of 50,000 queries/day per project — poll
  incrementally instead of re-listing everything.

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GOOGLE_TASKS_CLIENT_ID` | yes* | — | OAuth2 client id (refresh flow). |
| `GOOGLE_TASKS_CLIENT_SECRET` | yes* | — | OAuth2 client secret (refresh flow). Secret. |
| `GOOGLE_TASKS_REFRESH_TOKEN` | yes* | — | OAuth2 refresh token (refresh flow). Secret. |
| `GOOGLE_TASKS_ACCESS_TOKEN` | yes* | — | Alternative: static access token (~1 h lifetime). Secret. |
| `GOOGLE_TASKS_API_BASE` | no | `https://tasks.googleapis.com` | API root override. |
| `GOOGLE_TASKS_TIMEOUT_MS` | no | `60000` | Per-request timeout, ms. |
| `GOOGLE_TASKS_MAX_RETRIES` | no | `3` | Retries on transient errors. |

\* Either the refresh triple together, or the static access token.
