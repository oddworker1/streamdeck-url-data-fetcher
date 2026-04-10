import { FREE_ICON_VALUES } from "./constants.js";
import { findMaterialIconOption, ICON_CATEGORY_OPTIONS as MATERIAL_ICON_CATEGORY_OPTIONS, MATERIAL_ICON_OPTIONS } from "./material-icons.generated";
import { supportsLargeIconLibrary } from "./variant-settings.js";
import type { IconGlyph, KnownActionSettings } from "../types/settings.js";
import type { TileRenderModel } from "./render-model.js";

const SPECIAL_ICON_OPTIONS = [
  { category: "common", label: "Auto", value: "auto" },
  { category: "common", label: "None", value: "none" }
] as const;

const FREE_ICON_SET = new Set<string>(FREE_ICON_VALUES);

export const ICON_CATEGORY_OPTIONS = MATERIAL_ICON_CATEGORY_OPTIONS;

export const ICON_GLYPH_OPTIONS: Array<{ category: string; label: string; value: IconGlyph }> = [
  ...SPECIAL_ICON_OPTIONS,
  ...MATERIAL_ICON_OPTIONS.map((option) => ({
    category: option.category,
    label: option.label,
    value: option.value as IconGlyph
  }))
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeHexColor(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) {
    return undefined;
  }

  if (trimmed.length === 4) {
    const [, red, green, blue] = trimmed;
    return `#${red}${red}${green}${green}${blue}${blue}`.toLowerCase();
  }

  return trimmed.toLowerCase();
}

function darkenHexColor(value: string, ratio: number): string {
  const normalized = normalizeHexColor(value);
  if (!normalized) {
    return value;
  }

  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  const apply = (channel: number) => Math.max(0, Math.min(255, Math.round(channel * (1 - ratio))));

  return `#${[apply(red), apply(green), apply(blue)].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function toRgba(hex: string, alpha: number): string {
  const normalized = normalizeHexColor(hex) ?? "#ffffff";
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function splitLines(text: string, maxLines: number): string[] {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, maxLines);
}

function resolveConfiguredIcon(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  if (!supportsLargeIconLibrary() && !FREE_ICON_SET.has(value)) {
    return undefined;
  }

  return value;
}

function resolveIconGlyph(settings: KnownActionSettings, model: TileRenderModel): IconGlyph {
  const configured = resolveConfiguredIcon(typeof settings.iconGlyph === "string" ? settings.iconGlyph : undefined);
  if (configured === "none") {
    return configured;
  }

  if (configured && configured !== "auto") {
    return configured;
  }

  if (model.warning?.iconGlyph) {
    return model.warning.iconGlyph;
  }

  return model.iconHint ?? "query_stats";
}

function iconColor(settings: KnownActionSettings, model: TileRenderModel, accent: string): string {
  return normalizeHexColor(model.warning?.iconColor)
    ?? normalizeHexColor(settings.iconColor)
    ?? accent;
}

function backgroundColor(settings: KnownActionSettings, model: TileRenderModel): string {
  return normalizeHexColor(model.warning?.backgroundColor)
    ?? normalizeHexColor(settings.backgroundColor)
    ?? "#121b28";
}

function labelColor(settings: KnownActionSettings, model: TileRenderModel): string {
  return normalizeHexColor(model.warning?.textColor)
    ?? normalizeHexColor(settings.labelColor)
    ?? "#b8c7d8";
}

function valueColor(settings: KnownActionSettings, model: TileRenderModel): string {
  return normalizeHexColor(model.warning?.textColor)
    ?? normalizeHexColor(settings.valueColor)
    ?? "#f5fbff";
}

function subtitleColor(settings: KnownActionSettings, model: TileRenderModel): string {
  return normalizeHexColor(model.warning?.textColor)
    ?? normalizeHexColor(settings.subtitleColor)
    ?? "#8da3b8";
}

function readIconSize(settings: KnownActionSettings, model: TileRenderModel): number {
  if (typeof model.warning?.iconSize === "number" && Number.isFinite(model.warning.iconSize)) {
    return clamp(Math.round(model.warning.iconSize), 12, 42);
  }

  if (typeof settings.iconSize === "number" && Number.isFinite(settings.iconSize)) {
    return clamp(Math.round(settings.iconSize), 14, 54);
  }

  return 28;
}

function palette(accent: TileRenderModel["accent"]) {
  switch (accent) {
    case "danger":
      return { accent: "#ff6b7a", chip: "#ffd3d7" };
    case "warning":
      return { accent: "#ffb84d", chip: "#ffe2b4" };
    case "ok":
      return { accent: "#53c8ff", chip: "#c8f1ff" };
    case "neutral":
    default:
      return { accent: "#7b92a7", chip: "#d4e0ea" };
  }
}

export function renderGlyph(glyph: IconGlyph, color: string): string {
  const materialGlyph = findMaterialIconOption(glyph);
  if (materialGlyph) {
    return `<g fill="${color}">${materialGlyph.body}</g>`;
  }

  const fallback = findMaterialIconOption("query_stats");
  return fallback ? `<g fill="${color}">${fallback.body}</g>` : "";
}

function buildValueMarkup(text: string, color: string): string {
  const content = text.trim() || "--";
  const size = content.length > 18 ? 18 : content.length > 11 ? 24 : 34;
  const lines = splitLines(content, 2);
  const lineHeight = Math.round(size * 1.05);
  const firstY = lines.length > 1 ? 74 - Math.round(lineHeight * 0.35) : 80;

  return lines.map((line, index) =>
    `<text x="22" y="${firstY + (index * lineHeight)}" fill="${color}" font-family="'Segoe UI',Arial,sans-serif" font-size="${size}" font-weight="700">${escapeXml(line)}</text>`
  ).join("");
}

function buildTitleMarkup(text: string, color: string): string {
  const lines = splitLines(text.toUpperCase(), 2);
  const lineHeight = 11;
  return lines.map((line, index) =>
    `<text x="22" y="${24 + (index * lineHeight)}" fill="${color}" font-family="'Segoe UI',Arial,sans-serif" font-size="9" font-weight="700" letter-spacing=".16em">${escapeXml(line)}</text>`
  ).join("");
}

function buildSubtitleMarkup(text: string | undefined, color: string): string {
  if (!text) {
    return "";
  }

  const safe = text.length > 32 ? `${text.slice(0, 29)}...` : text;
  return `<text x="22" y="122" fill="${color}" font-family="'Segoe UI',Arial,sans-serif" font-size="11" font-weight="500">${escapeXml(safe)}</text>`;
}

function toSvgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/\s+/g, " ").trim())}`;
}

