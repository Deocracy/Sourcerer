import { useEffect } from "react";
import { TitleBar } from "../shell/TitleBar";
import { Rail } from "../shell/Rail";
import { Dock } from "../shell/Dock";
import { ResetNotice } from "../shell/ResetNotice";
import { Home } from "../shell/Home";
import { AssistantPanel } from "../assistant/AssistantPanel";
import { AppletCatalog } from "../shell/AppletCatalog";
import { shellStore, useShellStore } from "../store/shellStore";
import { getDockApi } from "../shell/dockApi";
import styles from "./AppShell.module.css";

/**
 * AppShell — the card interior grid (40px title-row / 1fr body), per the
 * bespoke_rails_shell handoff.
 * Row 1: the full-width TitleBar — window controls sit at the card's top-right corner.
 * Row 2: the body — a flex row of [left rail | main workspace column | right-rail
 * AssistantPanel]. Rail (plan 02-04) sizes itself from the shell store; the
 * dock (plan 02-05) mounts into `.main`.
 *
 * Layout ownership: this file (Phase 02) owns WHERE things go inside the card.
 * AssistantPanel's internals are Phase 07's; it is mounted here into the
 * right-rail slot so the title bar can span the full card width above it.
 *
 * Phase 6 (HOME-01/D-04): `<Home />` mounts as an absolute overlay INSIDE
 * `.main` (a sibling of `<Dock />`, gated by the single `homeOpen` boolean)
 * so the title bar and rail stay visible above/beside it and dockview stays
 * mounted underneath. A best-effort empty-dock check summons Home the same
 * way — D-04 "empty-dock state AND summonable".
 */
export function AppShell() {
  const homeOpen = useShellStore((s) => s.homeOpen);

  useEffect(() => {
    let disposed = false;
    let disposable: { dispose(): void } | undefined;

    const checkEmpty = () => {
      const api = getDockApi();
      if (!api) return;
      if (api.panels.length === 0) shellStore.getState().setHomeOpen(true);
    };

    // Best-effort: dockApiRef is set synchronously by Dock.tsx's mount
    // effect (a descendant, committed before this one), but guard with a
    // short poll in case ordering ever changes — never throws if the api
    // stays null.
    const attach = () => {
      const api = getDockApi();
      if (!api) return false;
      checkEmpty();
      disposable = api.onDidLayoutChange(checkEmpty);
      return true;
    };

    if (!attach()) {
      const poll = setInterval(() => {
        if (disposed) return;
        if (attach()) clearInterval(poll);
      }, 50);
      return () => {
        disposed = true;
        clearInterval(poll);
        disposable?.dispose();
      };
    }

    return () => {
      disposed = true;
      disposable?.dispose();
    };
  }, []);

  return (
    <div className={styles.shell}>
      <TitleBar />
      <div className={styles.body}>
        <Rail />
        <div className={styles.main}>
          <Dock />
          <ResetNotice />
          {homeOpen && <Home />}
        </div>
        <AssistantPanel />
      </div>
      <AppletCatalog />
    </div>
  );
}
