declare const __PLUGIN_VARIANT__: "free" | "premium";

export const ACTION_SUFFIXES = {
  displayUrlData: "display-url-data"
} as const;

export type ActionKey = keyof typeof ACTION_SUFFIXES;
export type VariantFeature = "largeIconLibrary" | "shortPolling";
export type PluginVariant = "free" | "premium";

type VariantConfig = {
  categoryName: string;
  displayName: string;
  enabledActionKeys: readonly ActionKey[];
  features: Record<VariantFeature, boolean>;
  marketplaceVariantLabel: string;
  pluginUuid: string;
  shortDescription: string;
};

const VARIANT_CONFIGS: Record<PluginVariant, VariantConfig> = {
  free: {
    categoryName: "URL Data Fetcher",
    displayName: "URL Data Fetcher",
    enabledActionKeys: ["displayUrlData"],
    features: {
      largeIconLibrary: false,
      shortPolling: false
    },
    marketplaceVariantLabel: "Free",
    pluginUuid: "com.zeuz.urldatafetcher",
    shortDescription: "Monitor JSON endpoints with clean, warning-aware Stream Deck tiles."
  },
  premium: {
    categoryName: "URL Data Fetcher Pro",
    displayName: "URL Data Fetcher Pro",
    enabledActionKeys: ["displayUrlData"],
    features: {
      largeIconLibrary: true,
      shortPolling: true
    },
    marketplaceVariantLabel: "Pro",
    pluginUuid: "com.zeuz.urldatafetcher.pro",
    shortDescription: "High-frequency JSON monitoring with the full icon library and premium controls."
  }
};

function readVariant(): PluginVariant {
  return __PLUGIN_VARIANT__ === "premium" ? "premium" : "free";
}

export const CURRENT_VARIANT = readVariant();
export const PLUGIN_VARIANT = VARIANT_CONFIGS[CURRENT_VARIANT];

export function hasVariantFeature(feature: VariantFeature): boolean {
  return PLUGIN_VARIANT.features[feature];
}

export function supportsActionKey(key: ActionKey): boolean {
  return PLUGIN_VARIANT.enabledActionKeys.includes(key);
}
