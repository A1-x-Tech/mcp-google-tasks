# mcp-google-tasks

<img src="assets/a1-logo.svg" alt="A1 x Tech" width="80" align="right" />

MCP server for the **Google Tasks API v1** (stdio, TypeScript). Manage task
lists and tasks — subtask hierarchy, due dates, notes, reversible completion,
ordering, pagination and incremental sync — from Claude, Cursor, Codex and any
other MCP client.

> Technical README for the handoff stage. The public README, marketing copy and
> publication are the next task.

## Install & run

```bash
npx -y mcp-google-tasks
```

MCP client config (stdio):

```json
{
  "mcpServers": {
    "google-tasks": {
      "command": "npx",
      "args": ["-y", "mcp-google-tasks"],
      "env": {
        "GOOGLE_TASKS_CLIENT_ID": "…",
        "GOOGLE_TASKS_CLIENT_SECRET": "…",
        "GOOGLE_TASKS_REFRESH_TOKEN": "…"
      }
    }
  }
}
```

Without credentials the server still starts and completes the MCP handshake
(degraded mode): the `initialize` instructions open with the fix and the first
tool call fails with an actionable error naming the variables to set.

## Auth

OAuth 2.0, scope `https://www.googleapis.com/auth/tasks` (the minimal scope that
covers the write tools; there is no API-key auth for Google Tasks).

- **Refresh flow (recommended):** `GOOGLE_TASKS_CLIENT_ID` +
  `GOOGLE_TASKS_CLIENT_SECRET` + `GOOGLE_TASKS_REFRESH_TOKEN` — access tokens
  are minted, cached and re-minted on 401 automatically.
- **Static token (testing):** `GOOGLE_TASKS_ACCESS_TOKEN`
  (e.g. `gcloud auth print-access-token`, ~1 h lifetime).

Optional: `GOOGLE_TASKS_API_BASE`, `GOOGLE_TASKS_TIMEOUT_MS` (default 60000),
`GOOGLE_TASKS_MAX_RETRIES` (default 3).

## Tools (15)

| Group | Tools |
|---|---|
| Task lists | `list_tasklists`, `get_tasklist`, `create_tasklist`, `update_tasklist`, `delete_tasklist` |
| Tasks | `list_tasks`, `get_task`, `create_task`, `update_task`, `move_task` |
| Completion (reversible) | `complete_task`, `reopen_task` |
| Deletion (destructive) | `delete_task`, `clear_completed_tasks` |
| Escape hatch | `raw_request` |

Every tool carries explicit MCP annotations (read-only / write / update /
destructive, all four hints set). Reversible completion is deliberately separate
from destructive deletion. See [docs/TOOLS.md](docs/TOOLS.md) for schemas and
the [capability catalog](docs/capabilities/index.md) for task-oriented pages.

## Known API limits (fixed for the next stage)

- **Due dates are date-only** — the API discards the time portion; a due time
  cannot be stored or read.
- **No recurrence** — repeating tasks cannot be created or edited via the API.
- **Assigned tasks** (from Google Docs / Chat spaces) cannot be created; they
  are hidden from `list_tasks` unless `show_assigned=true`.
- **`position` is read-only** — ordering changes only through `move_task`.
- **Pagination**: max 100 tasks per page (default 20); no server-side sort or
  text search.
- **Sync**: incremental via `updated_min` + `show_deleted` + `show_hidden`; a
  too-old `updated_min` is rejected — fall back to a full re-list.

## Engineering

- 429 retried with backoff for every method; 5xx/network retried **only for
  GET** — a write is never replayed after an ambiguous failure.
- Request timeout (AbortController) covers reading the body; SSRF guard pins
  every request to the API origin.
- Credentials, tokens and task content never appear in logs, errors or
  telemetry (anonymous usage pings; opt out with `ASKADS_TELEMETRY=0`).
- Offline test suite (unit + dist MCP-handshake smoke); opt-in live smoke on a
  disposable task list with guaranteed cleanup: `npm run smoke -- --write`.

## Development

```bash
npm install
npm run typecheck && npm test
```

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) and
[docs/PUBLISHING.md](docs/PUBLISHING.md). License: [MIT](LICENSE).
