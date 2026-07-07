import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Vitest harness for the shell component tree.
// jsdom gives a DOM without launching a real Tauri webview; window IPC is
// intercepted via @tauri-apps/api/mocks in the specs themselves.
// No path aliases are defined in tsconfig.json, so none are added here.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    css: true,
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
