import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      NODE_ENV: "test",
      JWT_SECRET: "test-secret-for-vitest",
      // Integration tests run only when TEST_DATABASE_URL points at a disposable Postgres.
      ...(process.env.TEST_DATABASE_URL ? { DATABASE_URL: process.env.TEST_DATABASE_URL } : {}),
    },
  },
});
