import { createReadStream, existsSync, mkdirSync, statSync, watch } from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

import { VARIANTS } from "./variant-config.mjs";

const CLI_PACKAGE = "@elgato/cli@1.7.3";
const appDataDirectory = process.env.APPDATA;
const streamDeckDirectory = appDataDirectory ? path.join(appDataDirectory, "Elgato", "StreamDeck") : undefined;
const nodeRuntimeDirectory = streamDeckDirectory ? path.join(streamDeckDirectory, "NodeJS") : undefined;
const streamDeckJsonLog = streamDeckDirectory ? path.join(streamDeckDirectory, "logs", "StreamDeck.json") : undefined;

const command = process.argv[2];
const variantId = process.argv[3];

function printUsage() {
  console.error("Usage: node scripts/streamdeck-dev.mjs <doctor|link|restart|dev|logs> [free|premium]");
}

function resolveVariant(id) {
  if (!id) {
    return undefined;
  }

  if (id !== "free" && id !== "premium") {
    throw new Error(`Unknown variant '${id}'. Expected 'free' or 'premium'.`);
  }

  return VARIANTS[id];
}

function ensureAppDataDirectory() {
  if (!streamDeckDirectory || !nodeRuntimeDirectory || !streamDeckJsonLog) {
    throw new Error("APPDATA is not available. Stream Deck tooling expects a desktop runtime.");
  }
}