export function getVisibleIconOptions(category: string | undefined, search: string): Array<{ category: string; label: string; value: IconGlyph }> {
  const normalizedSearch = search.trim().toLowerCase();
  return ICON_GLYPH_OPTIONS.filter((option) => {
    if (!supportsLargeIconLibrary() && !FREE_ICON_SET.has(option.value)) {
      return false;
    }
    if (category && category !== option.category) {
      return false;
    }
    if (!normalizedSearch) {
      return true;
    }
    return option.label.toLowerCase().includes(normalizedSearch) || option.value.toLowerCase().includes(normalizedSearch);
  });
}

export function renderKeyImage(settings: KnownActionSettings, model: TileRenderModel): string {
  const theme = palette(model.accent);
  const panelColor = backgroundColor(settings, model);
  const baseColor = darkenHexColor(panelColor, 0.25);
  const labelFill = labelColor(settings, model);
  const valueFill = valueColor(settings, model);
  const subtitleFill = subtitleColor(settings, model);
  const glyph = resolveIconGlyph(settings, model);
  const glyphColor = iconColor(settings, model, theme.accent);
  const glyphSize = readIconSize(settings, model);
  const iconTranslateX = 112 - (glyphSize / 2);
  const iconTranslateY = 38 - (glyphSize / 2);
  const iconScale = glyphSize / 24;
  const statusChip = model.statusText
    ? `<g>
        <rect x="22" y="98" width="${Math.min(80, Math.max(38, model.statusText.length * 6.2))}" height="16" rx="8" fill="${toRgba(theme.accent, 0.18)}"/>
        <text x="30" y="109" fill="${theme.chip}" font-family="'Segoe UI',Arial,sans-serif" font-size="9" font-weight="700">${escapeXml(model.statusText)}</text>
      </g>`
    : "";
  const warningBadge = model.warning?.iconGlyph
    ? `<g>
        <circle cx="120" cy="108" r="12" fill="${theme.accent}"/>
        <g transform="translate(110 98) scale(.8)">
          ${renderGlyph(model.warning.iconGlyph, "#101721")}
        </g>
      </g>`
    : "";

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
      <defs>
        <linearGradient id="tile-bg" x1="16" y1="10" x2="128" y2="134" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="${baseColor}"/>
          <stop offset="1" stop-color="${panelColor}"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="144" height="144" rx="24" fill="${baseColor}"/>
      <rect x="10" y="10" width="124" height="124" rx="22" fill="url(#tile-bg)" stroke="${toRgba("#ffffff", 0.08)}" stroke-width="1.4"/>
      <rect x="10" y="10" width="124" height="8" rx="4" fill="${theme.accent}"/>
      ${buildTitleMarkup(model.title, labelFill)}
      ${buildValueMarkup(model.valueText, valueFill)}
      ${statusChip}
      ${buildSubtitleMarkup(model.subtitle, subtitleFill)}
      ${glyph === "none" ? "" : `<g transform="translate(${iconTranslateX} ${iconTranslateY}) scale(${iconScale})">${renderGlyph(glyph, glyphColor)}</g>`}
      ${warningBadge}
    </svg>
  `;

  return toSvgDataUrl(svg);
}
