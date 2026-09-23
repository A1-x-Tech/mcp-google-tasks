# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and the project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-09-24

### Changed

- First stable release. The code is unchanged from 0.2.0; the version now states
  what was already true of it — the tool surface, tool argument shapes,
  environment variable names and response envelopes are settled, and breaking any
  of them from here on requires a major bump.

## [0.2.0] - 2026-09-20

### Added

- In-chat Google login via `@a1-x-tech/mcp-google-auth` — 6 new onboarding
  tools: `auth_status`, `setup_instructions`, `set_client`, `start_login`
  (deliberately not read-only), `finish_login`, `logout`. The flow is loopback
  `127.0.0.1` + PKCE against a user-owned Desktop OAuth client; the code is
  exchanged locally and the client secret never passes through the chat. Each
  tool has a capability page under `docs/capabilities/`.
- Tokens from a login are stored per server in
  `~/.config/mcp-google-tasks/credentials.json` (0600) and re-read on every
  call, so a login finished mid-session works without restarting the AI client.
  `GOOGLE_TASKS_OAUTH_PORT` pins the loopback listener port for SSH forwarding.
- `finish_login` verifies a fresh login against **Google Tasks API** itself rather than
  Google's identity endpoint: OIDC answers even when the API is switched off in
  the Cloud project, which would make a broken setup look connected. A 403 that
  says the API is disabled is translated into the actual fix — enable it in the
  same project as the OAuth client.

### Changed

- The client accepts the component's `TokenProvider` as a fallback token
  source: environment credentials (the refresh triple or `GOOGLE_TASKS_ACCESS_TOKEN`)
  keep absolute priority and behave exactly as before; the stored in-chat login
  is used only when the environment carries no credentials. The single 401
  re-mint + replay works for provider-backed tokens too, and is skipped when
  nothing can be re-minted.
- The unconfigured `initialize` instructions lead with the in-chat login
  (`setup_instructions` → `set_client` → `start_login` → `finish_login`, no
  restart needed); setting the environment variables + restart remains the
  documented alternative.

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

[1.0.0]: https://github.com/A1-x-Tech/mcp-google-tasks/releases/tag/v1.0.0
[0.2.0]: https://github.com/A1-x-Tech/mcp-google-tasks/releases/tag/v0.2.0
[0.1.0]: https://github.com/A1-x-Tech/mcp-google-tasks/releases/tag/v0.1.0
