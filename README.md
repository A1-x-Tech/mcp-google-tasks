# <img src="./assets/a1-logo.svg" alt="A1" width="40"> Google Tasks MCP

**English** | [Русский](./README.ru.md)

[![npm](https://img.shields.io/npm/v/mcp-google-tasks)](https://www.npmjs.com/package/mcp-google-tasks)
[![CI](https://github.com/A1-x-Tech/mcp-google-tasks/actions/workflows/ci.yml/badge.svg)](https://github.com/A1-x-Tech/mcp-google-tasks/actions/workflows/ci.yml)
[![Glama](https://glama.ai/mcp/servers/A1-x-Tech/mcp-google-tasks/badges/score.svg)](https://glama.ai/mcp/servers/A1-x-Tech/mcp-google-tasks)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

**A1 Google Tasks MCP** lets an AI app manage Google Tasks in plain language. Plan a project as a task list, break work into subtasks with due dates and notes, mark things done and keep everything in order.

It uses the Google Tasks API with your Google account. It separates reversible completion from permanent deletion and makes the limits of the Tasks API explicit instead of implying that every to-do feature is possible.

- **15 tools.** List, create and update task lists and tasks, move tasks, manage completion, sweep finished work and reach the raw API when a dedicated tool is missing.
- **Completion is reversible, deletion is not.** `complete_task` has an undo (`reopen_task`); the delete tools are separate and marked destructive.
- **Due dates are honest.** The API stores only the calendar date — the server never pretends to schedule a time of day; times belong in the notes.
- **Minimal Google scope.** A single `tasks` scope, without Drive, Calendar or Gmail access.

Start with a read-only question:

> Show me my task lists and everything due before Friday in my default list.

[Connect the server](#quick-start) · [Explore use cases](#what-you-can-ask-it-to-do) · [Open technical documentation](#technical-documentation)

---

## See it work in a minute

> **You:** What's still open in the "Website launch" list, and what's due this week?
>
> **Assistant:** Shows the open tasks with their due dates, notes and subtasks. Nothing changes.
>
> **You:** Add a task "Send the launch announcement" due Friday as a subtask of "Marketing".
>
> **Assistant:** Shows the target list, the parent task and the proposed task, then asks for confirmation before creating it.
>
> **You:** Confirm.
>
> **Assistant:** Creates the subtask with a Friday due date. It does not complete or delete anything unless you ask separately.

## Contents

- [Quick start](#quick-start)
- [What you can ask it to do](#what-you-can-ask-it-to-do)
- [How a task changes](#how-a-task-changes)
- [What can change](#what-can-change)
- [Getting access](#getting-access)
- [Configuration](#configuration)
- [Data, limits and background work](#data-limits-and-background-work)
- [Technical documentation](#technical-documentation)
- [Support](#support)

## Quick start

You need Node.js 20+, a Google account and OAuth credentials from a Google Cloud project with the Google Tasks API enabled.

1. [Prepare Google OAuth access](#getting-access).
2. Add the server to your AI app.
3. Ask the read-only question above.

<details open>
<summary><strong>Codex</strong></summary>

<br>

**In the app:** open **Settings → Plugins → MCP servers**, select **Add server**, then add `npx -y mcp-google-tasks@latest` with `GOOGLE_TASKS_CLIENT_ID`, `GOOGLE_TASKS_CLIENT_SECRET` and `GOOGLE_TASKS_REFRESH_TOKEN`.

**From the command line:**

```bash
codex mcp add google-tasks \
  --env GOOGLE_TASKS_CLIENT_ID=your_client_id \
  --env GOOGLE_TASKS_CLIENT_SECRET=your_client_secret \
  --env GOOGLE_TASKS_REFRESH_TOKEN=your_refresh_token \
  -- npx -y mcp-google-tasks@latest
```

```bash
codex mcp list
```

[Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

</details>

<details>
<summary><strong>Claude Code</strong></summary>

<br>

```bash
claude mcp add \
  --env GOOGLE_TASKS_CLIENT_ID=your_client_id \
  --env GOOGLE_TASKS_CLIENT_SECRET=your_client_secret \
  --env GOOGLE_TASKS_REFRESH_TOKEN=your_refresh_token \
  --transport stdio --scope user google-tasks \
  -- npx -y mcp-google-tasks@latest
```

```bash
claude mcp list
```

[Claude Code MCP documentation](https://code.claude.com/docs/en/mcp)

</details>

<details>
<summary><strong>Claude Desktop</strong></summary>

<br>

Open **Settings → Developer → Edit Config** and add:

```json
{
  "mcpServers": {
    "google-tasks": {
      "command": "npx",
      "args": ["-y", "mcp-google-tasks@latest"],
      "env": {
        "GOOGLE_TASKS_CLIENT_ID": "your_client_id",
        "GOOGLE_TASKS_CLIENT_SECRET": "your_client_secret",
        "GOOGLE_TASKS_REFRESH_TOKEN": "your_refresh_token"
      }
    }
  }
}
```

If **Edit Config** is unavailable, edit `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS or `%APPDATA%\Claude\claude_desktop_config.json` on Windows.

[Claude Desktop MCP documentation](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop)

</details>

<details>
<summary><strong>Cursor</strong></summary>

<br>

Add this to `~/.cursor/mcp.json` on macOS/Linux or `%USERPROFILE%\.cursor\mcp.json` on Windows:

```json
{
  "mcpServers": {
    "google-tasks": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mcp-google-tasks@latest"],
      "env": {
        "GOOGLE_TASKS_CLIENT_ID": "your_client_id",
        "GOOGLE_TASKS_CLIENT_SECRET": "your_client_secret",
        "GOOGLE_TASKS_REFRESH_TOKEN": "your_refresh_token"
      }
    }
  }
}
```

[Cursor MCP documentation](https://cursor.com/docs/mcp)

</details>

<details>
<summary><strong>VS Code</strong></summary>

<br>

Run **MCP: Open User Configuration** and add:

```json
{
  "servers": {
    "google-tasks": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mcp-google-tasks@latest"],
      "env": {
        "GOOGLE_TASKS_CLIENT_ID": "${input:tasks_client_id}",
        "GOOGLE_TASKS_CLIENT_SECRET": "${input:tasks_client_secret}",
        "GOOGLE_TASKS_REFRESH_TOKEN": "${input:tasks_refresh_token}"
      }
    }
  },
  "inputs": [
    { "type": "promptString", "id": "tasks_client_id", "description": "Google OAuth client ID" },
    { "type": "promptString", "id": "tasks_client_secret", "description": "Google OAuth client secret", "password": true },
    { "type": "promptString", "id": "tasks_refresh_token", "description": "Google OAuth refresh token", "password": true }
  ]
}
```

Check it with **MCP: List Servers**.

[VS Code MCP documentation](https://code.visualstudio.com/docs/agent-customization/mcp-servers)

</details>

## What you can ask it to do

### See your lists and plan the day

- Show my task lists and the open tasks in each one.
- What's due this week in the default list? Include subtasks.
- What changed since yesterday? Include completed and hidden tasks.

### Create and organize work

- Create a "Website launch" list with tasks for design, content and QA.
- Add a task due Friday with notes, nested under the "Marketing" task.
- Move a task to the top of the list, under another task, or into a different list.

### Track completion

- Mark the review task done — and reopen it if the work comes back.
- Sweep every completed task out of the list view in one go.
- Show the hidden tasks that were swept earlier.

## How a task changes

1. Tasks live in **task lists**. Every account has a built-in default list, addressed by the special id `@default`; `create_tasklist` adds more.
2. A task carries a title, notes and a **date-only** due date — the API discards the time portion, so a time of day belongs in the notes.
3. Ordering and nesting change only through `move_task`; the API's `position` field is read-only.
4. Completing a task is reversible: `reopen_task` brings it back. Deleting a task or a list is permanent, and deleting a list removes every task in it.

Recurring tasks cannot be created through the API. Tasks assigned from Google Docs or Chat can be read but not created or moved to another list, and deleting one also removes it in the originating document. There is no server-side search or sorting — the server lists tasks and the AI client filters them.

## What can change

| Operation | What happens | Confirmation boundary |
|---|---|---|
| Read task lists and tasks | Reads lists, tasks and their filters | No change |
| Create a task list or a task | Adds a list or an open task | Changes Google Tasks |
| Update a task or rename a list | Changes a title, notes or due date | Changes a task |
| Move a task | Changes order, nesting or the containing list | Changes a task |
| Complete or reopen a task | Toggles completion status | Reversible change |
| Clear completed tasks | Sweeps every completed task in a list out of view | Destructive |
| Delete a task or a task list | Removes the task, or the list with everything in it | Destructive |
| Raw API request | Can call API methods without a dedicated tool | Potentially destructive |

The AI client controls confirmation prompts. The server marks reads, writes and destructive tools so the client can distinguish an inspection from a live change.

## Getting access

Google Tasks requires OAuth 2.0; an API key is not enough.

1. Create or select a Google Cloud project and enable **Google Tasks API**.
2. Configure the OAuth consent screen and create a **Desktop app** OAuth client.
3. Authorize the Google account that owns the tasks. The [OAuth 2.0 Playground](https://developers.google.com/oauthplayground) can obtain the refresh token when **Use your own OAuth credentials** is enabled.
4. Request the scope:

   ```text
   https://www.googleapis.com/auth/tasks
   ```

Testing-mode OAuth refresh tokens can expire after seven days. Publish the OAuth app, or use an Internal app in a Workspace domain, when you need long-lived access. Treat the client secret and refresh token as passwords.

## Configuration

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_TASKS_CLIENT_ID` | Yes* | OAuth client ID. |
| `GOOGLE_TASKS_CLIENT_SECRET` | Yes* | OAuth client secret. |
| `GOOGLE_TASKS_REFRESH_TOKEN` | Yes* | OAuth refresh token. |
| `GOOGLE_TASKS_ACCESS_TOKEN` | Yes* | Short-lived alternative to the OAuth trio. |
| `GOOGLE_TASKS_API_BASE` | No | Google Tasks API base URL override. |
| `GOOGLE_TASKS_TIMEOUT_MS` | No | Per-request timeout; default `60000` ms. |
| `GOOGLE_TASKS_MAX_RETRIES` | No | Temporary-error retries; default `3`. |

\* Provide either the OAuth trio or an access token.

Without credentials the server still starts and completes the MCP handshake; the first tool call then fails with a message naming the variables to set and asking for a restart.

## Data, limits and background work

- **Requests go to Google Tasks.** The local server refreshes Google OAuth tokens and calls the Tasks API. Its anonymous telemetry contains an installation ID, package version, AI client and platform versions, and tool names — never OAuth tokens, task content, tool arguments or prompts. Set `ASKADS_TELEMETRY=0` to opt out.
- **Google applies a daily quota.** The Tasks API has a courtesy limit of 50,000 queries per day per project. On `429`, the server uses backoff; reads also retry after network and `5xx` errors, while writes are not replayed after an uncertain failure — check the outcome with `get_task` instead.
- **There is no background polling.** The server runs only when called. `list_tasks` supports incremental sync through the `updated_min` filter, so an AI app with scheduled tasks can check for changes periodically without re-reading everything.

## Technical documentation

- [MCP capability catalog](./docs/capabilities/index.md) — task-oriented pages for every tool.
- [All tools and inputs](./docs/TOOLS.md)
- [Development documentation](./docs/DEVELOPMENT.md)
- [Publishing documentation](./docs/PUBLISHING.md)
- [Google Tasks API reference](https://developers.google.com/tasks)

## Support

Found a bug or need a scenario? [Create an issue](https://github.com/A1-x-Tech/mcp-google-tasks/issues) or write in [Telegram](https://t.me/a1_mcp).

<br>

<p align="center">
  <img src="https://github.com/ztemerbekov/a1-yandex-kit-skills/raw/main/assets/images/mona-hifive-yandex-kit-warm.gif" alt="Две Моны дают пять" width="256">
</p>

<p align="center">
  You made it to the end!
</p>
