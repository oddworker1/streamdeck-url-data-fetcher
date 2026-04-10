export const ACTION_DEFINITIONS = [
  {
    icon: "display-json-value",
    key: "displayUrlData",
    multiAction: true,
    name: "Display URL Data",
    suffix: "display-url-data",
    tooltip: "Fetch a JSON endpoint, show a selected value, and optionally open a URL on press."
  }
];

export const VARIANTS = {
  free: {
    category: "URL Data Fetcher",
    description: "Track JSON endpoints with 5+ minute refresh, warning flashes, and quick-link actions.",
    displayName: "URL Data Fetcher",
    enabledActionKeys: ["displayUrlData"],
    marketplaceVariantLabel: "Free",
    packageFileName: "com.zeuz.urldatafetcher.streamDeckPlugin",
    pluginDirName: "com.zeuz.urldatafetcher.sdPlugin",
    pluginUuid: "com.zeuz.urldatafetcher",
    supportUrl: "https://github.com/oddworker1/streamdeck-url-data-fetcher"
  },
  premium: {
    category: "URL Data Fetcher Pro",
    description: "High-frequency JSON monitoring with a full icon library, live warning flashes, and premium tile control.",
    displayName: "URL Data Fetcher Pro",
    enabledActionKeys: ["displayUrlData"],
    marketplaceVariantLabel: "Pro",
    packageFileName: "com.zeuz.urldatafetcher.pro.streamDeckPlugin",
    pluginDirName: "com.zeuz.urldatafetcher.pro.sdPlugin",
    pluginUuid: "com.zeuz.urldatafetcher.pro",
    supportUrl: "https://github.com/oddworker1/streamdeck-url-data-fetcher"
  }
};
