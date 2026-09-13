import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Scope kept deliberately narrow: this project's tests cover the pure
// business-logic functions under src/lib/billing/* and src/lib/*Access* —
// money math and access control, the code where a silent regression is
// most expensive. It does NOT spin up a real Postgres/Prisma client (the
// route handlers themselves are exercised manually/in staging, not here),
// so "node" environment with no DB setup is enough — see SECURITY.md for
// what this suite does and doesn't cover.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
    },
  },
});
