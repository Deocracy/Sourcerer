// File-backed session persistence (D-09). Swaps Pi's SessionManager.inMemory()
// placeholder for the real, on-disk variant so chat history survives a sidecar
// restart. See 07-01-SUMMARY.md: spike 007 (session-persistence) was PARKED —
// there is no prior proven adapter code to port.
//
// Pi's own `SessionManager` class (imported below) is ALREADY the file-backed,
// append-only-JSONL implementation the D-09 acceptance criteria describe: it
// writes one JSON object per line, tolerates malformed lines on load
// (`loadEntriesFromFile` skips lines that fail JSON.parse), and exposes static
// `create`/`open`/`list` factories for exactly "create a new persisted
// conversation" / "reopen an existing one" / "list every conversation in a
// directory". Rather than hand-roll a parallel JSONL reader/writer (risking
// format drift from what `createAgentSession`'s `sessionManager:` option
// actually expects — see sdk.d.ts, `sessionManager?: SessionManager`, a
// concrete class, not a duck-typed interface), FileSessionManager is a thin
// factory that resolves an app-data directory and maps Sourcerer's own
// `sessionId` (carried on every stdio PromptRequest) onto that class's
// per-conversation files.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SessionManager, type SessionInfo } from "@earendil-works/pi-coding-agent";

/**
 * T-07-08 (path traversal): sessionId is used to select/create a JSONL file.
 * Reject anything containing path separators or traversal sequences before it
 * ever reaches a path.join — mirrors Pi's own `assertValidSessionId` pattern
 * but as a boolean predicate (no throw) so callers can validate up front.
 */
const SESSION_ID_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/;

export function isValidSessionId(id: unknown): id is string {
  return typeof id === "string" && SESSION_ID_PATTERN.test(id) && !id.includes("..");
}

/**
 * Resolve the app-data directory Sourcerer's sidecar persists conversations
 * under (Claude's-Discretion, 07-CONTEXT.md). `SOURCERER_SESSION_DIR` is an
 * explicit override for tests/dev so unit tests never touch a real user
 * profile directory.
 */
export function resolveSessionDir(): string {
  if (process.env.SOURCERER_SESSION_DIR) return process.env.SOURCERER_SESSION_DIR;

  const appName = "sourcerer";
  if (process.platform === "win32") {
    const base = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    return path.join(base, appName, "assistant-sessions");
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", appName, "assistant-sessions");
  }
  const base = process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share");
  return path.join(base, appName, "assistant-sessions");
}

/**
 * File-backed conversation manager (D-09). One `<...>_<sessionId>.jsonl` file
 * per conversation under `sessionDir`; directory is listed on boot
 * (`listSessions()`), and `open(sessionId)` transparently creates a new
 * persisted conversation or resumes an existing one, replaying its prior
 * turns via Pi's own tree-walking `buildSessionContext()`.
 */
export class FileSessionManager {
  readonly cwd: string;
  readonly sessionDir: string;

  constructor(cwd: string, sessionDir: string = resolveSessionDir()) {
    this.cwd = cwd;
    this.sessionDir = sessionDir;
    fs.mkdirSync(this.sessionDir, { recursive: true });
  }

  getSessionDir(): string {
    return this.sessionDir;
  }

  /** List every persisted conversation in this directory (D-09 boot listing). */
  async listSessions(): Promise<SessionInfo[]> {
    return SessionManager.list(this.cwd, this.sessionDir);
  }

  /** Convenience: just the ids, for the sidecar's `sessions` protocol event. */
  async listSessionIds(): Promise<string[]> {
    const infos = await this.listSessions();
    return infos.map((info) => info.id);
  }

  /**
   * Open the pi `SessionManager` backing `sessionId`, creating a new
   * persisted conversation file if none exists yet. Never rewrites an
   * existing file wholesale — appends only (Pi's own `_persist`/`appendFileSync`
   * path), so an abrupt kill mid-turn cannot corrupt prior turns.
   */
  async open(sessionId: string): Promise<SessionManager> {
    if (!isValidSessionId(sessionId)) {
      throw new Error(
        `Invalid sessionId (must match ${SESSION_ID_PATTERN.source}, no ".."): ${JSON.stringify(sessionId)}`,
      );
    }
    const infos = await this.listSessions();
    const existing = infos.find((info) => info.id === sessionId);
    if (existing) {
      return SessionManager.open(existing.path, this.sessionDir, this.cwd);
    }
    return SessionManager.create(this.cwd, this.sessionDir, { id: sessionId });
  }
}
