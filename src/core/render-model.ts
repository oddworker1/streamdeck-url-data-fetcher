import type { JsonObject } from "@elgato/utils";

export type TileAccent = "danger" | "neutral" | "ok" | "warning";

export interface WarningPresentation extends JsonObject {
  backgroundColor?: string;
  direction: "over" | "under";
  iconColor?: string;
  iconGlyph?: string;
  iconSize?: number;
  textColor?: string;
}

export interface TileRenderModel extends JsonObject {
  accent: TileAccent;
  iconHint?: string;
  message?: string;
  primaryNumericValue?: number;
  primaryRawValue?: boolean | number | string | null;
  state: 0 | 1;
  statusText?: string;
  subtitle?: string;
  title: string;
  valueText: string;
  warning?: WarningPresentation;
}
