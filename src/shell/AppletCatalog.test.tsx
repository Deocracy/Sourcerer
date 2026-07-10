import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";

const { hostOpenMock } = vi.hoisted(() => ({ hostOpenMock: vi.fn() }));

vi.mock("../host/open", () => ({ hostOpen: hostOpenMock }));

import { AppletCatalog } from "./AppletCatalog";
import { shellStore } from "../store/shellStore";

afterEach(cleanup);

beforeEach(() => {
  hostOpenMock.mockClear();
  shellStore.getState().closeAppletCatalog();
});

describe("AppletCatalog", () => {
  it("renders nothing when closed", () => {
    render(<AppletCatalog />);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("lists one row per registry manifest, including known keys", () => {
    render(<AppletCatalog />);
    act(() => shellStore.getState().openAppletCatalog());
    expect(screen.getByText("Wiki")).toBeTruthy();
    expect(screen.getByText("Kanban")).toBeTruthy();
  });

  it("clicking a row calls hostOpen(key) and closes the catalog", () => {
    render(<AppletCatalog />);
    act(() => shellStore.getState().openAppletCatalog());
    fireEvent.click(screen.getByText("Wiki"));
    expect(hostOpenMock).toHaveBeenCalledWith("Wiki");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("ArrowDown + Enter opens the focused row", () => {
    render(<AppletCatalog />);
    act(() => shellStore.getState().openAppletCatalog());
    const panel = screen.getByRole("menu");
    fireEvent.keyDown(panel, { key: "ArrowDown" });
    fireEvent.keyDown(panel, { key: "Enter" });
    expect(hostOpenMock).toHaveBeenCalled();
  });

  it("Escape closes the catalog", () => {
    render(<AppletCatalog />);
    act(() => shellStore.getState().openAppletCatalog());
    const panel = screen.getByRole("menu");
    fireEvent.keyDown(panel, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
