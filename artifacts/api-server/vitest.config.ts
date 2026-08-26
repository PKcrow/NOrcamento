import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/tests/**/*.test.ts"],
    hookTimeout: 30000,
    testTimeout: 30000,
    // Tests share one database; run files sequentially to avoid interference.
    fileParallelism: false,
  },
});
