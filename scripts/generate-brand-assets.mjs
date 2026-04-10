import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import sharp from "sharp";

const rootDir = process.cwd();

function createPluginIconSvg({ accent, highlight, label, ring }) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 144 144">
      <defs>
        <linearGradient id="bg" x1="18" y1="12" x2="126" y2="132" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#0f1726"/>
          <stop offset="1" stop-color="#142336"/>
        </linearGradient>
        <linearGradient id="panel" x1="32" y1="24" x2="110" y2="116" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="${accent}"/>
          <stop offset="1" stop-color="${highlight}"/>
        </linearGradient>
      </defs>
      <rect width="144" height="144" rx="30" fill="url(#bg)"/>
      <rect x="19" y="19" width="106" height="106" rx="24" fill="#0c1320" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
      <path d="M47 42h24c10 0 18 8 18 18v4H73c-10 0-18-8-18-18v-4zm42 38h8c10 0 18 8 18 18v4H91c-10 0-18-8-18-18v-4h16zm-42 0h8c10 0 18 8 18 18v4H49c-10 0-18-8-18-18v-4h16z" fill="url(#panel)"/>
      <circle cx="99" cy="45" r="17" fill="${ring}" opacity="0.92"/>
      <path d="M94 45.5h10.5M104 45.5l-3.3-3.2M104 45.5l-3.3 3.2" stroke="#0e1726" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="32" y="108" width="80" height="10" rx="5" fill="rgba(255,255,255,0.12)"/>
      <text x="36" y="117" fill="#f5fbff" font-family="'Segoe UI',sans-serif" font-size="8" font-weight="700" letter-spacing=".18em">${label}</text>
    </svg>
  `.trim();
}

function createCategoryListIconSvg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
      <rect x="4.5" y="5.5" width="6.5" height="6.5" rx="2.3" fill="none" stroke="#FFFFFF" stroke-width="2"/>
      <rect x="4.5" y="16" width="6.5" height="6.5" rx="2.3" fill="none" stroke="#FFFFFF" stroke-width="2"/>
      <circle cx="19" cy="14" r="5.5" fill="none" stroke="#FFFFFF" stroke-width="2"/>
      <path d="M16.5 14h5M20.5 14l-1.7-1.6M20.5 14l-1.7 1.6" fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `.trim();
}

function createActionListIconSvg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
      <path d="M3 14h3.2l2.1-6 3.1 4 2-3 3.6 5" fill="none" stroke="#FFFFFF" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="15.5" cy="5.5" r="2.5" fill="none" stroke="#FFFFFF" stroke-width="1.8"/>
      <path d="M14.3 5.5h2.6M16.3 5.5l-1.2-1.2M16.3 5.5l-1.2 1.2" fill="none" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `.trim();
}

function createKeyIconSvg({ accent, active }) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72">
      <rect x="8" y="8" width="56" height="56" rx="16" fill="#111a28" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
      <path d="M19 45h8l6-18 8 12 5-8 7 14" fill="none" stroke="${accent}" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="52" cy="19" r="6.5" fill="${active ? "#ffd058" : accent}" opacity="${active ? "1" : ".86"}"/>
      <path d="M49 19.2h6.2M54.3 19.2l-2.1-2M54.3 19.2l-2.1 2" stroke="#111a28" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `.trim();
}

async function renderPng(svg, width, outputPath) {
  await sharp(Buffer.from(svg)).resize(width, width).png().toFile(outputPath);
}

async function writeVariantAssets(variantId, config) {
  const targetDir = path.join(rootDir, "assets", "variants", variantId);
  await rm(targetDir, { force: true, recursive: true });
  await mkdir(targetDir, { recursive: true });

  const pluginSvg = createPluginIconSvg(config);
  const categoryListSvg = createCategoryListIconSvg();

  await writeFile(path.join(targetDir, "category-icon-list.svg"), `${categoryListSvg}\n`);
  await renderPng(pluginSvg, 256, path.join(targetDir, "plugin-icon.png"));
  await renderPng(pluginSvg, 512, path.join(targetDir, "plugin-icon@2x.png"));
}

async function writeActionAssets() {
  const targetDir = path.join(rootDir, "assets", "actions");
  await rm(targetDir, { force: true, recursive: true });
  await mkdir(targetDir, { recursive: true });
  const list = createActionListIconSvg();
  const idle = createKeyIconSvg({ accent: "#53c8ff", active: false });
  const active = createKeyIconSvg({ accent: "#53c8ff", active: true });
  await writeFile(path.join(targetDir, "display-json-value-list.svg"), `${list}\n`);
  await writeFile(path.join(targetDir, "display-json-value-key.svg"), `${idle}\n`);
  await writeFile(path.join(targetDir, "display-json-value-key-active.svg"), `${active}\n`);
}

async function main() {
  await writeVariantAssets("free", {
    accent: "#53c8ff",
    highlight: "#8cf0ff",
    label: "LIVE URL",
    ring: "#ffb84d"
  });
  await writeVariantAssets("premium", {
    accent: "#5ae2c8",
    highlight: "#8effdf",
    label: "LIVE URL PRO",
    ring: "#ffd058"
  });
  await writeActionAssets();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
