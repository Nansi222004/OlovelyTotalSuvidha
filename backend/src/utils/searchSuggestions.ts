export const MIN_SUGGESTION_QUERY_LENGTH = 2;
export const DEFAULT_SUGGESTION_LIMIT = 8;

export type SearchMatchKind =
  | "exact"
  | "prefix"
  | "token"
  | "contains"
  | "fuzzy";

export interface SearchMatch {
  kind: SearchMatchKind;
  rank: number;
  distance: number;
}

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const normalizeSearchText = (value: unknown): string =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

/**
 * Existing catalogue behaviour: separators between typed characters are
 * optional, so "icecream" can match "Ice Cream" and "footwear" can match
 * "Foot-Wear" without a vocabulary-specific alias table.
 */
export function buildFlexibleRegex(query: string): RegExp {
  const clean = query.trim();
  const escapedChars = Array.from(clean).map((character) =>
    /\s/.test(character) ? "\\s+" : escapeRegex(character)
  );

  let pattern = "";
  for (let index = 0; index < escapedChars.length; index += 1) {
    pattern += escapedChars[index];
    if (
      index < escapedChars.length - 1 &&
      escapedChars[index] !== "\\s+" &&
      escapedChars[index + 1] !== "\\s+"
    ) {
      pattern += "[\\s\\-]*";
    }
  }

  return new RegExp(pattern, "i");
}

/**
 * Bounded database candidate fallback. It allows at most two intervening
 * alphanumeric characters per typed character, keeping the candidate set
 * narrow before deterministic in-memory ranking (for example tur -> Tumeri).
 */
export function buildFuzzyCandidateRegex(query: string): RegExp | null {
  const normalized = normalizeSearchText(query).replace(/\s+/g, "");
  if (normalized.length < 3 || normalized.length > 32) return null;

  const pattern = Array.from(normalized)
    .map(escapeRegex)
    .join("[a-z0-9\\s\\-]{0,2}");
  return new RegExp(pattern, "i");
}

function levenshteinDistance(left: string, right: string): number {
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + substitutionCost
      );
    }
    previous = current;
  }
  return previous[right.length];
}

function boundedSubsequenceSpan(query: string, candidate: string): number | null {
  let queryIndex = 0;
  let start = -1;
  let previousMatch = -1;

  for (let candidateIndex = 0; candidateIndex < candidate.length; candidateIndex += 1) {
    if (candidate[candidateIndex] !== query[queryIndex]) continue;
    if (start < 0) start = candidateIndex;
    if (previousMatch >= 0 && candidateIndex - previousMatch - 1 > 2) return null;
    previousMatch = candidateIndex;
    queryIndex += 1;
    if (queryIndex === query.length) return candidateIndex - start + 1;
  }

  return null;
}

export function classifySearchMatch(value: unknown, query: string): SearchMatch | null {
  const candidate = normalizeSearchText(value);
  const normalizedQuery = normalizeSearchText(query);
  if (!candidate || normalizedQuery.length < MIN_SUGGESTION_QUERY_LENGTH) return null;

  if (candidate === normalizedQuery) return { kind: "exact", rank: 0, distance: 0 };
  if (candidate.startsWith(normalizedQuery)) {
    return { kind: "prefix", rank: 1, distance: candidate.length - normalizedQuery.length };
  }

  const tokens = candidate.split(" ");
  if (tokens.some((token) => token === normalizedQuery || token.startsWith(normalizedQuery))) {
    return { kind: "token", rank: 2, distance: candidate.length - normalizedQuery.length };
  }
  if (candidate.includes(normalizedQuery)) {
    return { kind: "contains", rank: 3, distance: candidate.indexOf(normalizedQuery) };
  }

  const compactQuery = normalizedQuery.replace(/\s+/g, "");
  const fuzzyTargets = [candidate.replace(/\s+/g, ""), ...tokens];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const target of fuzzyTargets) {
    const comparisonLength = Math.min(target.length, Math.max(compactQuery.length + 2, 4));
    const prefix = target.slice(0, comparisonLength);
    const editDistance = levenshteinDistance(compactQuery, prefix);
    const allowedDistance = compactQuery.length <= 4 ? 1 : 2;
    if (editDistance <= allowedDistance) bestDistance = Math.min(bestDistance, editDistance);

    const span = boundedSubsequenceSpan(compactQuery, target);
    if (span !== null && span <= compactQuery.length + 2) {
      bestDistance = Math.min(bestDistance, span - compactQuery.length + 1);
    }
  }

  return Number.isFinite(bestDistance)
    ? { kind: "fuzzy", rank: 4, distance: bestDistance }
    : null;
}

export function bestSearchMatch(values: unknown[], query: string): SearchMatch | null {
  return values.reduce<SearchMatch | null>((best, value) => {
    const match = classifySearchMatch(value, query);
    if (!match) return best;
    if (!best || match.rank < best.rank) return match;
    if (match.rank === best.rank && match.distance < best.distance) return match;
    return best;
  }, null);
}

export function rankSearchSuggestions<T>(
  records: T[],
  query: string,
  values: (record: T) => unknown[],
  limit = DEFAULT_SUGGESTION_LIMIT
): T[] {
  if (normalizeSearchText(query).length < MIN_SUGGESTION_QUERY_LENGTH) return [];

  return records
    .map((record, sourceIndex) => ({
      record,
      sourceIndex,
      match: bestSearchMatch(values(record), query),
      sortLabel: normalizeSearchText(values(record)[0]),
    }))
    .filter((entry): entry is typeof entry & { match: SearchMatch } => entry.match !== null)
    .sort((left, right) =>
      left.match.rank - right.match.rank ||
      left.match.distance - right.match.distance ||
      left.sortLabel.localeCompare(right.sortLabel) ||
      left.sourceIndex - right.sourceIndex
    )
    .slice(0, Math.max(0, limit))
    .map(({ record }) => record);
}
