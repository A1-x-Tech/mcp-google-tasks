# Development

## Requirements

- Node.js 20+ (the published package ships compiled `dist/`; `npx` needs no separate
  install). CI runs the suite on Node 20, 22 and 24.

## Commands

```bash
npm install
npm run dev        # run from source with tsx watch
npm test           # unit tests (node:test) + dist smoke, no network
npm run typecheck  # type-check src + tests (no emit)
npm run build      # clean dist/ and compile with tsc
npm run smoke      # live check (see below)
```

## Local run

```bash
npm run build
GOOGLE_TASKS_CLIENT_ID=... GOOGLE_TASKS_CLIENT_SECRET=... GOOGLE_TASKS_REFRESH_TOKEN=... \
  node dist/index.js
# or, for a quick session with a short-lived token:
GOOGLE_TASKS_ACCESS_TOKEN=$(gcloud auth print-access-token) node dist/index.js
# optional: GOOGLE_TASKS_API_BASE, GOOGLE_TASKS_TIMEOUT_MS, GOOGLE_TASKS_MAX_RETRIES
```

## Live smoke

`npm run smoke` is READ-ONLY by default: it lists the user's task lists and
prints only their **count** (titles are user content and never reach stdout).

`npm run smoke -- --write` (or `GOOGLE_TASKS_SMOKE_WRITE=1`) opts into the full
write lifecycle on a **disposable task list** created for the run: create list →
create task → complete → reopen → move → delete task. The throwaway list is deleted in
a `finally` block, so cleanup happens after success **and** after failure —
nothing the scenario creates survives it. The daily health workflow runs only
the read-only variant.

## Tests

Unit tests mock `globalThis.fetch` (client) or use a fake server + fake client (tools), so
the whole suite runs offline — including the OAuth refresh flow, whose token endpoint is
served by the same fetch stub. `test/dist-smoke.test.js` additionally spawns the built
`dist/index.js` and performs a real MCP handshake over stdio through the official SDK,
asserting the server identity, the instructions and the full tool list — both with a
static token and with no credentials at all (the degraded-start contract).
`capabilities-docs.test.ts` keeps `docs/capabilities/` in lockstep with the tool registry.
Put a `*.test.ts` next to the code it covers; `npm run typecheck && npm test` is the gate
(also run by `prepublishOnly`).

## Usage telemetry

The server sends anonymous events to `usage.gistrec.cloud` (`server_start` when a client
connects to a configured install, `unconfigured_start` when a client connects to a server
without credentials, `tool_call` with the tool **name**, and `startup_failed` with a
fixed-vocabulary reason code when the configuration is malformed) to count active installs
and tool demand. An event carries only impersonal technical fields: a random installation id
(`~/.config/mcp-google-tasks/instance-id`), the package version, the AI client's name and
version from the MCP handshake, the Node.js version and the OS.

OAuth credentials, task data, tool arguments and prompts are never sent or stored
(implementation: `src/telemetry.ts`). Sends run in the background with a 2 s timeout and are
silently skipped on any error. Opt out for all servers of this line at once:
`ASKADS_TELEMETRY=0`.
