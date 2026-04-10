import { FREE_POLLING_OPTIONS_MINUTES } from "../core/constants.js";
import { createPlaceholderModel } from "../core/fetcher.js";
import { getVisibleIconOptions, ICON_CATEGORY_OPTIONS, ICON_GLYPH_OPTIONS, renderGlyph, renderKeyImage } from "../core/key-image.js";
import type { TileRenderModel } from "../core/render-model.js";
import { CURRENT_VARIANT, PLUGIN_VARIANT } from "../core/variant.js";
import { constrainSettingsForVariant, supportsLargeIconLibrary, supportsShortPolling } from "../core/variant-settings.js";
import type {
  ActionUuid,
  PropertyInspectorResponse,
  UrlDataSettings,
  WarningDurationUnit
} from "../types/settings.js";

type RegistrationInfo = {
  plugin: {
    uuid: string;
    version: string;
  };
};

type ActionInfo = {
  action: ActionUuid;
  context: string;
  payload: {
    settings: UrlDataSettings;
  };
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function selected(current: string | number | undefined, value: string | number): string {
  return current === value ? " selected" : "";
}

function checked(value: boolean | undefined): string {
  return value ? " checked" : "";
}

function colorValue(value: string | undefined, fallback: string): string {
  return /^#([0-9a-f]{6})$/i.test(value ?? "") ? value!.toLowerCase() : fallback;
}

function warningOptions() {
  return getVisibleIconOptions(undefined, "").filter((option) => option.value !== "auto");
}

function renderIconSwatch(glyph: string, color: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <rect x="2" y="2" width="60" height="60" rx="16" fill="#111a28" stroke="rgba(255,255,255,.08)" stroke-width="2"/>
      <g transform="translate(16 16) scale(1.333)">
        ${renderGlyph(glyph, color)}
      </g>
    </svg>
  `)}`;
}

function statusClass(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("error") || normalized.includes("failed")) {
    return "error";
  }
  if (normalized.includes("ready") || normalized.includes("completed") || normalized.includes("saved")) {
    return "ok";
  }
  if (normalized.includes("warning")) {
    return "warning";
  }
  return "";
}

class PropertyInspectorApp {
  private socket?: WebSocket;
  private registrationUuid = "";
  private info?: RegistrationInfo;
  private actionInfo?: ActionInfo;
  private preview: TileRenderModel = createPlaceholderModel({});
  private statusMessage = "Waiting for Stream Deck connection.";
  private iconSearch = "";
  private settingsTimer?: number;
  private previewTimer?: number;

  constructor(private readonly root: HTMLElement) {
    this.root.addEventListener("input", (event) => this.handleFieldEvent(event));
    this.root.addEventListener("change", (event) => this.handleFieldEvent(event));
    this.root.addEventListener("click", (event) => this.handleClick(event));
    this.render();
  }

  connect(socket: WebSocket, registrationUuid: string, info: RegistrationInfo, actionInfo: ActionInfo): void {
    this.socket = socket;
    this.registrationUuid = registrationUuid;
    this.info = info;
    this.actionInfo = {
      ...actionInfo,
      payload: {
        settings: constrainSettingsForVariant(actionInfo.payload.settings ?? {})
      }
    };
    this.preview = createPlaceholderModel(this.actionInfo.payload.settings);
    this.statusMessage = "Connected. Loading settings...";
    this.render();
    this.requestSettings();
    this.sendToPlugin("bootstrap");
  }

  handleSocketClosed(): void {
    this.socket = undefined;
    this.statusMessage = "Disconnected from Stream Deck.";
    this.render();
  }

