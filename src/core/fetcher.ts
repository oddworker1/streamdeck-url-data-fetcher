import { DEFAULTS } from "./constants.js";
import { getValueAtPath } from "./json-path.js";
import type { TileRenderModel } from "./render-model.js";
import type { KnownActionSettings } from "../types/settings.js";

function formatShortTime(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function trimText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function inferIconHint(input: string): string {
  const haystack = input.toLowerCase();
  if (haystack.includes("battery")) {
    return "battery_full";
  }
  if (haystack.includes("temp")) {
    return "thermostat";
  }
  if (haystack.includes("power") || haystack.includes("watt") || haystack.includes("energy")) {
    return "electric_bolt";
  }
  if (haystack.includes("money") || haystack.includes("price") || haystack.includes("currency")) {
    return "attach_money";
  }
  if (haystack.includes("water") || haystack.includes("rain") || haystack.includes("humidity")) {
    return "water_drop";
  }
  if (haystack.includes("wifi") || haystack.includes("network") || haystack.includes("latency")) {
    return "wifi";
  }
  if (haystack.includes("warning") || haystack.includes("error") || haystack.includes("alarm")) {
    return "warning_amber";
  }
  if (haystack.includes("feed") || haystack.includes("rss")) {
    return "rss_feed";
  }
  if (haystack.includes("cloud")) {
    return "cloud";
  }

  return "query_stats";
}

function formatDisplayValue(rawValue: unknown, settings: KnownActionSettings): {
  numericValue?: number;
  rawValue: boolean | number | string | null;
  text: string;
} {
  if (rawValue === null) {
    return {
      rawValue: null,
      text: settings.emptyText ?? DEFAULTS.emptyText
    };
  }

  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    const decimals = typeof settings.decimals === "number" && Number.isFinite(settings.decimals)
      ? settings.decimals
      : Number.isInteger(rawValue)
        ? 0
        : 2;
    const formatted = rawValue.toLocaleString(undefined, {
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals
    });
    return {
      numericValue: rawValue,
      rawValue,
      text: settings.unitText ? `${formatted} ${settings.unitText}` : formatted
    };
  }

  if (typeof rawValue === "boolean") {
    return {
      rawValue,
      text: rawValue ? "True" : "False"
    };
  }

  if (typeof rawValue === "string") {
    const trimmed = rawValue.trim();
    const numericCandidate = Number(trimmed);
    return {
      numericValue: Number.isFinite(numericCandidate) && trimmed !== "" ? numericCandidate : undefined,
      rawValue: trimmed,
      text: trimmed || (settings.emptyText ?? DEFAULTS.emptyText)
    };
  }

  if (Array.isArray(rawValue) || (rawValue && typeof rawValue === "object")) {
    const compact = JSON.stringify(rawValue);
    return {
      rawValue: compact,
      text: compact.length > 34 ? `${compact.slice(0, 31)}...` : compact
    };
  }

  return {
    rawValue: null,
    text: settings.emptyText ?? DEFAULTS.emptyText
  };
}

function deriveTitle(settings: KnownActionSettings, titleValue: unknown): string {
  const titleText = trimText(settings.titleText);
  if (titleText) {
    return titleText;
  }

  if (titleValue === null || titleValue === undefined) {
    return "URL Data";
  }

  if (typeof titleValue === "string" && titleValue.trim()) {
    return titleValue.trim();
  }

  if (typeof titleValue === "number" || typeof titleValue === "boolean") {
    return String(titleValue);
  }

  return "URL Data";
}

function deriveSubtitle(settings: KnownActionSettings, subtitleValue: unknown, fetchedAt: Date): string | undefined {
  if (subtitleValue === null || subtitleValue === undefined || subtitleValue === "") {
    return `Updated ${formatShortTime(fetchedAt)}`;
  }

  if (typeof subtitleValue === "string") {
    return subtitleValue.trim() || `Updated ${formatShortTime(fetchedAt)}`;
  }

  if (typeof subtitleValue === "number" || typeof subtitleValue === "boolean") {
    return String(subtitleValue);
  }

  return `Updated ${formatShortTime(fetchedAt)}`;
}

function parseHeaders(settings: KnownActionSettings): HeadersInit | undefined {
  const rawHeaders = trimText(settings.headersJson);
  if (!rawHeaders) {
    return undefined;
  }

  const parsed = JSON.parse(rawHeaders) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Headers JSON must be an object.");
  }

  const headers = Object.entries(parsed as Record<string, unknown>)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => [key, String(value)]);

  return Object.fromEntries(headers);
}

export function createPlaceholderModel(settings: KnownActionSettings, message = "Add a URL and value path"): TileRenderModel {
  const inputHint = `${settings.dataUrl ?? ""} ${settings.valuePath ?? ""} ${settings.titleText ?? ""}`;
  return {
    accent: "neutral",
    iconHint: inferIconHint(inputHint),
    message,
    primaryRawValue: null,
    state: 0,
    statusText: "Idle",
    subtitle: trimText(settings.subtitlePath) ? `Path ${settings.subtitlePath}` : message,
    title: trimText(settings.titleText) ?? "URL Data",
    valueText: settings.emptyText ?? DEFAULTS.emptyText
  };
}

export function createErrorModel(settings: KnownActionSettings, error: unknown): TileRenderModel {
  const message = error instanceof Error ? error.message : String(error);
  return {
    accent: "danger",
    iconHint: "warning_amber",
    message,
    primaryRawValue: null,
    state: 0,
    statusText: "Fetch error",
    subtitle: message,
    title: trimText(settings.titleText) ?? "URL Data",
    valueText: "ERR"
  };
}

export async function fetchTileModel(settings: KnownActionSettings): Promise<TileRenderModel> {
  const dataUrl = trimText(settings.dataUrl);
  const valuePath = trimText(settings.valuePath);
  if (!dataUrl || !valuePath) {
    return createPlaceholderModel(settings);
  }

  const validatedUrl = new URL(dataUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULTS.requestTimeoutMs);

  try {
    const response = await fetch(validatedUrl, {
      headers: parseHeaders(settings),
      method: "GET",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Request failed with ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const rawValue = getValueAtPath(data, valuePath);
    const titleValue = getValueAtPath(data, trimText(settings.titlePath));
    const subtitleValue = getValueAtPath(data, trimText(settings.subtitlePath));
    const fetchedAt = new Date();
    const formattedValue = formatDisplayValue(rawValue, settings);
    const valueText = formattedValue.text || settings.emptyText || DEFAULTS.emptyText;
    const iconHint = inferIconHint(`${validatedUrl.hostname} ${valuePath} ${settings.titleText ?? ""}`);

    return {
      accent: "ok",
      iconHint,
      message: typeof rawValue === "string" || typeof rawValue === "number" ? String(rawValue) : undefined,
      primaryNumericValue: formattedValue.numericValue,
      primaryRawValue: formattedValue.rawValue,
      state: 1,
      statusText: `Updated ${formatShortTime(fetchedAt)}`,
      subtitle: deriveSubtitle(settings, subtitleValue, fetchedAt),
      title: deriveTitle(settings, titleValue),
      valueText
    };
  } finally {
    clearTimeout(timeout);
  }
}
