import { build, context } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { watch } from "node:fs";
import path from "node:path";
import process from "node:process";

import { ACTION_DEFINITIONS, VARIANTS } from "./variant-config.mjs";

const rootDir = process.cwd();
const watchMode = process.argv.includes("--watch");

function parseVariantArg() {
  const arg = process.argv.find((entry) => entry.startsWith("--variant="));
  if (!arg) {
    return undefined;
  }

  const value = arg.split("=")[1];
  return value === "premium" ? "premium" : value === "free" ? "free" : undefined;
}

function selectedVariants() {
  const variantArg = parseVariantArg();
  if (variantArg) {
    return [variantArg];
  }

  return watchMode ? ["free"] : ["free", "premium"];
}

async function readPackageVersion() {
  const packageJson = JSON.parse(await readFile(path.join(rootDir, "package.json"), "utf8"));
  return packageJson.version;
}

function buildManifest(variant, packageVersion) {
  const actions = ACTION_DEFINITIONS
    .filter((action) => variant.enabledActionKeys.includes(action.key))
    .map((action) => ({
      Controllers: ["Keypad"],
      DisableAutomaticStates: true,
      Icon: `imgs/actions/${action.listIcon}`,
      Name: action.name,
      States: [
        {
          Image: `imgs/actions/${action.keyIcon}`,
          ShowTitle: true
        },
        {
          Image: `imgs/actions/${action.activeKeyIcon}`,
          ShowTitle: true
        }
      ],
      ...(action.multiAction ? { SupportedInMultiActions: true } : {}),
      Tooltip: action.tooltip,
      UUID: `${variant.pluginUuid}.${action.suffix}`,
      UserTitleEnabled: true
    }));

  return {
    $schema: "https://schemas.elgato.com/streamdeck/plugins/manifest.json",
    Actions: actions,
    Author: "Zeuz",
    Category: variant.category,
    CategoryIcon: "imgs/category-icon-list",
    CodePath: "bin/plugin.js",
    Description: variant.description,
    Icon: "imgs/plugin-icon",
    Name: variant.displayName,
    Nodejs: {
      Version: "20"
    },
    OS: [
      {
        MinimumVersion: "13",
        Platform: "mac"
      },
      {
        MinimumVersion: "10",
        Platform: "windows"
      }
    ],
    PropertyInspectorPath: "ui/propertyinspector.html",
    SDKVersion: 3,
    Software: {
      MinimumVersion: "6.9"
    },
    SupportURL: variant.supportUrl,
    URL: "https://github.com/oddworker1/streamdeck-url-data-fetcher",
    UUID: variant.pluginUuid,
    Version: `${packageVersion}.0`
  };
}

function buildConfig(variantId, pluginDir) {
  const variantLiteral = JSON.stringify(variantId);

  return {
    pi: {
      bundle: true,
      define: {
        __PLUGIN_VARIANT__: variantLiteral
      },
      entryPoints: [path.join(rootDir, "src", "pi", "index.ts")],
      format: "iife",
      legalComments: "none",
      outfile: path.join(pluginDir, "ui", "propertyinspector.js"),
      platform: "browser",
      sourcemap: true,
      target: "chrome114"
    },
    plugin: {
      bundle: true,
      define: {
        __PLUGIN_VARIANT__: variantLiteral
      },
      entryPoints: [path.join(rootDir, "src", "plugin", "index.ts")],
      format: "cjs",
      legalComments: "none",
      outfile: path.join(pluginDir, "bin", "plugin.js"),
      platform: "node",
      sourcemap: true,
      target: "node20"
    }
  };
}

async function ensureDirectories(pluginDir) {
  await Promise.all([
    mkdir(path.join(pluginDir, "bin"), { recursive: true }),
    mkdir(path.join(pluginDir, "ui"), { recursive: true }),
    mkdir(path.join(pluginDir, "imgs"), { recursive: true })
  ]);
}

async function copyStaticFiles(pluginDir, manifest, variantId) {
  await rm(path.join(pluginDir, "imgs"), { force: true, recursive: true });
  await mkdir(path.join(pluginDir, "imgs"), { recursive: true });
  await cp(path.join(rootDir, "assets", "actions"), path.join(pluginDir, "imgs", "actions"), { force: true, recursive: true });
  await cp(path.join(rootDir, "assets", "variants", variantId), path.join(pluginDir, "imgs"), { force: true, recursive: true });
  await writeFile(
    path.join(pluginDir, "ui", "propertyinspector.html"),
    await readFile(path.join(rootDir, "src", "pi", "propertyinspector.html"))
  );
  await writeFile(
    path.join(pluginDir, "ui", "propertyinspector.css"),
    await readFile(path.join(rootDir, "src", "pi", "styles.css"))
  );
  await writeFile(path.join(pluginDir, "package.json"), `${JSON.stringify({ type: "commonjs" }, null, 2)}\n`);
  await writeFile(path.join(pluginDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

async function buildVariant(variantId, packageVersion) {
  const variant = VARIANTS[variantId];
  const pluginDir = path.join(rootDir, variant.pluginDirName);
  const manifest = buildManifest(variant, packageVersion);
  const configs = buildConfig(variantId, pluginDir);

  await ensureDirectories(pluginDir);
  await copyStaticFiles(pluginDir, manifest, variantId);
  await build(configs.plugin);
  await build(configs.pi);
}

async function runWatch(variantId, packageVersion) {
  const variant = VARIANTS[variantId];
  const pluginDir = path.join(rootDir, variant.pluginDirName);
  const manifest = buildManifest(variant, packageVersion);
  const configs = buildConfig(variantId, pluginDir);

  await ensureDirectories(pluginDir);
  await copyStaticFiles(pluginDir, manifest, variantId);

  const pluginCtx = await context(configs.plugin);
  const piCtx = await context(configs.pi);

  await pluginCtx.watch();
  await piCtx.watch();

  const onStaticChange = async () => {
    try {
      await copyStaticFiles(pluginDir, buildManifest(variant, packageVersion), variantId);
      console.log(`[build:${variantId}] copied static assets`);
    } catch (error) {
      console.error(`[build:${variantId}] failed to copy static assets`, error);
    }
  };

  watch(path.join(rootDir, "assets"), { recursive: true }, onStaticChange);
  watch(path.join(rootDir, "src", "pi"), { recursive: true }, onStaticChange);
  console.log(`[build:${variantId}] watching for changes...`);
  await new Promise(() => {});
}

async function runBuild() {
  const variants = selectedVariants();
  const packageVersion = await readPackageVersion();

  if (watchMode) {
    await runWatch(variants[0], packageVersion);
    return;
  }

  for (const variantId of variants) {
    await buildVariant(variantId, packageVersion);
  }
}

runBuild().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