  handleIncomingMessage(message: unknown): void {
    if (!message || typeof message !== "object" || !("event" in message) || !this.actionInfo) {
      return;
    }

    const eventName = (message as { event?: string }).event;

    if (eventName === "didReceiveSettings") {
      const payload = (message as { payload?: { settings?: UrlDataSettings } }).payload;
      this.actionInfo.payload.settings = constrainSettingsForVariant(payload?.settings ?? {});
      this.preview = createPlaceholderModel(this.actionInfo.payload.settings);
      this.statusMessage = "Settings loaded.";
      this.render();
      return;
    }

    if (eventName === "sendToPropertyInspector") {
      const payload = (message as { payload?: PropertyInspectorResponse }).payload;
      if (!payload || payload.actionContext !== this.actionInfo.context) {
        return;
      }

      if (payload.preview && typeof payload.preview === "object") {
        this.preview = payload.preview as TileRenderModel;
      }
      this.statusMessage = payload.message ?? (payload.ok ? "Preview ready." : "Preview failed.");
      this.render();
    }
  }

  private get settings(): UrlDataSettings {
    return this.actionInfo?.payload.settings ?? {};
  }

  private send(command: Record<string, unknown>): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(JSON.stringify(command));
  }

  private requestSettings(): void {
    if (!this.actionInfo) {
      return;
    }

    this.send({
      action: this.actionInfo.action,
      context: this.actionInfo.context,
      event: "getSettings"
    });
  }

  private scheduleSettingsSync(): void {
    if (this.settingsTimer) {
      window.clearTimeout(this.settingsTimer);
    }

    this.settingsTimer = window.setTimeout(() => {
      this.settingsTimer = undefined;
      this.sendSettings();
    }, 180);
  }

  private schedulePreview(): void {
    if (this.previewTimer) {
      window.clearTimeout(this.previewTimer);
    }

    this.previewTimer = window.setTimeout(() => {
      this.previewTimer = undefined;
      this.sendToPlugin("preview");
    }, 350);
  }

  private sendSettings(): void {
    if (!this.actionInfo) {
      return;
    }

    this.send({
      action: this.actionInfo.action,
      context: this.actionInfo.context,
      event: "setSettings",
      payload: this.settings
    });
  }

  private sendToPlugin(type: "bootstrap" | "preview" | "run-test"): void {
    if (!this.actionInfo) {
      return;
    }

    this.send({
      action: this.actionInfo.action,
      context: this.actionInfo.context,
      event: "sendToPlugin",
      payload: {
        settings: this.settings,
        type
      }
    });
  }

  private updateSetting(key: keyof UrlDataSettings, value: unknown): void {
    if (!this.actionInfo) {
      return;
    }

    const next = { ...this.settings } as Record<string, unknown>;
    if (value === undefined || value === null || value === "") {
      delete next[key];
    } else {
      next[key] = value;
    }

    this.actionInfo.payload.settings = constrainSettingsForVariant(next as UrlDataSettings);
  }

  private handleFieldEvent(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) {
      return;
    }

    if (target.dataset.iconSearch !== undefined) {
      this.iconSearch = target.value;
      this.render();
      return;
    }

    const setting = target.dataset.setting as keyof UrlDataSettings | undefined;
    if (!setting) {
      return;
    }

    let value: unknown;
    if (target instanceof HTMLInputElement && target.type === "checkbox") {
      value = target.checked;
    } else if (target.dataset.number === "true") {
      const parsed = Number(target.value);
      value = Number.isFinite(parsed) ? parsed : undefined;
    } else {
      value = target.value.trim();
    }

    this.updateSetting(setting, value);
    this.preview = createPlaceholderModel(this.settings);
    this.statusMessage = "Settings updated.";
    this.scheduleSettingsSync();
    this.schedulePreview();

    const renderNow = target.dataset.render === "true"
      || target instanceof HTMLSelectElement
      || (target instanceof HTMLInputElement && (target.type === "checkbox" || target.type === "color"));

    if (renderNow) {
      this.render();
    }
  }

  private handleClick(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const command = target.dataset.command;
    if (!command) {
      return;
    }

    switch (command) {
      case "preview":
        this.statusMessage = "Refreshing preview...";
        this.sendToPlugin("preview");
        this.render();
        break;
      case "run-test":
        this.statusMessage = "Running test fetch...";
        this.sendToPlugin("run-test");
        this.render();
        break;
      default:
        break;
    }
  }

  private renderPollingFields(): string {
    if (supportsShortPolling()) {
      return `
        <div class="field">
          <label for="polling-value">Refresh Every</label>
          <input id="polling-value" data-setting="pollingValue" data-number="true" inputmode="decimal" type="text" value="${escapeHtml(this.settings.pollingValue ?? 30)}" />
        </div>
        <div class="field">
          <label for="polling-unit">Unit</label>
          <select id="polling-unit" data-setting="pollingUnit" data-render="true">
            <option value="seconds"${selected(this.settings.pollingUnit ?? "seconds", "seconds")}>Seconds</option>
            <option value="minutes"${selected(this.settings.pollingUnit, "minutes")}>Minutes</option>
          </select>
        </div>
      `;
    }

    return `
      <div class="field full">
        <label for="polling-value">Refresh Every</label>
        <select id="polling-value" data-setting="pollingValue" data-render="true">
          ${FREE_POLLING_OPTIONS_MINUTES.map((value) => `<option value="${value}"${selected(this.settings.pollingValue ?? 5, value)}>${value} minutes</option>`).join("")}
        </select>
        <small>Free builds refresh every 5 minutes or longer.</small>
      </div>
    `;
  }

  private renderWarningFields(direction: "Over" | "Under"): string {
    const key = direction === "Over" ? "warningOver" : "warningUnder";
    const enabled = Boolean(this.settings[`${key}Enabled` as keyof UrlDataSettings]);
    const flash = Boolean(this.settings[`${key}Flash` as keyof UrlDataSettings]);
    const iconGlyph = (this.settings[`${key}IconGlyph` as keyof UrlDataSettings] as string | undefined) ?? "warning_amber";
    const options = warningOptions();

    return `
      <div class="warning-shell">
        <div class="section-head">
          <div>
            <h3>${direction} Threshold</h3>
            <div class="section-copy">Flash when the fetched numeric value moves ${direction === "Over" ? "above" : "below"} the threshold.</div>
          </div>
        </div>
        <label class="toggle-row">
          <input data-setting="${key}Enabled" type="checkbox"${checked(enabled)} />
          <span>Enable ${direction.toLowerCase()} warning</span>
        </label>
        <div class="grid">
          <div class="field">
            <label for="${key}-threshold">Threshold</label>
            <input id="${key}-threshold" data-setting="${key}Threshold" data-number="true" inputmode="decimal" type="text" value="${escapeHtml(this.settings[`${key}Threshold` as keyof UrlDataSettings] ?? "")}" />
          </div>
          <div class="field">
            <label for="${key}-icon">Icon</label>
            <select id="${key}-icon" data-setting="${key}IconGlyph" data-render="true">
              ${options.map((option) => `<option value="${escapeHtml(option.value)}"${selected(iconGlyph, option.value)}>${escapeHtml(option.label)}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label for="${key}-bg">Warning Bg</label>
            <input id="${key}-bg" data-setting="${key}BackgroundColor" type="color" value="${colorValue(this.settings[`${key}BackgroundColor` as keyof UrlDataSettings] as string | undefined, direction === "Over" ? "#4a1f23" : "#2d2148")}" />
          </div>
          <div class="field">
            <label for="${key}-text">Warning Text</label>
            <input id="${key}-text" data-setting="${key}TextColor" type="color" value="${colorValue(this.settings[`${key}TextColor` as keyof UrlDataSettings] as string | undefined, "#fff3f5")}" />
          </div>
          <div class="field">
            <label for="${key}-icon-color">Icon Color</label>
            <input id="${key}-icon-color" data-setting="${key}IconColor" type="color" value="${colorValue(this.settings[`${key}IconColor` as keyof UrlDataSettings] as string | undefined, "#ffcf7c")}" />
          </div>
          <div class="field">
            <label for="${key}-icon-size">Icon Size</label>
            <input id="${key}-icon-size" data-setting="${key}IconSize" data-number="true" inputmode="numeric" type="text" value="${escapeHtml(this.settings[`${key}IconSize` as keyof UrlDataSettings] ?? 18)}" />
          </div>
        </div>
        <label class="toggle-row">
          <input data-setting="${key}Flash" type="checkbox"${checked(flash)} />
          <span>Flash tile</span>
        </label>
        <div class="grid">
          <div class="field">
            <label for="${key}-flash-interval">Flash Every (ms)</label>
            <input id="${key}-flash-interval" data-setting="${key}FlashIntervalMs" data-number="true" inputmode="numeric" type="text" value="${escapeHtml(this.settings[`${key}FlashIntervalMs` as keyof UrlDataSettings] ?? 900)}" />
          </div>
          <div class="field">
            <label for="${key}-flash-duration">Flash For</label>
            <input id="${key}-flash-duration" data-setting="${key}FlashDuration" data-number="true" inputmode="decimal" type="text" value="${escapeHtml(this.settings[`${key}FlashDuration` as keyof UrlDataSettings] ?? "")}" />
          </div>
          <div class="field">
            <label for="${key}-flash-unit">Duration Unit</label>
            <select id="${key}-flash-unit" data-setting="${key}FlashDurationUnit" data-render="true">
              <option value="seconds"${selected(((this.settings[`${key}FlashDurationUnit` as keyof UrlDataSettings] as string | undefined) ?? "seconds"), "seconds")}>Seconds</option>
              <option value="minutes"${selected((this.settings[`${key}FlashDurationUnit` as keyof UrlDataSettings] as string | undefined), "minutes")}>Minutes</option>
            </select>
          </div>
        </div>
      </div>
    `;
  }

  private render(): void {
    const selectedGlyph = (this.settings.iconGlyph as string | undefined) ?? "auto";
    const previewModel = this.preview ?? createPlaceholderModel(this.settings);
    const iconOptions = getVisibleIconOptions((this.settings.iconCategory as string | undefined) ?? "common", this.iconSearch);
    const iconPreviewGlyph = selectedGlyph === "auto" ? previewModel.iconHint ?? "query_stats" : selectedGlyph;
    const iconColor = colorValue(this.settings.iconColor, "#53c8ff");
    const previewImage = renderKeyImage(this.settings, previewModel);

    this.root.innerHTML = `
      <div class="app">
        <section class="hero">
          <div class="hero-top">
            <div>
              <div class="eyebrow">${escapeHtml(CURRENT_VARIANT === "premium" ? "Premium Variant" : "Free Variant")}</div>
              <h1>URL Data Fetcher</h1>
              <p>Point a tile at JSON, choose the path you care about, and flash the key when numbers drift outside the range you set.</p>
            </div>
            <div class="variant-pill">${escapeHtml(PLUGIN_VARIANT.marketplaceVariantLabel)}</div>
          </div>
          <div class="status-pill ${statusClass(this.statusMessage)}">${escapeHtml(this.statusMessage)}</div>
        </section>

        <section class="section">
          <div class="section-head">
            <div>
              <h2>Data Source</h2>
              <div class="section-copy">Fetch JSON with optional headers, then map the fields you want to display.</div>
            </div>
          </div>
          <div class="grid">
            <div class="field full">
              <label for="data-url">JSON URL</label>
              <input id="data-url" data-setting="dataUrl" type="url" value="${escapeHtml(this.settings.dataUrl ?? "")}" />
            </div>
            <div class="field full">
              <label for="headers-json">Headers JSON</label>
              <textarea id="headers-json" data-setting="headersJson" spellcheck="false">${escapeHtml(this.settings.headersJson ?? "")}</textarea>
              <small>Optional object, for example {"Authorization":"Bearer token"}.</small>
            </div>
            <div class="field">
              <label for="value-path">Value Path</label>
              <input id="value-path" data-setting="valuePath" spellcheck="false" type="text" value="${escapeHtml(this.settings.valuePath ?? "")}" />
            </div>
            <div class="field">
              <label for="title-text">Static Title</label>
              <input id="title-text" data-setting="titleText" type="text" value="${escapeHtml(this.settings.titleText ?? "")}" />
            </div>
            <div class="field">
              <label for="title-path">Title Path</label>
              <input id="title-path" data-setting="titlePath" spellcheck="false" type="text" value="${escapeHtml(this.settings.titlePath ?? "")}" />
            </div>
            <div class="field">
              <label for="subtitle-path">Subtitle Path</label>
              <input id="subtitle-path" data-setting="subtitlePath" spellcheck="false" type="text" value="${escapeHtml(this.settings.subtitlePath ?? "")}" />
            </div>
            <div class="field">
              <label for="unit-text">Unit</label>
              <input id="unit-text" data-setting="unitText" type="text" value="${escapeHtml(this.settings.unitText ?? "")}" />
            </div>
            <div class="field">
              <label for="decimals">Decimals</label>
              <input id="decimals" data-setting="decimals" data-number="true" inputmode="numeric" type="text" value="${escapeHtml(this.settings.decimals ?? "")}" />
            </div>
            <div class="field full">
              <label for="empty-text">Empty State Text</label>
              <input id="empty-text" data-setting="emptyText" type="text" value="${escapeHtml(this.settings.emptyText ?? "--")}" />
            </div>
          </div>
        </section>

        <section class="section">
          <div class="section-head">
            <div>
              <h2>Behavior</h2>
              <div class="section-copy">${supportsShortPolling() ? "Premium tiles can refresh in seconds or minutes." : "Free tiles refresh every 5 minutes or longer."}</div>
            </div>
          </div>
          <div class="grid">
            ${this.renderPollingFields()}
            <div class="field full">
              <label for="click-url">Open This URL On Press</label>
              <input id="click-url" data-setting="clickUrl" type="url" value="${escapeHtml(this.settings.clickUrl ?? "")}" />
              <small>Leave empty to make the key press trigger a manual refresh instead.</small>
            </div>
          </div>
        </section>

        <section class="section">
          <div class="section-head">
            <div>
              <h2>Appearance</h2>
              <div class="section-copy">${supportsLargeIconLibrary() ? "Premium includes the full icon library." : "Free includes a focused icon set."}</div>
            </div>
          </div>
          <div class="stack">
            <div class="grid">
              <div class="field">
                <label for="background-color">Background</label>
                <input id="background-color" data-setting="backgroundColor" type="color" value="${colorValue(this.settings.backgroundColor, "#121b28")}" />
              </div>
              <div class="field">
                <label for="value-color">Value</label>
                <input id="value-color" data-setting="valueColor" type="color" value="${colorValue(this.settings.valueColor, "#f5fbff")}" />
              </div>
              <div class="field">
                <label for="label-color">Label</label>
                <input id="label-color" data-setting="labelColor" type="color" value="${colorValue(this.settings.labelColor, "#b8c7d8")}" />
              </div>
              <div class="field">
                <label for="subtitle-color">Subtitle</label>
                <input id="subtitle-color" data-setting="subtitleColor" type="color" value="${colorValue(this.settings.subtitleColor, "#8da3b8")}" />
              </div>
            </div>

            <div class="divider"></div>

            <div class="icon-layout">
              <div class="icon-side">
                <div class="grid">
                  <div class="field">
                    <label for="icon-category">Icon Category</label>
                    <select id="icon-category" data-setting="iconCategory" data-render="true">
                      ${ICON_CATEGORY_OPTIONS.map((option) => `<option value="${escapeHtml(option.value)}"${selected((this.settings.iconCategory as string | undefined) ?? "common", option.value)}>${escapeHtml(option.label)}</option>`).join("")}
                    </select>
                  </div>
                  <div class="field">
                    <label for="icon-search">Search</label>
                    <input id="icon-search" data-icon-search="true" type="text" value="${escapeHtml(this.iconSearch)}" />
                  </div>
                  <div class="field">
                    <label for="icon-size">Icon Size</label>
                    <input id="icon-size" data-setting="iconSize" data-number="true" inputmode="numeric" type="text" value="${escapeHtml(this.settings.iconSize ?? 28)}" />
                  </div>
                  <div class="field">
                    <label for="icon-color">Icon Color</label>
                    <input id="icon-color" data-setting="iconColor" type="color" value="${iconColor}" />
                  </div>
                </div>
                <div class="field">
                  <label for="icon-glyph">Icon</label>
                  <select class="icon-list" id="icon-glyph" data-setting="iconGlyph" data-render="true" size="10">
                    ${iconOptions.map((option) => `<option value="${escapeHtml(option.value)}"${selected(selectedGlyph, option.value)}>${escapeHtml(option.label)}</option>`).join("")}
                  </select>
                </div>
              </div>
              <div class="icon-preview">
                <img alt="Icon preview" src="${renderIconSwatch(iconPreviewGlyph, iconColor)}" />
              </div>
            </div>
          </div>
        </section>

        <section class="section">
          <div class="section-head">
            <div>
              <h2>Warnings</h2>
              <div class="section-copy">Use over and under thresholds to flash the tile when the numeric value moves outside the expected range.</div>
            </div>
          </div>
          <div class="stack">
            ${this.renderWarningFields("Over")}
            ${this.renderWarningFields("Under")}
          </div>
        </section>

        <section class="section preview-panel">
          <div class="section-head">
            <div>
              <h2>Preview</h2>
              <div class="section-copy">Preview uses the plugin runtime so APIs that need non-browser fetches still validate correctly.</div>
            </div>
          </div>
          <div class="preview-layout">
            <div class="preview-frame">
              <img alt="Tile preview" src="${previewImage}" />
            </div>
            <div class="preview-meta">
              <strong>${escapeHtml(previewModel.title)}</strong>
              <span>${escapeHtml(previewModel.valueText)}</span>
              <span>${escapeHtml(previewModel.subtitle ?? previewModel.statusText ?? "No live value yet.")}</span>
            </div>
          </div>
          <div class="preview-actions">
            <button data-command="preview" type="button">Refresh Preview</button>
            <button class="secondary" data-command="run-test" type="button">Test Fetch</button>
          </div>
        </section>
      </div>
    `;
  }
}

const root = document.getElementById("app");
if (!root) {
  throw new Error("Property inspector root element was not found.");
}

const app = new PropertyInspectorApp(root);

declare global {
  interface Window {
    connectElgatoStreamDeckSocket?: (
      port: string,
      uuid: string,
      event: string,
      info: string,
      actionInfo: string
    ) => void;
  }
}

window.connectElgatoStreamDeckSocket = (port, uuid, event, info, actionInfo) => {
  const registrationInfo = JSON.parse(info) as RegistrationInfo;
  const parsedActionInfo = JSON.parse(actionInfo) as ActionInfo;

  const openSocket = () => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}`);

    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ event, uuid }));
      app.connect(socket, uuid, registrationInfo, parsedActionInfo);
    });

    socket.addEventListener("message", (messageEvent) => {
      try {
        app.handleIncomingMessage(JSON.parse(String(messageEvent.data)));
      } catch {
        // Ignore malformed payloads.
      }
    });

    socket.addEventListener("close", () => {
      app.handleSocketClosed();
      window.setTimeout(openSocket, 1_000);
    });
  };

  openSocket();
};
