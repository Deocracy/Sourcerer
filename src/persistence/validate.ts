/*
 * validate — structural guards for untrusted persisted workspace data.
 *
 * T-03-01 (ASVS V5): untrusted persisted JSON can never crash the shell.
 * Key-presence checks are not enough — a record like
 * `{ schemaVersion: 1, rail: {}, ... }` passes a shallow check, skips
 * migration, and then crashes the shell when Rail's render path calls
 * `railOrder.filter(...)` on undefined (CR-05). These guards verify the
 * non-opaque slices structurally before the record is trusted.
 *
 * Shared by workspaceStore.ts (post-migration record acceptance, CR-05) and
 * layouts.ts (savedLayouts entry guard before apply, WR-05). Lives in its
 * own module so component/service tests that vi.mock workspaceStore still
 * exercise the real checks.
 */
import type { WorkspaceRecordV1 } from "./workspaceStore";

/** Non-null, non-array object — the only shape Object.values()/spread
 *  consumers (LayoutsMenu, layouts.ts) can safely treat as a record map. */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Structural check for the rail slice — the one non-opaque slice the shell
 *  consumes unguarded (shellStore hydration → Rail render). */
export function isValidRail(value: unknown): value is WorkspaceRecordV1["rail"] {
  if (!isPlainObject(value)) return false;
  const v = value;
  return (
    (v.railMode === "expanded" || v.railMode === "compact" || v.railMode === "hidden") &&
    typeof v.railWidth === "number" &&
    Number.isFinite(v.railWidth) &&
    Array.isArray(v.railOrder) &&
    v.railOrder.every((k) => typeof k === "string") &&
    Array.isArray(v.leftRailPinned) &&
    v.leftRailPinned.every((k) => typeof k === "string")
  );
}

/** Post-migration structural acceptance for a full WorkspaceRecordV1 (CR-05).
 *  dockTree stays deliberately opaque (Dock's fromJSON path is try/caught);
 *  everything the shell consumes unguarded must be shape-checked here.
 *  schemaVersion is the caller's concern (checked pre-migration). */
export function isValidRecordV1(value: unknown): value is WorkspaceRecordV1 {
  if (!isPlainObject(value)) return false;
  const v = value;
  return (
    isValidRail(v.rail) &&
    isPlainObject(v.savedLayouts) &&
    isPlainObject(v.instanceState) &&
    (v.restoreCanary === undefined || typeof v.restoreCanary === "boolean")
  );
}
