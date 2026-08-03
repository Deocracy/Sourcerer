#!/usr/bin/env bash
# Spike 010 driver — every guest interaction goes through wsl.exe exactly as the
# Sourcerer shell would drive it. Logs to run.log with per-step timestamps.
set -uo pipefail
cd "$(dirname "$0")"
LOG="run.log"
DISTRO="SourcererSpike"
STORE='D:\WSL\SourcererSpike'
IMG="$(cygpath -w "$(pwd)/dist/nixos.wsl")"
export WSL_UTF8=1

step() { echo "" | tee -a "$LOG"; echo "=== [$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }
run()  { echo "\$ $*" | tee -a "$LOG"; "$@" 2>&1 | tee -a "$LOG"; return "${PIPESTATUS[0]}"; }

echo "SPIKE 010 RUN — $(date -Iseconds)" | tee "$LOG"

step "0. preexisting state"
run wsl.exe -l -v

step "1. IMPORT (timed)"
T0=$SECONDS
run wsl.exe --import "$DISTRO" "$STORE" "$IMG" --version 2
echo "import_seconds=$((SECONDS-T0))" | tee -a "$LOG"

step "2. FIRST BOOT (timed)"
T0=$SECONDS
run wsl.exe -d "$DISTRO" -- echo boot-ok
echo "first_boot_seconds=$((SECONDS-T0))" | tee -a "$LOG"

step "3. IDENTITY + default config (logged for the trail)"
run wsl.exe -d "$DISTRO" -- sh -c 'head -2 /etc/os-release; echo "user=$(whoami)"'
run wsl.exe -d "$DISTRO" -u root -- cat /etc/nixos/configuration.nix

step "4. BASELINE: hello must be absent"
run wsl.exe -d "$DISTRO" -- sh -c 'command -v hello || echo HELLO_ABSENT'

step "5. CONFIG CHANGE: add pkgs.hello (sed-insert before final brace)"
run wsl.exe -d "$DISTRO" -u root -- sh -c \
  "sed -i 's|^}\$|  environment.systemPackages = [ pkgs.hello ];\n}|' /etc/nixos/configuration.nix && tail -5 /etc/nixos/configuration.nix"

step "6. nixos-rebuild switch (timed, driven externally)"
T0=$SECONDS
run wsl.exe -d "$DISTRO" -u root -- nixos-rebuild switch
REBUILD_RC=$?
echo "rebuild_seconds=$((SECONDS-T0)) rc=$REBUILD_RC" | tee -a "$LOG"

step "7. VERIFY: hello present"
run wsl.exe -d "$DISTRO" -- hello

step "8. GENERATIONS (the rollback list a UI would show)"
run wsl.exe -d "$DISTRO" -u root -- nix-env --list-generations -p /nix/var/nix/profiles/system

step "9. ROLLBACK (timed — the 'Revert last update' button)"
T0=$SECONDS
run wsl.exe -d "$DISTRO" -u root -- nixos-rebuild switch --rollback
echo "rollback_seconds=$((SECONDS-T0))" | tee -a "$LOG"

step "10. VERIFY: hello absent again"
run wsl.exe -d "$DISTRO" -- sh -c 'command -v hello || echo HELLO_ABSENT_AGAIN'

step "11. TERMINATE + AUTO-RESTART (kill-switch / on-demand model, timed)"
run wsl.exe --terminate "$DISTRO"
T0=$SECONDS
run wsl.exe -d "$DISTRO" -- echo restarted-ok
echo "restart_seconds=$((SECONDS-T0))" | tee -a "$LOG"

step "12. FOOTPRINT"
run ls -la "$(cygpath -u "$STORE")"

step "DONE — distro left registered for follow-up legs; cleanup: wsl --unregister $DISTRO"
