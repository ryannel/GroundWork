import { spawn } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const tsxBin = path.join(root, "node_modules", ".bin", "tsx");
const viteBin = path.join(root, "node_modules", ".bin", "vite");

const children = [
  spawn(tsxBin, ["watch", "packages/cli/src/index.ts", "serve"], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  }),
  spawn(viteBin, [], {
    cwd: path.join(root, "packages", "ui"),
    stdio: "inherit",
    env: process.env,
  }),
];

let exiting = false;
function shutdown(code = 0) {
  if (exiting) return;
  exiting = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
  setTimeout(() => process.exit(code), 300).unref();
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

for (const child of children) {
  child.on("exit", (code) => {
    if (!exiting) shutdown(code ?? 0);
  });
}
