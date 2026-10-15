import {defineConfig,} from "@playwright/test";
import {config as loadEnv,} from "dotenv";
import {fileURLToPath,} from "node:url";

loadEnv({
  path: fileURLToPath(new URL(".env",import.meta.url)),
});

export default defineConfig({
  testDir: "./src",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  retries: 0,
  reporter: "list",
});