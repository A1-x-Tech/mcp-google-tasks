# Google Tasks: Raw Google Tasks API call — MCP tool

**Google Tasks MCP tool:** Escape hatch to any Google Tasks API v1 path the typed tools don't cover.

Technical name: `raw_request`

## What task it solves

> I want to call a Tasks API endpoint directly.

Sends an authenticated request to any Google Tasks API v1 path — e.g. a full-replace update via `PUT tasks/v1/lists/<tasklistId>/tasks/<taskId>`, or a PATCH touching fields the typed tools leave alone.

## What to provide

- `path` — **required**. API path relative to https://tasks.googleapis.com, e.g. `"tasks/v1/users/@me/lists"`. May carry a query string.
- `method` — **optional**. GET, POST, PATCH, PUT or DELETE. Defaults to GET.
- `body` — **optional**. JSON request body — sent for POST/PATCH/PUT/DELETE, ignored for GET.

## When to use it

Only when no typed tool covers the request — the typed tools carry the guardrails and the normalized vocabulary. Wire field names apply here (camelCase params like `showCompleted`, status values `needsAction`/`completed`).

## What it returns

The upstream API's JSON response verbatim, or a clear MCP tool error.

## What changes in Google Tasks

Whatever the chosen endpoint does — including permanent deletes and bulk clears. The tool is annotated for the worst case a call can perform; review the path and method before invoking it.

## Example request

> Call the Tasks API directly: PUT tasks/v1/lists/@default/tasks/<taskId> with this full task body.

## Errors and limitations

A path resolving to a foreign origin is rejected before any network call (SSRF guard), so the Bearer token never leaves tasks.googleapis.com. Writes are never auto-retried after a 5xx or timeout. Google API errors are surfaced with their HTTP status and message.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

Every typed tool in this catalog covers a specific endpoint — prefer them when one fits.

## Technical details

- **Impact:** destructive operation
- **Group:** Additional API methods
- **Description source:** `raw_request` registration in `src/tools/raw.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
