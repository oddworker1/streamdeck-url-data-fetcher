import { DEFAULTS, FREE_ICON_VALUES, FREE_POLLING_OPTIONS_MINUTES } from "./constants.js";
import { hasVariantFeature } from "./variant.js";
import type { IconGlyph, KnownActionSettings, UrlDataSettings, WarningDurationUnit } from "../types/settings.js";

const FREE_ICON_SET = new Set<string>(FREE_ICON_VALUES);

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

function normalizeDurationUnit(value: unknown): WarningDurationUnit {
  return value === "minutes" ? "minutes" : "seconds";
}

function normalizeIcon(glyph: unknown): IconGlyph | undefined {
  if (typeof glyph !== "string") {
    return undefined;
  }

  const trimmed = glyph.trim();
  return trimmed ? trimmed : undefined;
}

function constrainWarningIcon(next: Record<string, unknown>, key: string) {
  const glyph = normalizeIcon(next[key]);
  if (!glyph) {
    delete next[key];
    return;
  }

  if (!hasVariantFeature("largeIconLibrary") && !FREE_ICON_SET.has(glyph)) {
    next[key] = "warning_amber";
  }
}

export function getPollingIntervalMs(settings: KnownActionSettings): number {
  const rawValue = typeof settings.pollingValue === "number" && Number.isFinite(settings.pollingValue)
    ? settings.pollingValue
    : undefined;

  if (hasVariantFeature("shortPolling")) {
    const unit = settings.pollingUnit === "minutes" ? "minutes" : "seconds";
    const value = clamp(rawValue ?? DEFAULTS.premiumPollingSeconds, 1, unit === "minutes" ? 1_440 : 86_400);
    return Math.round(value * (unit === "minutes" ? 60_000 : 1_000));
  }

  const normalizedMinutes = clamp(Math.round(rawValue ?? DEFAULTS.freePollingMinutes), 5, 1_440);
  const selected = FREE_POLLING_OPTIONS_MINUTES.find((entry) => entry >= normalizedMinutes)
    ?? FREE_POLLING_OPTIONS_MINUTES[FREE_POLLING_OPTIONS_MINUTES.length - 1];

  return (selected ?? DEFAULTS.freePollingMinutes) * 60_000;
}

export function constrainSettingsForVariant(settings: KnownActionSettings): UrlDataSettings {
  const next = { ...settings } as Record<string, unknown>;

  if (typeof next.decimals === "number" && Number.isFinite(next.decimals)) {
    next.decimals = clamp(Math.round(next.decimals), 0, 6);
  } else {
    delete next.decimals;
  }

  if (typeof next.iconSize === "number" && Number.isFinite(next.iconSize)) {
    next.iconSize = clamp(Math.round(next.iconSize), 14, 54);
  } else {
    delete next.iconSize;
  }

  for (const colorKey of [
    "backgroundColor",
    "iconColor",
    "labelColor",
    "subtitleColor",
    "valueColor",
    "warningOverBackgroundColor",
    "warningOverIconColor",
    "warningOverTextColor",
    "warningUnderBackgroundColor",
    "warningUnderIconColor",
    "warningUnderTextColor"
  ]) {
    const color = normalizeHexColor(next[colorKey]);
    if (color) {
      next[colorKey] = color;
    } else {
      delete next[colorKey];
    }
  }

  const iconGlyph = normalizeIcon(next.iconGlyph);
  if (!iconGlyph) {
    delete next.iconGlyph;
  } else if (!hasVariantFeature("largeIconLibrary") && !FREE_ICON_SET.has(iconGlyph)) {
    next.iconGlyph = "auto";
  } else {
    next.iconGlyph = iconGlyph;
  }

  constrainWarningIcon(next, "warningOverIconGlyph");
  constrainWarningIcon(next, "warningUnderIconGlyph");

  for (const sizeKey of ["warningOverIconSize", "warningUnderIconSize"]) {
    if (typeof next[sizeKey] === "number" && Number.isFinite(next[sizeKey])) {
      next[sizeKey] = clamp(Math.round(next[sizeKey]), 12, 40);
    } else {
      delete next[sizeKey];
    }
  }

  for (const intervalKey of ["warningOverFlashIntervalMs", "warningUnderFlashIntervalMs"]) {
    if (typeof next[intervalKey] === "number" && Number.isFinite(next[intervalKey])) {
      next[intervalKey] = clamp(Math.round(next[intervalKey]), DEFAULTS.minFlashIntervalMs, DEFAULTS.maxFlashIntervalMs);
    } else {
      delete next[intervalKey];
    }
  }

  for (const durationKey of ["warningOverFlashDuration", "warningUnderFlashDuration"]) {
    if (typeof next[durationKey] === "number" && Number.isFinite(next[durationKey])) {
      next[durationKey] = clamp(next[durationKey], 0.1, 1_440);
    } else {
      delete next[durationKey];
    }
  }

  for (const unitKey of ["warningOverFlashDurationUnit", "warningUnderFlashDurationUnit"]) {
    next[unitKey] = normalizeDurationUnit(next[unitKey]);
  }

  if (hasVariantFeature("shortPolling")) {
    next.pollingUnit = next.pollingUnit === "minutes" ? "minutes" : "seconds";
    next.pollingValue = typeof next.pollingValue === "number" && Number.isFinite(next.pollingValue)
      ? clamp(next.pollingValue, 1, next.pollingUnit === "minutes" ? 1_440 : 86_400)
      : DEFAULTS.premiumPollingSeconds;
  } else {
    next.pollingUnit = "minutes";
    const rawMinutes = typeof next.pollingValue === "number" && Number.isFinite(next.pollingValue)
      ? Math.round(next.pollingValue)
      : DEFAULTS.freePollingMinutes;
    next.pollingValue = FREE_POLLING_OPTIONS_MINUTES.find((entry) => entry >= rawMinutes)
      ?? FREE_POLLING_OPTIONS_MINUTES[FREE_POLLING_OPTIONS_MINUTES.length - 1]
      ?? DEFAULTS.freePollingMinutes;
  }

  return next as UrlDataSettings;
}

export function supportsLargeIconLibrary(): boolean {
  return hasVariantFeature("largeIconLibrary");
}

export function supportsShortPolling(): boolean {
  return hasVariantFeature("shortPolling");
}
