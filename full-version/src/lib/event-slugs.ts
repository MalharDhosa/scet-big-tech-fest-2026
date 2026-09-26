import type { FestEvent } from "./fest-state";

/**
 * Standardized mapping for known festival events to clean, short URL slugs.
 */
const KNOWN_SLUG_MAP: Record<string, string> = {
  "codathon": "codathon",
  "aws builder challenge": "aws-builder-challenge",
  "it quiz": "it-quiz",
  "cyber quiz": "cyber-quiz",
  "py-it": "py-it",
  "py-it — practice your interview technique": "py-it",
  "practice your interview technique": "py-it",
  "bug buzz": "bug-buzz",
  "logo hunt": "logo-hunt",
  "brick bot battle": "brick-bot-battle",
  "ai model clash": "ai-model-clash",
  "data dig": "data-dig",
  "prompt forge": "prompt-forge",
};

/**
 * Converts any event title or string to a URL-safe lowercase slug.
 * Prioritizes known event mappings, and handles arbitrary custom event titles.
 */
export function toEventSlug(titleOrStr?: string | null): string {
  if (!titleOrStr) return "event";
  const cleaned = titleOrStr.trim().toLowerCase();

  // 1. Check known mapping
  if (KNOWN_SLUG_MAP[cleaned]) {
    return KNOWN_SLUG_MAP[cleaned]!;
  }

  // Check prefix match (e.g. "PY-IT — ...")
  for (const [key, slug] of Object.entries(KNOWN_SLUG_MAP)) {
    if (cleaned.startsWith(key) || cleaned.includes(key)) {
      return slug;
    }
  }

  // 2. Generic slugification
  return cleaned
    .replace(/[^\w\s-]/g, "") // Remove non-word characters except dashes/spaces
    .replace(/[\s_-]+/g, "-") // Replace spaces, underscores, and dashes with a single dash
    .replace(/^-+|-+$/g, ""); // Trim leading/trailing dashes
}

/**
 * Returns the canonical URL slug for an event.
 */
export function getEventSlug(event: { id?: string; title?: string; slug?: string }): string {
  if (event.slug) return toEventSlug(event.slug);
  if (event.title) return toEventSlug(event.title);
  if (event.id) return toEventSlug(event.id);
  return "event";
}

/**
 * Finds an event in an array of FestEvents by matching against:
 * 1. Title-derived slug (e.g., "codathon" matches title "Codathon")
 * 2. Explicit event.slug
 * 3. Exact event.id
 * 4. Case-insensitive title match
 */
export function findEventBySlugOrId(events: FestEvent[], slugOrId?: string): FestEvent | undefined {
  if (!slugOrId || !events || events.length === 0) return undefined;
  const target = slugOrId.toLowerCase().trim();

  // 1. Direct match on title-derived slug
  let match = events.find((e) => toEventSlug(e.title) === target);
  if (match) return match;

  // 2. Match on explicit slug or id
  match = events.find((e) => {
    const eSlug = e.slug ? toEventSlug(e.slug) : "";
    const eId = (e.id || "").toLowerCase().trim();
    return eSlug === target || eId === target;
  });
  if (match) return match;

  // 3. Match on exact title or title substring
  match = events.find((e) => {
    const titleLower = (e.title || "").toLowerCase().trim();
    return titleLower === target || toEventSlug(titleLower) === target;
  });
  if (match) return match;

  // 4. Fallback: match by known slug mapping
  for (const [key, slugVal] of Object.entries(KNOWN_SLUG_MAP)) {
    if (slugVal === target) {
      const found = events.find((e) => (e.title || "").toLowerCase().includes(key) || (e.id || "").toLowerCase() === key);
      if (found) return found;
    }
  }

  return undefined;
}
