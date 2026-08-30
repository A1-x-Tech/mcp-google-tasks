import type { GoogleTasksConfig } from "./types.js";
import { GoogleTasksError } from "./types.js";
import { CredentialsError } from "./config.js";

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/** Google's OAuth2 token endpoint — refresh tokens are exchanged here. */
const TOKEN_URL = "https://oauth2.googleapis.com/token";

/** The task-lists collection lives under the authenticated user, not a path parameter. */
const LISTS_PATH = "tasks/v1/users/@me/lists";

/** Normalized inputs for list_tasks. */
export interface ListTasksParams {
  taskListId: string;
  /** RFC3339 lower bound on the task's last modification time (updatedMin). */
  updatedMin?: string;
  /** RFC3339 bounds on the due date (dueMin/dueMax). */
  dueMin?: string;
  dueMax?: string;
  /** RFC3339 bounds on the completion date (completedMin/completedMax). */
  completedMin?: string;
  completedMax?: string;
  showCompleted?: boolean;
  showHidden?: boolean;
  showDeleted?: boolean;
  showAssigned?: boolean;
  pageSize?: number;
  pageToken?: string;
}

/** Normalized inputs for create_task. */
export interface CreateTaskParams {
  taskListId: string;
  title: string;
  notes?: string;
  /** Due date — YYYY-MM-DD or RFC3339 (the API keeps only the date part). */
  due?: string;
  /** Parent task id — makes the new task a subtask. */
  parent?: string;
  /** Sibling task id to insert after; omitted = first position. */
  previous?: string;
}

/** Normalized inputs for update_task. */
export interface UpdateTaskParams {
  taskListId: string;
  taskId: string;
  title?: string;
  notes?: string;
  due?: string;
  /** Explicit clears — PATCH needs a null, absence means "leave unchanged". */
  clearDue?: boolean;
  clearNotes?: boolean;
}

/** Normalized inputs for move_task. */
export interface MoveTaskParams {
  taskListId: string;
  taskId: string;
  /** New parent task id; omitted = top level. */
  parent?: string;
  /** Sibling task id to place the task after; omitted = first position. */
  previous?: string;
  /** Move the task to another task list. */
  destinationTasklist?: string;
}

/**
 * Normalizes a due date to the RFC3339 timestamp the API expects. A bare
 * YYYY-MM-DD becomes midnight UTC; a full timestamp passes through. The API
 * stores only the date part either way — the time of day is discarded.
 */
export function normalizeDueDate(due: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(due) ? `${due}T00:00:00.000Z` : due;
}

export class GoogleTasksClient {
  private readonly base: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;
  /** Cached access token from the refresh flow, with its expiry. */
  private cachedToken?: { value: string; expiresAt: number };
  /** In-flight refresh, deduping concurrent token requests. */
  private refreshInFlight?: Promise<string>;

  constructor(private readonly config: GoogleTasksConfig) {
    this.base = config.apiBase.endsWith("/") ? config.apiBase : config.apiBase + "/";
    this.timeoutMs = config.timeoutMs ?? 60_000;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryBaseMs = config.retryBaseMs ?? 500;
  }

  private canRefresh(): boolean {
    return Boolean(this.config.refreshToken && this.config.clientId && this.config.clientSecret);
  }

