import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

/**
 * Schema factories, not shared consts: reusing one zod object across two fields
 * makes zod-to-json-schema dedupe them into a `$ref`, which some tool-schema
 * consumers (OpenAI Apps review) don't dereference and flag as `any`. A fresh
 * object per field keeps each one inlined with its type + pattern.
 */
export const tasklistIdSchema = () =>
  z
    .string()
    .min(1)
    .describe(
      'The task list id — from list_tasklists or create_tasklist output. "@default" addresses the user\'s default list.',
    );

/** A task id — always paired with the list it lives in. */
export const taskIdSchema = () =>
  z.string().min(1).describe("The task id — from list_tasks, get_task or create_task output.");

/** An RFC3339 UTC timestamp, e.g. 2026-08-01T00:00:00Z — the shape the list filters accept. */
export const rfc3339Timestamp = () =>
  z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/,
      "Must be an RFC3339 timestamp, e.g. 2026-08-01T00:00:00Z",
    );

/**
 * A due date: a bare YYYY-MM-DD or a full RFC3339 timestamp. The API keeps only
 * the date part — the time of day is discarded on write and never returned.
 */
export const dueDateSchema = () =>
  z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2}))?$/,
      "Must be YYYY-MM-DD or an RFC3339 timestamp, e.g. 2026-09-01 or 2026-09-01T00:00:00Z",
    );

/** Wraps a value as a compact-JSON tool result (compact: the consumer is an LLM). */
export function ok(data: unknown): CallToolResult {
  const text = typeof data === "string" ? data : JSON.stringify(data);
  return { content: [{ type: "text", text: text ?? "null" }] };
}

export function fail(err: unknown): CallToolResult {
  let message = err instanceof Error ? err.message : String(err);
  // Surface the underlying cause (e.g. the network error behind a timeout) — no
  // secrets live in cause, and it makes failures far easier to diagnose.
  if (err instanceof Error && err.cause instanceof Error) message += ` (${err.cause.message})`;
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

/**
 * MCP tool annotations — hints the consuming client can use to gate or label a
 * tool. All four hints are set explicitly on every tool: some clients (OpenAI
 * Apps review) require readOnlyHint, destructiveHint and openWorldHint on each.
 *
 * The Tasks API mixes reads and writes, so each tool picks one of four presets:
 * READ_ONLY (pure reads), WRITE (creates new state; replaying duplicates it),
 * UPDATE (overwrites existing fields; replaying the same update converges) and
 * DESTRUCTIVE (removes existing state; replaying hits different targets).
 * Completion is deliberately UPDATE, not DESTRUCTIVE: completing a task is
 * reversible (reopen_task undoes it), while delete_task and delete_tasklist
 * are not.
 */
export const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export const WRITE = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
} as const;

export const UPDATE = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export const DESTRUCTIVE = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
} as const;
