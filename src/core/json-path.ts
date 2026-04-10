const BRACKET_SEGMENT_PATTERN = /\[(\d+|".*?"|'.*?')\]/g;

function normalizeSegment(segment: string): string {
  const trimmed = segment.trim();
  if (!trimmed) {
    return "";
  }

  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\""))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

export function getValueAtPath(source: unknown, path: string | undefined): unknown {
  if (!path?.trim()) {
    return source;
  }

  const normalizedPath = path.trim().replace(/^\$\.?/, "").replace(BRACKET_SEGMENT_PATTERN, (_, segment) => `.${segment}`);
  const segments = normalizedPath.split(".").map(normalizeSegment).filter(Boolean);

  let current = source;
  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = Number.parseInt(segment, 10);
      if (!Number.isInteger(index)) {
        return undefined;
      }

      current = current[index];
      continue;
    }

    if (!current || typeof current !== "object") {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}
