import { readFile } from "node:fs/promises";

const expectedNode = (await readFile(".node-version", "utf8")).trim();
const expectedNpm = JSON.parse(await readFile("package.json", "utf8")).packageManager.split("@")[1];
const [major, minor] = process.versions.node.split(".").map(Number);
const [requiredMajor, requiredMinor] = expectedNode.split(".").map(Number);

if (process.env.CI && (major < requiredMajor || (major === requiredMajor && minor < requiredMinor))) {
  throw new Error(`Node ${expectedNode} or newer is required; current ${process.versions.node}`);
}

if (process.env.CI && process.env.npm_config_user_agent && !process.env.npm_config_user_agent.startsWith(`npm/${expectedNpm} `)) {
  throw new Error(`CI must use npm ${expectedNpm}`);
}
