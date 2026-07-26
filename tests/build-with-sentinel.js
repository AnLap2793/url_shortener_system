import { spawnSync } from "node:child_process";
import process from "node:process";

const result = spawnSync("npm", ["run", "build:all"], {
  env: { ...process.env, DATABASE_URL: "postgres://private-build-sentinel@invalid.invalid/test", STORY_TEST_PRIVATE_SENTINEL: "private-build-sentinel" },
  shell: true,
  stdio: "inherit",
});
if (result.status !== 0) process.exit(result.status ?? 1);
