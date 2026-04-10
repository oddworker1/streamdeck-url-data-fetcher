import { fetchTileModel, createErrorModel, createPlaceholderModel } from "./fetcher.js";
import { logger } from "./logger.js";
import { getPollingIntervalMs } from "./variant-settings.js";
import { applyWarningState, hasActiveWarningAnimation, type WarningDirection, type WarningRuntimeState } from "./warning-state.js";
import type { TileRenderModel } from "./render-model.js";
import type { KnownActionSettings } from "../types/settings.js";

type Listener = (model: TileRenderModel, settings: KnownActionSettings) => Promise<void> | void;

type Subscription = {
  context: string;
  inFlight: boolean;
  listener: Listener;
  model: TileRenderModel;
  nextRefreshAt: number;
  settings: KnownActionSettings;
  warningRuntime: Record<WarningDirection, WarningRuntimeState>;
};

export class UrlDataBroker {
  private pollTimer?: NodeJS.Timeout;
  private readonly subscriptions = new Map<string, Subscription>();

  subscribe(context: string, settings: KnownActionSettings, listener: Listener): void {
    this.subscriptions.set(context, {
      context,
      inFlight: false,
      listener,
      model: createPlaceholderModel(settings),
      nextRefreshAt: Date.now(),
      settings,
      warningRuntime: {
        over: { active: false, settled: false },
        under: { active: false, settled: false }
      }
    });
    this.ensureTimer();
    void this.emit(context);
  }

  unsubscribe(context: string): void {
    this.subscriptions.delete(context);
    if (this.subscriptions.size === 0 && this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  update(context: string, settings: KnownActionSettings): void {
    const subscription = this.subscriptions.get(context);
    if (!subscription) {
      return;
    }

    subscription.settings = settings;
    subscription.nextRefreshAt = Date.now();
    if (!subscription.inFlight) {
      void this.refreshOne(subscription);
    }
  }

  async forceRefresh(context: string): Promise<TileRenderModel> {
    const subscription = this.subscriptions.get(context);
    if (!subscription) {
      throw new Error("Action is not subscribed.");
    }

    await this.refreshOne(subscription);
    return subscription.model;
  }

  async preview(settings: KnownActionSettings): Promise<TileRenderModel> {
    try {
      const baseModel = await fetchTileModel(settings);
      return applyWarningState(settings, baseModel, {
        over: { active: false, settled: false },
        under: { active: false, settled: false }
      }, Date.now());
    } catch (error) {
      logger.warn("preview fetch failed", error);
      return createErrorModel(settings, error);
    }
  }

  private ensureTimer(): void {
    if (this.pollTimer) {
      return;
    }

    this.pollTimer = setInterval(() => {
      void this.onTick();
    }, 100);
  }

  private async onTick(): Promise<void> {
    const now = Date.now();
    const refreshes = Array.from(this.subscriptions.values()).filter((subscription) => !subscription.inFlight && now >= subscription.nextRefreshAt);
    const flashing = Array.from(this.subscriptions.values()).filter((subscription) =>
      hasActiveWarningAnimation(subscription.settings, subscription.warningRuntime, now)
    );

    await Promise.all(refreshes.map((subscription) => this.refreshOne(subscription)));
    await Promise.all(flashing.map((subscription) => this.emit(subscription.context)));
  }

  private async refreshOne(subscription: Subscription): Promise<void> {
    subscription.inFlight = true;
    subscription.nextRefreshAt = Date.now() + getPollingIntervalMs(subscription.settings);

    try {
      subscription.model = await fetchTileModel(subscription.settings);
    } catch (error) {
      logger.warn("live fetch failed", error);
      subscription.model = createErrorModel(subscription.settings, error);
    } finally {
      subscription.inFlight = false;
    }

    await this.emit(subscription.context);
  }

  private async emit(context: string): Promise<void> {
    const subscription = this.subscriptions.get(context);
    if (!subscription) {
      return;
    }

    const rendered = applyWarningState(subscription.settings, subscription.model, subscription.warningRuntime, Date.now());
    await subscription.listener(rendered, subscription.settings);
  }
}

export const urlDataBroker = new UrlDataBroker();
