import { execFileSync } from "node:child_process";

const paths = ["packages/contracts/openapi.json", "packages/contracts/src/generated"];
const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard", "--", ...paths], {
  encoding: "utf8",
}).trim();

if (untracked) throw new Error(`Generated contract artifacts are not tracked:\n${untracked}`);
