/**
 * host/instanceState.ts — thin re-export wrapper over
 * src/persistence/workspaceStore.ts's instanceId-keyed instanceState
 * accessors, so host/ consumers (e.g. the dispose GC in a later plan) import
 * from one place under src/host/ rather than reaching into
 * src/persistence/workspaceStore.ts directly.
 *
 * NOT exposed as a sixth `host` member (FWK-04 stays five: storage, ai, open,
 * instanceId, theme) — this is a reserved additive seam, wired here only for
 * the dispose GC, finalized by its first real consumer (Phase 5 Notes).
 *
 * `scheduleWorkspaceSave` completes the seam (05-01-PLAN.md Task 1): every
 * existing setInstanceState/deleteInstanceState caller (Dock.tsx) pairs the
 * mutation with an immediate scheduleWorkspaceSave() call (mutate-then-persist
 * — see workspaceStore.ts's "callers must call scheduleWorkspaceSave() after
 * this to persist" contract); Notes is the first applet-side consumer of that
 * idiom, so it needs the flush authority re-exported here too.
 */
export {
  getInstanceState,
  setInstanceState,
  deleteInstanceState,
  listInstanceStateIds,
  scheduleWorkspaceSave,
} from "../persistence/workspaceStore";
