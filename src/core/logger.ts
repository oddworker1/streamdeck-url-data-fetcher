import streamDeck from "@elgato/streamdeck";

function maskSensitiveText(value: string): string {
  if (!value) {
    return value;
  }

  return value
    .replace(/([A-Fa-f0-9]{8})[A-Fa-f0-9-]{12,}/g, "$1***")
    .replace(/(Bearer\s+)[^\s]+/gi, "$1***");
}

function normalize(value: unknown): string {
  if (value instanceof Error) {
    return `${value.name}: ${maskSensitiveText(value.message)}`;
  }

  if (typeof value === "string") {
    return maskSensitiveText(value);
  }

  try {
    return maskSensitiveText(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

export const logger = {
  debug(message: string, details?: unknown) {
    streamDeck.logger.debug(details === undefined ? message : `${message} ${normalize(details)}`);
  },
  error(message: string, details?: unknown) {
    streamDeck.logger.error(details === undefined ? message : `${message} ${normalize(details)}`);
  },
  info(message: string, details?: unknown) {
    streamDeck.logger.info(details === undefined ? message : `${message} ${normalize(details)}`);
  },
  warn(message: string, details?: unknown) {
    streamDeck.logger.warn(details === undefined ? message : `${message} ${normalize(details)}`);
  }
};

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return maskSensitiveText(error.message);
  }

  return normalize(error);
}
