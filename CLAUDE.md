# CLAUDE.md — mcp-google-tasks

MCP server for the Google Tasks API v1 (TypeScript, stdio). Mixed read/write:
tools cover task-list CRUD, task CRUD, subtask hierarchy and ordering, reversible
completion and destructive deletion; `raw_request` is the escape hatch. The
server talks to `https://tasks.googleapis.com` with a Bearer token; the token is
minted from an OAuth2 refresh token via `https://oauth2.googleapis.com/token`
(or a static `GOOGLE_TASKS_ACCESS_TOKEN`, mostly for testing). Due dates are
date-only — the API discards the time portion and cannot store a due time.

## Commands

```bash
npm run dev        # run from source (tsx watch)
npm test           # unit tests + dist smoke, no network
npm run typecheck  # types for src + tests
npm run build      # emit dist/
npm run smoke      # live READ-ONLY check (lists task lists, prints only the count)
npm run smoke -- --write  # opt-in disposable-list write scenario (always cleans up)
```

## Architecture

- `src/config.ts` — env → config. Credentials: either the refresh triple
  `GOOGLE_TASKS_CLIENT_ID` + `GOOGLE_TASKS_CLIENT_SECRET` + `GOOGLE_TASKS_REFRESH_TOKEN`
  (all three or `ConfigError` `incomplete_oauth_config`) or `GOOGLE_TASKS_ACCESS_TOKEN`;
  optional `GOOGLE_TASKS_API_BASE`, `GOOGLE_TASKS_TIMEOUT_MS`, `GOOGLE_TASKS_MAX_RETRIES`.
  No credentials at all is NOT an error: the fields stay `undefined` and the server starts
  degraded. Also home to `CredentialsError` / `MISSING_CREDENTIALS_MESSAGE` (opens with the
  historical startup error verbatim, then names the variables and the restart) and
  `hasCredentials()`.
- `src/client.ts` — all HTTP and all wire mapping. Token lifecycle (cache until ~60s before
  expiry, dedupe concurrent refreshes, one forced re-mint + replay on 401); `request()`
  resolves the path against the base and rejects foreign origins (SSRF guard), enforces an
  AbortController timeout that also covers reading the body, retries 429 always but 5xx/network
  errors **only for GET** — replaying a write after an ambiguous failure would duplicate it —
  and throws `GoogleTasksError(status, body)`. Typed per-endpoint methods own the wire shape:
  snake_case tool params → camelCase query params (`showCompleted`, `dueMin`, `maxResults`),
  `normalizeDueDate()` expands `YYYY-MM-DD`, `setTaskStatus()` maps complete/reopen to the wire
  status enum (`completed`/`needsAction` + the `completed: null` clear), and update_task's
  `clear_due`/`clear_notes` become explicit JSON `null`s in the PATCH.
- `src/tools/tasklists.ts` — `list_tasklists`, `get_tasklist`, `create_tasklist`,
  `update_tasklist`, `delete_tasklist`.
  `src/tools/tasks.ts` — `list_tasks`, `get_task`, `create_task`, `update_task`,
  `move_task`, `delete_task`.
  `src/tools/completion.ts` — `complete_task`, `reopen_task` (the reversible pair) and
  `clear_completed_tasks` (the bulk sweep) — the reversible/destructive split gets its own module.
  `src/tools/raw.ts` — `raw_request` (GET/POST/PATCH/PUT/DELETE). `src/tools/util.ts` —
  `ok`/`fail`, the four annotation presets (`READ_ONLY`/`WRITE`/`UPDATE`/`DESTRUCTIVE`) and
  shared zod schema factories (`tasklistIdSchema`, `taskIdSchema`, `rfc3339Timestamp`,
  `dueDateSchema`).
- `src/index.ts` — wires every `register*` into the McpServer. `loadConfigOrDegraded()`
  catches `ConfigError`, pings `startup_failed` (fire-and-forget) and degrades the config to
  "no credentials"; an unconfigured start prepends `UNCONFIGURED_PREFIX` — plus
  `Configuration problem: <message>` when a ConfigError was caught — to the initialize
  `instructions`, and `oninitialized` sends `server_start` for a configured install or
  `unconfigured_start` (with the reason) otherwise.
- `src/telemetry.ts` — anonymous usage pings (ids/names/versions only, never data or
  arguments; fire-and-forget, must never block or throw; opt-out `ASKADS_TELEMETRY=0`).
  `server_start` means "a usable install started"; `unconfigured_start` is a degraded start
  and `startup_failed` a malformed config caught at load — both carry a `reason` from a
  closed vocabulary (`missing_credentials`, `incomplete_oauth_config`) — never a variable's
  name or value.
- `src/smoke.ts` — live check. Default READ-ONLY (task-list count only — user content never
  reaches stdout); `--write`/`GOOGLE_TASKS_SMOKE_WRITE=1` opts into the disposable-list
  lifecycle (create list → task → complete → reopen → move → delete task) with the list deletion
  in `finally`, so cleanup runs after success and failure alike.