function run(commandName, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(commandName, args, {
      cwd: process.cwd(),
      shell: false,
      stdio: "inherit"
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${commandName} ${args.join(" ")} exited with code ${code ?? "unknown"}`));
    });
  });
}

function runNpx(args) {
  if (process.platform === "win32") {
    const commandProcessor = process.env.ComSpec ?? "cmd.exe";
    return run(commandProcessor, ["/d", "/s", "/c", `npx ${args.join(" ")}`]);
  }

  return run("npx", args);
}

async function runCli(args) {
  await runNpx([CLI_PACKAGE, ...args]);
}

function readLogTail(logPath, bytes = 48 * 1024) {
  const size = statSync(logPath).size;
  const start = Math.max(0, size - bytes);
  return new Promise((resolve, reject) => {
    let text = "";
    const stream = createReadStream(logPath, { encoding: "utf8", start });

    stream.on("data", (chunk) => {
      text += chunk;
    });
    stream.on("end", () => resolve({ size, text }));
    stream.on("error", reject);
  });
}

function getPluginLogTargets(variant) {
  const variants = variant ? [variant] : Object.values(VARIANTS);
  return variants.flatMap((item) => {
    const logDirectory = path.join(process.cwd(), item.pluginDirName, "logs");
    if (!existsSync(logDirectory)) {
      return [];
    }

    return [
      {
        label: item.pluginUuid,
        path: path.join(logDirectory, `${item.pluginUuid}.0.log`),
        type: "plain"
      }
    ].filter((target) => existsSync(target.path));
  });
}

function createFilterTerms(variant) {
  const variantUuids = variant ? [variant.pluginUuid] : Object.values(VARIANTS).map((item) => item.pluginUuid);
  return [
    ...variantUuids,
    "URL Data Fetcher",
    "URL Data Fetcher Pro",
    "plugin startup failed",
    "key press failed",
    "connected to Stream Deck"
  ];
}

function shouldPrintLogLine(entry, filterTerms) {
  const haystack = [
    entry.module,
    entry.func,
    entry.message
  ]
    .filter(Boolean)
    .join(" ");

  return filterTerms.some((term) => haystack.includes(term));
}

function formatLogEntry(entry) {
  const timestamp = typeof entry.timestamp === "string" ? entry.timestamp : "unknown-time";
  const level = typeof entry.level === "string" ? entry.level.toUpperCase() : "INFO";
  const moduleName = typeof entry.module === "string" ? entry.module : "StreamDeck";
  const message = typeof entry.message === "string" ? entry.message : JSON.stringify(entry.message);
  return `${timestamp} ${level.padEnd(5)} ${moduleName} ${message}`;
}

function printPlainLogText(text, label, remainder = "") {
  const combined = `${remainder}${text}`;
  const lines = combined.split(/\r?\n/);
  const nextRemainder = lines.pop() ?? "";

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    console.log(`[${label}] ${line}`);
  }

  return nextRemainder;
}

function consumeLogText(text, filterTerms, remainder = "") {
  const combined = `${remainder}${text}`;
  const lines = combined.split(/\r?\n/);
  const nextRemainder = lines.pop() ?? "";

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    try {
      const entry = JSON.parse(line);
      if (shouldPrintLogLine(entry, filterTerms)) {
        console.log(formatLogEntry(entry));
      }
    } catch {
      // Ignore malformed log fragments.
    }
  }

  return nextRemainder;
}

async function watchLogFile(target, filterTerms) {
  const { size, text } = await readLogTail(target.path);
  let offset = size;
  let remainder = target.type === "plain"
    ? printPlainLogText(text, target.label)
    : consumeLogText(text, filterTerms);

  watch(target.path, { persistent: true }, async () => {
    try {
      const nextSize = statSync(target.path).size;
      const start = nextSize < offset ? 0 : offset;
      if (nextSize === start) {
        return;
      }

      const chunk = await new Promise((resolve, reject) => {
        let textChunk = "";
        const stream = createReadStream(target.path, { encoding: "utf8", start });

        stream.on("data", (data) => {
          textChunk += data;
        });
        stream.on("end", () => resolve(textChunk));
        stream.on("error", reject);
      });

      offset = nextSize;
      remainder = target.type === "plain"
        ? printPlainLogText(chunk, target.label, remainder)
        : consumeLogText(chunk, filterTerms, remainder);
    } catch (error) {
      console.error(`[logs] failed to read updated log ${target.path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}

async function doctor() {
  ensureAppDataDirectory();
  mkdirSync(nodeRuntimeDirectory, { recursive: true });
  await runCli(["dev"]);

  console.log(`[doctor] ensured ${nodeRuntimeDirectory}`);

  if (existsSync(streamDeckJsonLog)) {
    const { text } = await readLogTail(streamDeckJsonLog, 24 * 1024);
    if (text.includes("Virtual Stream Deck in not enabled")) {
      console.log("[doctor] Virtual Stream Deck is not enabled. Current Elgato builds require supported hardware or Stream Deck Mobile Pro to unlock it.");
    }
  }
}

async function link(variant) {
  await runCli(["link", variant.pluginDirName]);
}

async function restart(variant) {
  await runCli(["restart", variant.pluginUuid]);
}

async function dev(variant) {
  await doctor();
  await link(variant);
  await restart(variant);
}

async function logs(variant) {
  ensureAppDataDirectory();
  const pluginLogTargets = getPluginLogTargets(variant);
  const filterTerms = createFilterTerms(variant);
  const targets = pluginLogTargets.length > 0
    ? pluginLogTargets
    : [{ label: "streamdeck", path: streamDeckJsonLog, type: "json" }];

  if (!targets.every((target) => existsSync(target.path))) {
    throw new Error(`Stream Deck log file not found at ${streamDeckJsonLog}`);
  }

  for (const target of targets) {
    console.log(`[logs] watching ${target.path}`);
    await watchLogFile(target, filterTerms);
  }

  await new Promise(() => {});
}

try {
  switch (command) {
    case "doctor":
      await doctor();
      break;
    case "link": {
      const variant = resolveVariant(variantId);
      if (!variant) {
        throw new Error("The link command requires a variant.");
      }
      await link(variant);
      break;
    }
    case "restart": {
      const variant = resolveVariant(variantId);
      if (!variant) {
        throw new Error("The restart command requires a variant.");
      }
      await restart(variant);
      break;
    }
    case "dev": {
      const variant = resolveVariant(variantId);
      if (!variant) {
        throw new Error("The dev command requires a variant.");
      }
      await dev(variant);
      break;
    }
    case "logs":
      await logs(resolveVariant(variantId));
      break;
    default:
      printUsage();
      process.exitCode = 1;
      break;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
