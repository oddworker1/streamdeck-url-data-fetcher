import type { JsonObject } from "@elgato/utils";

import { ACTION_UUIDS } from "../core/constants.js";

export type ActionUuid = typeof ACTION_UUIDS[keyof typeof ACTION_UUIDS];
export type IconGlyph = string;
export type PollingUnit = "minutes" | "seconds";
export type WarningDurationUnit = "minutes" | "seconds";

export interface UrlDataSettings extends JsonObject {
  backgroundColor?: string;
  clickUrl?: string;
  dataUrl?: string;
  decimals?: number;
  emptyText?: string;
  headersJson?: string;
  iconCategory?: string;
  iconColor?: string;
  iconGlyph?: IconGlyph;
  iconSize?: number;
  labelColor?: string;
  pollingUnit?: PollingUnit;
  pollingValue?: number;
  subtitleColor?: string;
  subtitlePath?: string;
  titlePath?: string;
  titleText?: string;
  unitText?: string;
  valueColor?: string;
  valuePath?: string;
  warningOverBackgroundColor?: string;
  warningOverEnabled?: boolean;
  warningOverFlash?: boolean;
  warningOverFlashDuration?: number;
  warningOverFlashDurationUnit?: WarningDurationUnit;
  warningOverFlashIntervalMs?: number;
  warningOverIconColor?: string;
  warningOverIconGlyph?: IconGlyph;
  warningOverIconSize?: number;
  warningOverTextColor?: string;
  warningOverThreshold?: number;
  warningUnderBackgroundColor?: string;
  warningUnderEnabled?: boolean;
  warningUnderFlash?: boolean;
  warningUnderFlashDuration?: number;
  warningUnderFlashDurationUnit?: WarningDurationUnit;
  warningUnderFlashIntervalMs?: number;
  warningUnderIconColor?: string;
  warningUnderIconGlyph?: IconGlyph;
  warningUnderIconSize?: number;
  warningUnderTextColor?: string;
  warningUnderThreshold?: number;
}

export type KnownActionSettings = UrlDataSettings;

export type PropertyInspectorRequest =
  | { type: "bootstrap"; settings: UrlDataSettings }
  | { type: "preview"; settings: UrlDataSettings }
  | { type: "run-test"; settings: UrlDataSettings };

export interface PropertyInspectorResponse extends JsonObject {
  actionContext: string;
  actionId: ActionUuid;
  message?: string;
  ok: boolean;
  preview?: JsonObject;
  type: "preview-result";
}
