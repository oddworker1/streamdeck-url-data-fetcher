import streamDeck from "@elgato/streamdeck";

import { DisplayUrlDataAction } from "../actions/display-url-data.js";
import { logger } from "../core/logger.js";
import { supportsActionKey } from "../core/variant.js";

async function main(): Promise<void> {
  if (supportsActionKey("displayUrlData")) {
    streamDeck.actions.registerAction(new DisplayUrlDataAction());
  }

  await streamDeck.connect();
  logger.info("URL Data Fetcher connected to Stream Deck");
}

void main().catch((error) => {
  logger.error("plugin startup failed", error);
});
