import { ACTION_SUFFIXES, PLUGIN_VARIANT } from "./variant.js";

export const PLUGIN_UUID = PLUGIN_VARIANT.pluginUuid;

export const ACTION_UUIDS = Object.fromEntries(
  Object.entries(ACTION_SUFFIXES).map(([key, suffix]) => [key, `${PLUGIN_UUID}.${suffix}`])
) as Record<keyof typeof ACTION_SUFFIXES, `${typeof PLUGIN_UUID}.${string}`>;

export const DEFAULTS = {
  emptyText: "--",
  freePollingMinutes: 5,
  maxFlashIntervalMs: 60_000,
  minFlashIntervalMs: 100,
  premiumPollingSeconds: 30,
  requestTimeoutMs: 15_000
} as const;

export const FREE_POLLING_OPTIONS_MINUTES = [5, 10, 15, 30, 60] as const;

export const FREE_ICON_VALUES = [
  "auto",
  "none",
  "analytics",
  "attach_money",
  "battery_full",
  "cloud",
  "dashboard",
  "electric_bolt",
  "hub",
  "language",
  "query_stats",
  "rss_feed",
  "show_chart",
  "thermostat",
  "warning_amber",
  "water_drop",
  "wifi"
] as const;
