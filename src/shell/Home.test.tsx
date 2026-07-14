import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";

import { Home } from "./Home";
import { DiviChip } from "./DiviChip";
import { shellStore, useShellStore } from "../store/shellStore";

afterEach(cleanup);

beforeEach(() => {
  shellStore.getState().setHomeOpen(false);
});

describe("Home overlay (HOME-01)", () => {
  it("renders the four labelled sections with their DEFAULT_SECTIONS cards", () => {
    render(<Home />);
    expect(screen.getByText("◆ PINNED")).toBeTruthy();
    expect(screen.getByText("FRESH")).toBeTruthy();
    expect(screen.getByText("LIVING")).toBeTruthy();
    expect(screen.getByText(/^ARCHIVE ·/)).toBeTruthy();
    // A curated card from each section renders.
    expect(screen.getByText("Renaissance Papers")).toBeTruthy(); // pins
    expect(screen.getByText(/Alberti — Genoa vs Venice/)).toBeTruthy(); // fresh
    expect(screen.getByText(/Was Ficino/)).toBeTruthy(); // living
  });

  it("ARCHIVE shows a CARDS/LIST view toggle", () => {
    render(<Home />);
    expect(screen.getByText("◧ CARDS")).toBeTruthy();
    expect(screen.getByText("≡ LIST")).toBeTruthy();
  });
});

describe("DiviChip <-> homeOpen (single source of truth, RESEARCH.md Pitfall 4)", () => {
  it("clicking DIVI toggles the shellStore homeOpen boolean", () => {
    render(<DiviChip />);
    expect(shellStore.getState().homeOpen).toBe(false);
    fireEvent.click(screen.getByText("DIVI"));
    expect(shellStore.getState().homeOpen).toBe(true);
    fireEvent.click(screen.getByText("DIVI"));
    expect(shellStore.getState().homeOpen).toBe(false);
  });

  it("DiviChip's active styling reflects homeOpen, not railApplet", () => {
    render(<DiviChip />);
    const chip = screen.getByText("DIVI");
    expect(chip.className).not.toMatch(/active/);

    act(() => {
      shellStore.getState().setRailApplet("Home");
    });
    // Stale signal must NOT drive active styling.
    expect(chip.className).not.toMatch(/active/);

    act(() => {
      shellStore.getState().setHomeOpen(true);
    });
    expect(chip.className).toMatch(/active/);
  });
});

function HomeGatedByStore() {
  const homeOpen = useShellStore((s) => s.homeOpen);
  return <div data-testid="main">{homeOpen && <Home />}</div>;
}

describe("Home overlay presence gated by homeOpen (D-04)", () => {
  it("is absent from the DOM when homeOpen is false, present when true", () => {
    render(<HomeGatedByStore />);
    expect(screen.queryByText("◆ PINNED")).toBeNull();

    act(() => {
      shellStore.getState().setHomeOpen(true);
    });
    expect(screen.getByText("◆ PINNED")).toBeTruthy();

    act(() => {
      shellStore.getState().setHomeOpen(false);
    });
    expect(screen.queryByText("◆ PINNED")).toBeNull();
  });
});
