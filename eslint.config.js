import { config as elgato } from "@elgato/eslint-config";

export default [
  ...elgato.recommended,
  {
    ignores: [
      "com.zeuz.homey.sdPlugin/**",
      "node_modules/**"
    ]
  }
];
