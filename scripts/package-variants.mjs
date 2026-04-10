import { spawn } from "node:child_process";
import process from "node:process";

import { VARIANTS } from "./variant-config.mjs";

const mode = process.argv[2];
if (mode !== "validate" && mode !== "pack") {
  console.error("Usage: node scripts/package-variants.mjs <validate|pack>");
  process.exit(1);
}

const variants = ["free", "premium"];

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      shell: false,
      stdio: "inherit"
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "unknown"}`));
    });
  });
}

function runNpx(args) {
  if (process.platform === "win32") {
    const cmd = process.env.ComSpec ?? "cmd.exe";
    return run(cmd, ["/d", "/s", "/c", `npx ${args.join(" ")}`]);
  }

  return run("npx", args);
}

for (const variantId of variants) {
  const variant = VARIANTS[variantId];
  if (mode === "validate") {
    await runNpx(["@elgato/cli@1.7.3", "validate", variant.pluginDirName]);
    continue;
  }

  await runNpx(["@elgato/cli@1.7.3", "pack", variant.pluginDirName, "--force"]);
}
