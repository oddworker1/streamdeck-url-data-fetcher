import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const sourceDir = path.join(rootDir, "node_modules", "@material-design-icons", "svg", "filled");
const outputPath = path.join(rootDir, "src", "core", "material-icons.generated.ts");

const CATEGORY_OPTIONS = [
  { label: "Common", value: "common" },
  { label: "0-9", value: "0-9" },
  { label: "A-C", value: "a-c" },
  { label: "D-F", value: "d-f" },
  { label: "G-I", value: "g-i" },
  { label: "J-L", value: "j-l" },
  { label: "M-O", value: "m-o" },
  { label: "P-R", value: "p-r" },
  { label: "S-U", value: "s-u" },
  { label: "V-Z", value: "v-z" }
];

const COMMON_ICON_VALUES = new Set([
  "home",
  "dashboard",
  "dashboard_customize",
  "hub",
  "assistant",
  "lightbulb",
  "thermostat",
  "water_drop",
  "electric_bolt",
  "power_settings_new",
  "battery_full",
  "roller_shades",
  "sensor_door",
  "lock",
  "shield",
  "warning_amber",
  "wifi",
  "speaker",
  "cloud",
  "attach_money",
  "analytics",
  "settings_remote"
]);

const LABEL_OVERRIDES = {
  ac_unit: "AC",
  account_balance_wallet: "Bank Wallet",
  attach_money: "Money",
  battery_alert: "Battery Alert",
  battery_charging_full: "Charging Battery",
  battery_full: "Battery",
  battery_saver: "Battery Saver",
  brightness_high: "Brightness High",
  brightness_low: "Brightness Low",
  brightness_medium: "Brightness Mid",
  camera_indoor: "Indoor Cam",
  camera_outdoor: "Outdoor Cam",
  candlestick_chart: "Candlestick Chart",
  credit_card: "Credit Card",
  currency_bitcoin: "Bitcoin",
  currency_exchange: "Currency Exchange",
  dashboard_customize: "Dashboard Plus",
  device_thermostat: "Sensor Temp",
  devices_other: "Devices",
  door_back: "Back Door",
  door_front: "Front Door",
  door_sliding: "Sliding Door",
  donut_large: "Donut Large",
  donut_small: "Donut Small",
  electric_bolt: "Electric Bolt",
  electric_car: "EV Car",
  electrical_services: "Electrical",
  ev_station: "EV Charger",
  flash_off: "Flash Off",
  flash_on: "Flash On",
  health_and_safety: "Health & Safety",
  mode_fan_off: "Fan",
  mode_night: "Night Mode",
  monitor_heart: "Heart Monitor",
  motion_photos_off: "Motion Off",
  motion_photos_on: "Motion On",
  multiline_chart: "Multi Line Chart",
  network_check: "Network Check",
  network_ping: "Ping",
  network_wifi: "Network Wi-Fi",
  notifications_active: "Alerts",
  offline_bolt: "Offline Bolt",
  phonelink: "Phone Link",
  phonelink_lock: "Phone Lock",
  phonelink_ring: "Phone Ring",
  pie_chart: "Pie Chart",
  power_settings_new: "Power",
  price_check: "Price Check",
  query_stats: "Query Stats",
  receipt_long: "Receipt",
  roller_shades: "Roller Shade",
  roller_shades_closed: "Roller Closed",
  rss_feed: "RSS",
  security_update: "Security Update",
  sensor_door: "Door Sensor",
  sensor_window: "Window Sensor",
  settings_ethernet: "Ethernet",
  settings_remote: "Remote Control",
  show_chart: "Show Chart",
  shield_moon: "Night Shield",
  solar_power: "Solar",
  ssid_chart: "SSID Chart",
  stacked_bar_chart: "Bar Chart",
  stacked_line_chart: "Line Chart",
  view_sidebar: "Sidebar",
  warning_amber: "Warning",
  water_drop: "Water Drop",
  wb_sunny: "Sun"
};

function humanizeIconLabel(value) {
  const override = LABEL_OVERRIDES[value];
  if (override) {
    return override;
  }

  return value
    .split("_")
    .map((part) => (/^\d/.test(part) ? part.toUpperCase() : `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`))
    .join(" ");
}

async function readSvgBody(iconName) {
  const sourcePath = path.join(sourceDir, `${iconName}.svg`);
  const svg = await readFile(sourcePath, "utf8");
  const match = svg.match(/^<svg[^>]*>([\s\S]+)<\/svg>\s*$/);
  if (!match) {
    throw new Error(`Could not parse SVG markup for ${iconName}`);
  }

  return match[1].trim();
}

function categorizeIcon(iconName) {
  if (COMMON_ICON_VALUES.has(iconName)) {
    return "common";
  }

  const firstCharacter = iconName.slice(0, 1).toLowerCase();
  if (firstCharacter >= "0" && firstCharacter <= "9") {
    return "0-9";
  }
  if (firstCharacter >= "a" && firstCharacter <= "c") {
    return "a-c";
  }
  if (firstCharacter >= "d" && firstCharacter <= "f") {
    return "d-f";
  }
  if (firstCharacter >= "g" && firstCharacter <= "i") {
    return "g-i";
  }
  if (firstCharacter >= "j" && firstCharacter <= "l") {
    return "j-l";
  }
  if (firstCharacter >= "m" && firstCharacter <= "o") {
    return "m-o";
  }
  if (firstCharacter >= "p" && firstCharacter <= "r") {
    return "p-r";
  }
  if (firstCharacter >= "s" && firstCharacter <= "u") {
    return "s-u";
  }

  return "v-z";
}

async function generate() {
  const sourceEntries = await readdir(sourceDir, { withFileTypes: true });
  const iconNames = sourceEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".svg"))
    .map((entry) => entry.name.slice(0, -4))
    .sort((left, right) => left.localeCompare(right));

  const options = [];

  for (const value of iconNames) {
    options.push({
      body: await readSvgBody(value),
      category: categorizeIcon(value),
      label: humanizeIconLabel(value),
      value
    });
  }

  const serializedOptions = JSON.stringify(options);

  const file = `// Generated by scripts/generate-material-icons.mjs
// Source: @material-design-icons/svg filled set

export const ICON_CATEGORY_OPTIONS = ${JSON.stringify(CATEGORY_OPTIONS, null, 2)} as const;

export type IconCategory = typeof ICON_CATEGORY_OPTIONS[number]["value"];

export type MaterialIconOption = {
  body: string;
  category: IconCategory;
  label: string;
  value: string;
};

export const MATERIAL_ICON_OPTIONS = JSON.parse(
  String.raw\`${serializedOptions}\`
) as readonly MaterialIconOption[];

export const MATERIAL_ICON_MAP = new Map<string, MaterialIconOption>(
  MATERIAL_ICON_OPTIONS.map((option) => [option.value, option])
);

export function findMaterialIconOption(value: string | undefined): MaterialIconOption | undefined {
  return value ? MATERIAL_ICON_MAP.get(value) : undefined;
}
`;

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, file);
  console.log(`Wrote ${path.relative(rootDir, outputPath)} with ${options.length} icons.`);
}

generate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