## Conventions (do not break)

- **Never exit because of configuration.** A server that dies before the MCP handshake leaves
  the user with a red cross and no reason — telemetry across this line of servers showed that
  state accounted for nearly every unconfigured install, and almost none of them recovered.
  Missing credentials are a survivable state: start, answer initialize (with the unconfigured
  prefix in `instructions`) and tools/list, and let the first tool call fail with
  `CredentialsError` — its message names the variables to set and says to restart, because
  credentials come only from the environment. `config.test.ts`, `client.test.ts` and
  `test/dist-smoke.test.js` pin this.
- **Credential failures are not transport failures.** `CredentialsError` is thrown in
  `accessToken()` before any fetch — before the retry/backoff loop, the token mint and the
  401 replay — because retrying it burns seconds of backoff before the user sees the one
  message that helps. Pinned by the "fetch never called" assertion in `client.test.ts`.
- **Never retry a write on 5xx/network errors.** Only 429 (rejected before executing) and GET
  are safe; the gate lives in `request()` and is pinned by tests. A replayed `create_task`
  duplicates the task; a replayed `delete_task`/`move_task` hits a changed world.
- **Completion is not deletion.** `complete_task`/`reopen_task` are the reversible pair
  (UPDATE preset, idempotent); `delete_task`, `delete_tasklist` and `clear_completed_tasks`
  are pinned DESTRUCTIVE. Never fold status changes into the delete tools or vice versa —
  `annotations.test.ts` pins the split.
- **No due-time tools, ever.** The API stores only the calendar date of `due`; don't fake a
  time-of-day feature. Times belong in `notes`.
- **Wire mapping lives in the client, not the tools.** Tools accept the normalized snake_case
  vocabulary and must not know the wire enums (`needsAction`/`completed`, camelCase query
  params, the `null`-clears in PATCH bodies) — add any mapping in `client.ts`.
- **Auth is the client's job.** Tools never see tokens; the Bearer header, refresh, caching
  and the 401 replay all live in `request()`/`accessToken()`.
- **Ordering goes through move_task** — `position` is read-only in the API; descriptions must
  keep steering the model to `move_task` (`previous`/`parent`) instead of patching `position`.
- **Validate inputs with zod** in `inputSchema`; reuse the shared schema **factories** in
  `util.ts` (a fresh schema per field avoids `$ref` dedup in the JSON schema).
- **Annotations are pinned per tool** in `annotations.test.ts` — changing one is a conscious
  decision that updates the map, with all four hints always set.
- **Output compact JSON via `ok`** — the consumer is an LLM; pretty-printing burns tokens.
  Responses pass through verbatim (describe the fields in the tool `description`, the only
  place the external model reads).
- **No user content in logs or telemetry.** Task titles/notes never reach stderr, stdout
  diagnostics or usage pings; the read-only smoke prints only counts.

## Adding a tool

Before changing the tool registry, read [the MCP capability documentation contract](docs/CAPABILITY-DOCUMENTATION.md). Every registered tool must have exactly one task-oriented page in `docs/capabilities/`; update that page, the index, and the coverage test in the same change.

1. Add (or extend) `src/tools/<name>.ts` with `register<Name>Tools(server, client)`.
2. If it hits a new endpoint, add a method to `src/client.ts` with the wire mapping.
3. Import and call the register fn in `src/index.ts`.
4. Add a `*.test.ts` using the mock-fetch (client) / fake-client (tools) harness — no
   network — and add the tool + hints to `annotations.test.ts` and `test/dist-smoke.test.js`.
5. `npm run typecheck && npm test`.

## Releasing

Keep the version in sync across **all** channels in one go (`git push --follow-tags` pushes
the tag but does **not** create a GitHub Release; the registry is immutable per version):

1. Bump `version` in **three places, identically**: `package.json`, and in `server.json`
   **both** the root `version` **and** `packages[0].version`. `mcpName` in `package.json` must
   match `name` in `server.json` (`io.github.A1-x-Tech/mcp-google-tasks`). Verify:
   `grep -n '"version"' package.json server.json`.
   > ⚠️ `mcp-publisher` publishes the **root** `server.json.version`. A stale root makes
   > `mcp-publisher publish` fail with a misleading `400 cannot publish duplicate version`
   > while `npm publish` succeeds.
2. Update `CHANGELOG.md`, then `npm publish` (runs typecheck + tests + build via
   `prepublishOnly` / `prepare`).
3. `git commit`, `git tag -a vX.Y.Z -m vX.Y.Z`, `git push origin main --follow-tags`.
4. **GitHub Release:** `gh release create vX.Y.Z --title vX.Y.Z --generate-notes --verify-tag`.
5. **Official MCP registry:** `mcp-publisher publish` (login with
   `mcp-publisher login github --token "$(gh auth token)"`).
