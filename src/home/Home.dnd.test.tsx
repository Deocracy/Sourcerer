import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";

import { Home } from "../shell/Home";
import { shellStore } from "../store/shellStore";

afterEach(cleanup);

beforeEach(() => {
  shellStore.getState().setHomeOpen(false);
  shellStore.getState().clearPendingCardMint();
});

/*
 * Home.dnd.test.tsx — HOME-02 coverage at the component boundary.
 *
 * dnd-kit's pointer-event simulation is unreliable in jsdom (RESEARCH.md
 * Wave-0 note), so the pure drag/reorder transitions are already covered
 * independently in homeCardsReducer.test.ts. This file instead asserts the
 * D-06 ＋MAKE CARD consumer path directly: setting shellStore.pendingCardMint
 * and confirming Home mints a card into FRESH and clears the pending value.
 */
describe("Home ＋MAKE CARD consumer (D-06)", () => {
  it("mints a new card into FRESH from pendingCardMint and clears it", async () => {
    render(<Home />);

    await act(async () => {
      shellStore.getState().requestCardMint({ title: "Poliziano at Careggi — updated", foot: "from assistant" });
    });

    // findByText polls (rather than a single synchronous getByText check) so
    // this assertion is robust to the unrelated, best-effort loadSections()
    // async resolution racing the mint effect on mount (T-06-06-01: a failed
    // storage read settles to DEFAULT_SECTIONS on its own microtask timing).
    expect(await screen.findByText("Poliziano at Careggi — updated")).toBeTruthy();
    expect(shellStore.getState().pendingCardMint).toBeNull();
  });

  it("does not mint when pendingCardMint is null (no proposal accepted yet)", () => {
    render(<Home />);
    expect(screen.queryByText("Poliziano at Careggi — updated")).toBeNull();
  });
});
