import {
  type KeyAction,
  type KeyDownEvent,
  type SendToPluginEvent,
  type WillAppearEvent,
  type WillDisappearEvent,
  type DidReceiveSettingsEvent,
  SingletonAction
} from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";

import { ACTION_UUIDS } from "../core/constants.js";
import { urlDataBroker } from "../core/data-broker.js";
import { renderKeyImage } from "../core/key-image.js";
import { logger, getErrorMessage } from "../core/logger.js";
import { constrainSettingsForVariant } from "../core/variant-settings.js";
import type { TileRenderModel } from "../core/render-model.js";
import type { ActionUuid, PropertyInspectorRequest, PropertyInspectorResponse, UrlDataSettings } from "../types/settings.js";

export class DisplayUrlDataAction extends SingletonAction<UrlDataSettings> {
  override readonly manifestId: ActionUuid = ACTION_UUIDS.displayUrlData;

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<UrlDataSettings>): Promise<void> {
    const nextSettings = constrainSettingsForVariant(ev.payload.settings);
    if (JSON.stringify(nextSettings) !== JSON.stringify(ev.payload.settings)) {
      await ev.action.setSettings(nextSettings);
    }
    urlDataBroker.update(ev.action.id, nextSettings);
  }

  override async onWillAppear(ev: WillAppearEvent<UrlDataSettings>): Promise<void> {
    if (!ev.action.isKey()) {
      return;
    }

    const nextSettings = constrainSettingsForVariant(ev.payload.settings);
    if (JSON.stringify(nextSettings) !== JSON.stringify(ev.payload.settings)) {
      await ev.action.setSettings(nextSettings);
    }

    const keyAction = ev.action;
    urlDataBroker.subscribe(keyAction.id, nextSettings, async (model, settings) => {
      await this.applyRender(keyAction, model, settings);
    });
  }

  override async onWillDisappear(ev: WillDisappearEvent<UrlDataSettings>): Promise<void> {
    urlDataBroker.unsubscribe(ev.action.id);
  }

  override async onKeyDown(ev: KeyDownEvent<UrlDataSettings>): Promise<void> {
    const settings = constrainSettingsForVariant(ev.payload.settings);

    try {
      const clickUrl = typeof settings.clickUrl === "string" && settings.clickUrl.trim()
        ? new URL(settings.clickUrl.trim()).toString()
        : undefined;

      if (clickUrl) {
        await streamDeck.system.openUrl(clickUrl);
      } else {
        await urlDataBroker.forceRefresh(ev.action.id);
      }

      await ev.action.showOk();
    } catch (error) {
      logger.warn("key press failed", error);
      await ev.action.showAlert();
    }
  }

  override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, UrlDataSettings>): Promise<void> {
    const request = ev.payload as PropertyInspectorRequest;
    const settings = constrainSettingsForVariant(request?.settings ?? {});

    const response: PropertyInspectorResponse = {
      actionContext: ev.action.id,
      actionId: this.manifestId,
      ok: true,
      type: "preview-result"
    };

    try {
      const preview = await urlDataBroker.preview(settings);
      response.preview = preview;
      response.message = request.type === "run-test"
        ? "Test fetch completed."
        : request.type === "bootstrap"
          ? "Preview ready."
          : "Preview refreshed.";
    } catch (error) {
      response.ok = false;
      response.message = getErrorMessage(error);
    }

    await streamDeck.ui.sendToPropertyInspector(response);
  }

  private async applyRender(action: KeyAction<UrlDataSettings>, model: TileRenderModel, settings: UrlDataSettings): Promise<void> {
    try {
      await action.setImage(renderKeyImage(settings, model));
      await action.setTitle("");
      await action.setState(model.state);
    } catch (error) {
      logger.warn("failed to render key image", { error: getErrorMessage(error) });
    }
  }
}
