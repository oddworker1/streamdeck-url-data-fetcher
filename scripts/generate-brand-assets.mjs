import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import sharp from "sharp";

const rootDir = process.cwd();

function createPluginIconSvg({ accent, highlight, label, ring }) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
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

function createCategoryIconSvg({ accent, ring }) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
      <rect width="28" height="28" rx="8" fill="#121d2c"/>
      <rect x="4" y="5" width="8" height="8" rx="3" fill="${accent}"/>
      <rect x="4" y="15" width="8" height="8" rx="3" fill="${accent}" opacity=".82"/>
      <rect x="14" y="10" width="10" height="10" rx="4" fill="${ring}"/>
      <path d="M16.5 15h5M20.5 15l-1.7-1.6M20.5 15l-1.7 1.6" stroke="#121d2c" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `.trim();
}

function createActionIconSvg({ accent, active }) {
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
  await mkdir(targetDir, { recursive: true });

  const pluginSvg = createPluginIconSvg(config);
  const categorySvg = createCategoryIconSvg(config);

  await writeFile(path.join(targetDir, "plugin-icon.svg"), `${pluginSvg}\n`);
  await writeFile(path.join(targetDir, "category-icon.svg"), `${categorySvg}\n`);
  await renderPng(pluginSvg, 144, path.join(targetDir, "plugin-icon.png"));
  await renderPng(pluginSvg, 288, path.join(targetDir, "plugin-icon@2x.png"));
  await renderPng(categorySvg, 28, path.join(targetDir, "category-icon.png"));
  await renderPng(categorySvg, 56, path.join(targetDir, "category-icon-meta.png"));
  await renderPng(categorySvg, 112, path.join(targetDir, "category-icon-meta@2x.png"));
}

async function writeActionAssets() {
  const targetDir = path.join(rootDir, "assets", "actions");
  await mkdir(targetDir, { recursive: true });
  const idle = createActionIconSvg({ accent: "#53c8ff", active: false });
  const active = createActionIconSvg({ accent: "#53c8ff", active: true });
  await writeFile(path.join(targetDir, "display-json-value.svg"), `${idle}\n`);
  await writeFile(path.join(targetDir, "display-json-value-active.svg"), `${active}\n`);
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
