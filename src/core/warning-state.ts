import { DEFAULTS } from "./constants.js";
import type { IconGlyph, KnownActionSettings, WarningDurationUnit } from "../types/settings.js";
import type { TileRenderModel, WarningPresentation } from "./render-model.js";

export type WarningDirection = "over" | "under";

export type WarningConfig = {
  backgroundColor?: string;
  direction: WarningDirection;
  enabled: boolean;
  flash: boolean;
  flashDurationMs?: number;
  flashIntervalMs: number;
  iconColor?: string;
  iconGlyph?: IconGlyph;
  iconSize?: number;
  textColor?: string;
  threshold?: number;
};

export type WarningRuntimeState = {
  active: boolean;
  enteredAt?: number;
  settled: boolean;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readDurationUnit(value: unknown): WarningDurationUnit {
  return value === "minutes" ? "minutes" : "seconds";
}

function toDurationMs(value: number | undefined, unit: WarningDurationUnit): number | undefined {
  if (value === undefined || value <= 0) {
    return undefined;
  }

  return Math.round(value * (unit === "minutes" ? 60_000 : 1_000));
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function readText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function readWarningConfig(settings: KnownActionSettings, direction: WarningDirection): WarningConfig | undefined {
  const prefix = direction === "over" ? "warningOver" : "warningUnder";
  const enabled = readBoolean((settings as Record<string, unknown>)[`${prefix}Enabled`]);
  const threshold = readNumber((settings as Record<string, unknown>)[`${prefix}Threshold`]);
  const flash = readBoolean((settings as Record<string, unknown>)[`${prefix}Flash`]) ?? false;

  if (enabled !== true && threshold === undefined) {
    return undefined;
  }

  return {
    backgroundColor: readText((settings as Record<string, unknown>)[`${prefix}BackgroundColor`]),
    direction,
    enabled: enabled ?? true,
    flash,
    flashDurationMs: toDurationMs(
      readNumber((settings as Record<string, unknown>)[`${prefix}FlashDuration`]),
      readDurationUnit((settings as Record<string, unknown>)[`${prefix}FlashDurationUnit`])
    ),
    flashIntervalMs: clamp(
      Math.round(readNumber((settings as Record<string, unknown>)[`${prefix}FlashIntervalMs`]) ?? 900),
      DEFAULTS.minFlashIntervalMs,
      DEFAULTS.maxFlashIntervalMs
    ),
    iconColor: readText((settings as Record<string, unknown>)[`${prefix}IconColor`]),
    iconGlyph: readText((settings as Record<string, unknown>)[`${prefix}IconGlyph`]),
    iconSize: readNumber((settings as Record<string, unknown>)[`${prefix}IconSize`]),
    textColor: readText((settings as Record<string, unknown>)[`${prefix}TextColor`]),
    threshold
  };
}

export function isWarningTriggered(config: WarningConfig | undefined, model: TileRenderModel): boolean {
  if (!config?.enabled || config.threshold === undefined || typeof model.primaryNumericValue !== "number") {
    return false;
  }

  return config.direction === "over"
    ? model.primaryNumericValue > config.threshold
    : model.primaryNumericValue < config.threshold;
}

export function hasActiveWarningAnimation(
  settings: KnownActionSettings,
  runtime: Record<WarningDirection, WarningRuntimeState>,
  now: number
): boolean {
  return (["over", "under"] as const).some((direction) => {
    const config = readWarningConfig(settings, direction);
    const state = runtime[direction];
    if (!config?.enabled || !config.flash || !state.active || state.enteredAt === undefined) {
      return false;
    }

    return config.flashDurationMs === undefined || now - state.enteredAt < config.flashDurationMs || !state.settled;
  });
}

export function applyWarningState(
  settings: KnownActionSettings,
  baseModel: TileRenderModel,
  runtime: Record<WarningDirection, WarningRuntimeState>,
  now: number
): TileRenderModel {
  const next = { ...baseModel };

  for (const direction of ["over", "under"] as const) {
    const config = readWarningConfig(settings, direction);
    const state = runtime[direction];
    const triggered = isWarningTriggered(config, baseModel);

    if (!triggered) {
      state.active = false;
      state.enteredAt = undefined;
      state.settled = false;
      continue;
    }

    if (!config) {
      continue;
    }

    if (!state.active) {
      state.active = true;
      state.enteredAt = now;
      state.settled = false;
    }

    const flashWindowActive = config.flash
      && state.enteredAt !== undefined
      && (config.flashDurationMs === undefined || now - state.enteredAt < config.flashDurationMs);
    state.settled = !flashWindowActive;
    const flashVisible = !flashWindowActive
      || state.enteredAt === undefined
      || Math.floor((now - state.enteredAt) / config.flashIntervalMs) % 2 === 0;

    if (!flashVisible) {
      continue;
    }

    const warning: WarningPresentation = {
      backgroundColor: config.backgroundColor,
      direction,
      iconColor: config.iconColor ?? config.textColor,
      iconGlyph: config.iconGlyph,
      iconSize: config.iconSize,
      textColor: config.textColor
    };

    next.warning = warning;
    next.accent = "warning";
    return next;
  }

  delete next.warning;
  return next;
}
