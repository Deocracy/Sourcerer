// The supervisor's handshake variables (TheiaService.sys.mjs's
// _spawnAndGate environment object) are for THIS process only. Node's
// process.env is inherited by every child the backend ever spawns -- a
// terminal (@theia/terminal's ShellProcess -> EnvironmentUtils.mergeProcessEnv,
// which reads process.env LIVE at terminal-creation time), a task, a debug
// adapter, the plugin host that runs every installed VS Code extension, and
// the parcel filesystem-watcher fork. So:
//
//   - SOURCERER_TOKEN is the backend's auth credential. Inherited, anything
//     the user runs in an IDE terminal -- an npm postinstall script, a
//     third-party open-vsx extension -- can read it from its own environment
//     and drive a backend with arbitrary file access and terminal spawn.
//   - SOURCERER_SUPERVISED arms the parent-death watchdog. Inherited, a
//     NESTED backend started from a Sourcerer terminal (`yarn start`,
//     scripts/smoke-theia.sh, scripts/verify-phase-04.sh) arms it too and
//     self-terminates the instant its own stdin EOFs -- the exact three
//     unsupervised callers parent-watchdog-backend-contribution.ts's gate
//     exists to protect, killed by an unexplained death.
//   - SOURCERER_TOKEN_DISABLE is the gate's named dev bypass. It has never
//     leaked, because the supervisor sets it to "" and normalizeEnv drops
//     empty values -- which is precisely why this whole class of bug stayed
//     invisible. It is scrubbed here for the same reason as the others: the
//     dev scripts set it to a non-empty "1".
//
// Capture-and-delete runs at MODULE LOAD, not in a contribution's
// initialize(), and that placement is load-bearing rather than stylistic.
// @theia/core's EnvVariablesServerImpl takes a HARD SNAPSHOT of the whole
// process.env in its CONSTRUCTOR (core/lib/node/env-variables/env-variables-server.js:36)
// and serves it to the frontend over JSON-RPC (/services/envs) and to
// ${env:...} resolution in tasks and launch configs. That constructor runs
// during CliManager.initializeCli -- before container.get(BackendApplication),
// i.e. before any BackendApplicationContribution.initialize() body executes --
// so a delete in initialize() would leave the token in that copy. Contribution
// initialize() calls also run under Promise.all with no guaranteed ordering,
// and the filesystem-watcher fork (filesystem/lib/node/filesystem-backend-module.js:118,
// `env: process.env`) fires DURING that same phase, ~3ms after this
// extension's own initialize(). Module load is the earliest point that beats
// all three: src-gen/backend/server.js requires and load()s every container
// module, this one included, before it constructs anything at all.
//
// Two in-tree precedents for exactly this shape: server.js's own
// `delete process.env.ELECTRON_RUN_AS_NODE`, and @theia/core's createIpcEnv
// (core/lib/node/messaging/ipc-protocol.js), which sweeps every THEIA_*
// key out of a forked child's environment.
//
// Residual, stated honestly: `delete process.env.X` does not rewrite
// /proc/<pid>/environ, so a same-uid process that goes looking can still
// recover the token from the backend's own procfs entry. This closes casual
// and accidental exposure (children, `env` dumps, ${env:} resolution), not a
// same-uid attacker. Closing that would mean not carrying the token in the
// environment at all -- handing it over the stdin pipe the watchdog already
// holds open -- which is a larger change.
const captured: { [key: string]: string | undefined } = {};
for (const key of Object.keys(process.env)) {
    if (key.startsWith('SOURCERER_')) {
        captured[key] = process.env[key];
        delete process.env[key];
    }
}

/**
 * The SOURCERER_* variables as the supervisor supplied them, captured before
 * they were scrubbed from `process.env`. Every reader in this extension must
 * use this instead of `process.env` -- reading `process.env` directly would
 * find nothing, and re-introducing the variable would re-open the leak.
 */
export const SOURCERER_ENV: Readonly<{ [key: string]: string | undefined }> = captured;
