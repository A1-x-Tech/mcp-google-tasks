# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and the project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0] — 2026-08-30

### Added
- First release: a full MCP server for the Google Tasks API v1 (stdio,
  TypeScript, `@modelcontextprotocol/sdk` + `zod`).
- Tools (15):
  - `list_tasklists`, `get_tasklist`, `create_tasklist`, `update_tasklist`,
    `delete_tasklist` — task-list listing and management (`"@default"` addresses
    the default list; deleting a list deletes all of its tasks);
  - `list_tasks` — visibility filters (`show_completed` / `show_hidden` /
    `show_deleted` / `show_assigned`), due/completed date bounds, pagination and
    the `updated_min` incremental-sync filter;
  - `get_task`, `create_task` (notes, date-only due dates, `parent`/`previous`
    positioning), `update_task` (PATCH semantics with explicit `clear_due` /
    `clear_notes`);
  - `complete_task` / `reopen_task` — reversible completion, deliberately
    separate from destructive deletion;
  - `move_task` — reorder (`previous`), re-nest (`parent`, subtask hierarchy)
    and move between lists (`destination_tasklist`);
  - `delete_task`, `clear_completed_tasks` — permanent deletion and the bulk
    completed-tasks sweep, both pinned DESTRUCTIVE;
  - `raw_request` — escape hatch to any Tasks API v1 path (SSRF-guarded,
    GET/POST/PATCH/PUT/DELETE).
- Degraded start: without credentials the server still completes the MCP
  handshake, serves the tool list and opens the `initialize` instructions with
  the fix; the first tool call fails with an actionable `CredentialsError`.
- OAuth2 refresh flow: access tokens are minted from
  `GOOGLE_TASKS_CLIENT_ID`/`_CLIENT_SECRET`/`_REFRESH_TOKEN`, cached until just
  before expiry, deduped across concurrent requests and re-minted once on a 401;
  a static `GOOGLE_TASKS_ACCESS_TOKEN` works as an alternative.
- Resilience: request timeout covering body reads, `Retry-After`-aware backoff,
  429 retried for every method, 5xx/network retries gated to reads so writes are
  never replayed.
- Anonymous usage telemetry (event/tool names and versions only; opt out with
  `ASKADS_TELEMETRY=0`), including the `startup_failed` / `unconfigured_start`
  drop-off pings.
- Offline test suite: mocked-fetch client tests incl. the OAuth flow,
  fake-server tool tests, pinned per-tool annotations, capability-docs coverage
  tests, plus a dist smoke test that spawns the built binary and performs a real
  MCP handshake over stdio.
- Opt-in live smoke: `npm run smoke` is read-only; `npm run smoke -- --write`
  runs the whole lifecycle on a disposable task list and always deletes it again
  (cleanup after success and failure).
- CI (Node 20/22/24: typecheck + build + tests) and a daily live health check
  that skips itself when repo secrets are absent.

[0.1.0]: https://github.com/A1-x-Tech/mcp-google-tasks/releases/tag/v0.1.0