  /**
   * Returns a valid Bearer token. With the refresh triple configured, mints an
   * access token from the refresh token and caches it until shortly before it
   * expires (concurrent callers share one in-flight refresh); otherwise the
   * static GOOGLE_TASKS_ACCESS_TOKEN is used as-is. With neither configured,
   * throws {@link CredentialsError} BEFORE any fetch — a missing setup must
   * never enter the retry/backoff loop or trigger the 401 re-mint, because no
   * amount of retrying mints credentials.
   */
  private async accessToken(forceRefresh = false): Promise<string> {
    if (!this.canRefresh()) {
      if (!this.config.accessToken) throw new CredentialsError();
      return this.config.accessToken;
    }
    if (!forceRefresh && this.cachedToken && Date.now() < this.cachedToken.expiresAt) {
      return this.cachedToken.value;
    }
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.refreshAccessToken().finally(() => {
        this.refreshInFlight = undefined;
      });
    }
    return this.refreshInFlight;
  }

  /** Exchanges the refresh token for a fresh access token at Google's token endpoint. */
  private async refreshAccessToken(): Promise<string> {
    const body = new URLSearchParams({
      client_id: this.config.clientId as string,
      client_secret: this.config.clientSecret as string,
      refresh_token: this.config.refreshToken as string,
      grant_type: "refresh_token",
    }).toString();

    const { res, text } = await this.fetchWithTimeout(
      TOKEN_URL,
      { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body },
      "oauth2 token refresh",
    );

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    if (!res.ok) throw new GoogleTasksError(res.status, data);

    const token = (data as { access_token?: unknown }).access_token;
    if (typeof token !== "string" || !token) {
      throw new Error("OAuth2 token endpoint returned no access_token.");
    }
    const expiresIn = Number((data as { expires_in?: unknown }).expires_in);
    const ttl = Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600;
    // Refresh 60s ahead of the real expiry so requests never race a dying token.
    this.cachedToken = { value: token, expiresAt: Date.now() + Math.max(ttl - 60, 30) * 1000 };
    return token;
  }

  /** Verifies the OAuth credentials by minting a fresh access token (refresh flow only). */
  async authCheck(): Promise<unknown> {
    if (!this.canRefresh()) {
      throw new Error(
        "authCheck needs the refresh flow (GOOGLE_TASKS_CLIENT_ID / _CLIENT_SECRET / _REFRESH_TOKEN); with a static GOOGLE_TASKS_ACCESS_TOKEN list the task lists instead.",
      );
    }
    await this.accessToken(true);
    return { ok: true, auth: "refresh_token" };
  }

  /** Backoff before a retry: honors Retry-After when present, else exponential (capped at 30s). */
  private backoffMs(attempt: number, res?: Response): number {
    const retryAfter = res ? Number(res.headers.get("Retry-After")) : NaN;
    if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter, 30) * 1000;
    return Math.min(this.retryBaseMs * 2 ** attempt, 30_000);
  }

  /**
   * fetch with an AbortController timeout. Reads the response body inside the
   * guarded zone so the timeout also covers a slow or drip-feeding body, not
   * just the initial headers, and returns the text alongside the response.
   */
  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    label: string,
  ): Promise<{ res: Response; text: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      const text = await res.text();
      return { res, text };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`Request to "${label}" timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Low-level request to a Google Tasks API path (e.g. "tasks/v1/users/@me/lists").
   * Auth is a Bearer token (refreshed transparently; a 401 forces one re-mint +
   * retry). 429 is always retried with backoff; 5xx and network errors/timeouts
   * are retried only for GET — the Tasks API has real writes, and replaying a
   * write after an ambiguous failure could duplicate the task or repeat the
   * delete against a shifted target. Any other non-2xx throws a
   * {@link GoogleTasksError}.
   */
  async request<T = unknown>(
    method: HttpMethod,
    path: string,
    body?: Record<string, unknown>,
    query?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    // Guard method !== "GET" keeps undici from crashing on a GET-with-body.
    const hasBody = body !== undefined && method !== "GET";

    // Resolve the path against the API base, then reject anything that escaped
    // to a foreign origin (an absolute "https://evil/x" or a "\\evil/x" slipped
    // through raw_request) so the Bearer token can never leak to another host.
    const url = new URL(path.replace(/^\//, ""), this.base);
    if (url.origin !== new URL(this.base).origin) {
      throw new Error(`raw_request path must be a relative API path (resolved to foreign origin ${url.origin})`);
    }
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }
    const target = url.toString();

    // Writes must not be replayed on ambiguous failures (see the retry gate below).
    const idempotent = method === "GET";
    let refreshedOn401 = false;

    for (let attempt = 0; ; attempt++) {
      const token = await this.accessToken();
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (hasBody) headers["Content-Type"] = "application/json";

      let res: Response;
      let text: string;
      try {
        ({ res, text } = await this.fetchWithTimeout(
          target,
          { method, headers, body: hasBody ? JSON.stringify(body) : undefined },
          path,
        ));
      } catch (err) {
        // Network error or timeout: the request may or may not have reached the
        // API, so only reads are retried; writes rethrow immediately.
        if (idempotent && attempt < this.maxRetries) {
          await delay(this.backoffMs(attempt));
          continue;
        }
        throw err;
      }

      // An expired/revoked access token: re-mint once and replay. The request
      // never executed, so this is safe for writes too.
      if (res.status === 401 && this.canRefresh() && !refreshedOn401) {
        refreshedOn401 = true;
        await this.accessToken(true);
        continue;
      }

      // 429 means the request was rejected before executing — safe to retry for
      // any method. 5xx is ambiguous (the write may have committed), so it is
      // gated to idempotent requests.
      const transient = res.status === 429 || (idempotent && res.status >= 500 && res.status < 600);
      if (transient && attempt < this.maxRetries) {
        await delay(this.backoffMs(attempt, res));
        continue;
      }

      let data: unknown = undefined;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }

      if (!res.ok) throw new GoogleTasksError(res.status, data);
      return data as T;
    }
  }

  // ---- Task lists ----

  /** Lists the user's task lists (paginated; the API defaults to and caps a page at 1000). */
  async listTaskLists(p: { pageSize?: number; pageToken?: string } = {}): Promise<unknown> {
    return this.request("GET", LISTS_PATH, undefined, {
      maxResults: p.pageSize,
      pageToken: p.pageToken,
    });
  }

  /** One task list by id (or the "@default" alias). */
  async getTaskList(taskListId: string): Promise<unknown> {
    return this.request("GET", `${LISTS_PATH}/${encodeURIComponent(taskListId)}`);
  }

  /** Creates a task list. The API accepts only a title. */
  async createTaskList(title: string): Promise<unknown> {
    return this.request("POST", LISTS_PATH, { title });
  }

  /** Renames a task list (PATCH — the title is the only writable field). */
  async updateTaskList(taskListId: string, title: string): Promise<unknown> {
    return this.request("PATCH", `${LISTS_PATH}/${encodeURIComponent(taskListId)}`, { title });
  }

  /** Deletes a task list AND every task in it. The default list cannot be deleted. */
  async deleteTaskList(taskListId: string): Promise<unknown> {
    const data = await this.request("DELETE", `${LISTS_PATH}/${encodeURIComponent(taskListId)}`);
    // The API answers 204 with an empty body; return an explicit confirmation
    // (echoing the target) instead of null so the calling model knows exactly
    // which delete went through.
    return data ?? { deleted: true, tasklist_id: taskListId };
  }

  // ---- Tasks ----

  private tasksPath(taskListId: string, taskId?: string): string {
    const base = `tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks`;
    return taskId === undefined ? base : `${base}/${encodeURIComponent(taskId)}`;
  }

  /**
   * Lists tasks with the API's filters mapped from the normalized vocabulary
   * (updated_min → updatedMin, due_max → dueMax, page_size → maxResults, ...).
   * Booleans are forwarded only when set so the API defaults stay in charge.
   */
  async listTasks(p: ListTasksParams): Promise<unknown> {
    return this.request("GET", this.tasksPath(p.taskListId), undefined, {
      updatedMin: p.updatedMin,
      dueMin: p.dueMin,
      dueMax: p.dueMax,
      completedMin: p.completedMin,
      completedMax: p.completedMax,
      showCompleted: p.showCompleted,
      showHidden: p.showHidden,
      showDeleted: p.showDeleted,
      showAssigned: p.showAssigned,
      maxResults: p.pageSize,
      pageToken: p.pageToken,
    });
  }

  /** One task by id. */
  async getTask(taskListId: string, taskId: string): Promise<unknown> {
    return this.request("GET", this.tasksPath(taskListId, taskId));
  }

  /**
   * Creates a task. Position and hierarchy are query parameters, not body
   * fields: parent makes it a subtask, previous places it after a sibling
   * (both omitted = top of the list). The due date is normalized to RFC3339.
   */
  async createTask(p: CreateTaskParams): Promise<unknown> {
    return this.request(
      "POST",
      this.tasksPath(p.taskListId),
      compact({
        title: p.title,
        notes: p.notes,
        due: p.due === undefined ? undefined : normalizeDueDate(p.due),
      }),
      { parent: p.parent, previous: p.previous },
    );
  }

  /**
   * Patches title / notes / due. Only the provided fields change; clearDue and
   * clearNotes send an explicit null, which is how PATCH erases a field. The
   * parent and the position cannot be changed here — that is moveTask's job —
   * and the completion status is setTaskStatus's.
   */
  async updateTask(p: UpdateTaskParams): Promise<unknown> {
    const body = compact({
      title: p.title,
      notes: p.clearNotes ? null : p.notes,
      due: p.clearDue ? null : p.due === undefined ? undefined : normalizeDueDate(p.due),
    });
    if (Object.keys(body).length === 0) {
      throw new Error("At least one of title, notes, due, clear_due or clear_notes is required.");
    }
    return this.request("PATCH", this.tasksPath(p.taskListId, p.taskId), body);
  }

  /**
   * Moves a task: to another parent (or the top level), after another sibling
   * (or to the first position), and/or to another task list. Everything is a
   * query parameter — the move endpoint takes no body.
   */
  async moveTask(p: MoveTaskParams): Promise<unknown> {
    return this.request("POST", `${this.tasksPath(p.taskListId, p.taskId)}/move`, {}, {
      parent: p.parent,
      previous: p.previous,
      destinationTasklist: p.destinationTasklist,
    });
  }

  /** Deletes a task permanently (it stays visible to list_tasks show_deleted for a while, for sync). */
  async deleteTask(taskListId: string, taskId: string): Promise<unknown> {
    const data = await this.request("DELETE", this.tasksPath(taskListId, taskId));
    return data ?? { deleted: true, tasklist_id: taskListId, task_id: taskId };
  }

  /**
   * Flips the completion status. Completing sets status=completed (the API
   * stamps the completion time); reopening sets status=needsAction and
   * explicitly nulls the completed timestamp. Both directions are reversible —
   * this is the safe counterpart to deleteTask.
   */
  async setTaskStatus(taskListId: string, taskId: string, completed: boolean): Promise<unknown> {
    const body: Record<string, unknown> = completed
      ? { status: "completed" }
      : { status: "needsAction", completed: null };
    return this.request("PATCH", this.tasksPath(taskListId, taskId), body);
  }

  /**
   * Clears completed tasks from a list: they are flagged hidden and stop
   * showing up by default (list_tasks still finds them with show_hidden).
   */
  async clearCompletedTasks(taskListId: string): Promise<unknown> {
    const data = await this.request("POST", `tasks/v1/lists/${encodeURIComponent(taskListId)}/clear`, {});
    return data ?? { cleared: true, tasklist_id: taskListId };
  }
}

/** Drops keys whose value is `undefined` so they are not sent to the API (null survives — it clears). */
function compact<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
