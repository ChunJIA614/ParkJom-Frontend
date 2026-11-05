import type { ParkingSpot } from '../types';

export interface FuzzyMatchResult {
  score: number;
  reason: string;
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'near', 'at', 'in', 'by', 'for', 'to',
  'condo', 'condominium', 'residence', 'residences', 'apartment', 'bay',
  'parking', 'lot', 'station', 'stn', 'lrt', 'mrt', 'jalan', 'jln',
]);

/**
 * Strips whitespace, hyphens, slashes, and punctuation for compact matching.
 * E.g. "PV 128" -> "pv128", "pv-18" -> "pv18", "Wangsa Maju" -> "wangsamaju"
 */
export function normalizeCompact(input?: string | null): string {
  if (!input) return '';
  return input.trim().toLowerCase().replace(/[\s\-_,./\\#+]+/g, '');
}

/**
 * Tokenizes text into discrete lowercase words.
 */
export function tokenize(input?: string | null): string[] {
  if (!input) return [];
  return input
    .trim()
    .toLowerCase()
    .split(/[\s\-_,./\\#+]+/)
    .filter(Boolean);
}

/**
 * Calculates Levenshtein edit distance between two strings.
 */
export function levenshteinDistance(s: string, t: string): number {
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;

  const n = s.length;
  const m = t.length;
  let prevRow = new Array<number>(m + 1);
  let currRow = new Array<number>(m + 1);

  for (let j = 0; j <= m; j++) prevRow[j] = j;

  for (let i = 1; i <= n; i++) {
    currRow[0] = i;
    const sChar = s[i - 1];

    for (let j = 1; j <= m; j++) {
      const cost = sChar === t[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        currRow[j - 1] + 1,
        prevRow[j] + 1,
        prevRow[j - 1] + cost,
      );
    }

    const temp = prevRow;
    prevRow = currRow;
    currRow = temp;
  }

  return prevRow[m];
}

/**
 * Returns a normalized similarity ratio between 0.0 and 1.0.
 */
export function similarityRatio(s: string, t: string): number {
  if (!s && !t) return 1.0;
  if (!s || !t) return 0.0;
  const maxLen = Math.max(s.length, t.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(s, t);
  return Math.max(0.0, 1.0 - dist / maxLen);
}

/**
 * Checks if characters of sub appear sequentially in full (wildcard subsequence).
 */
export function isSubsequence(sub: string, full: string): boolean {
  if (!sub) return true;
  if (!full || sub.length > full.length) return false;

  let subIdx = 0;
  for (let fullIdx = 0; fullIdx < full.length && subIdx < sub.length; fullIdx++) {
    if (sub[subIdx] === full[fullIdx]) {
      subIdx++;
    }
  }
  return subIdx === sub.length;
}

/**
 * Evaluates how strongly a query matches a parking spot.
 * Returns a score between 0 and 100 with an explanation reason.
 */
export function scoreParkingMatch(rawQuery: string, spot: ParkingSpot): FuzzyMatchResult {
  const queryTrim = rawQuery.trim().toLowerCase();
  if (!queryTrim) return { score: 100, reason: 'All spots' };

  const queryCompact = normalizeCompact(rawQuery);
  const queryTokens = tokenize(rawQuery);
  const meaningfulTokens = queryTokens.filter((t) => !STOP_WORDS.has(t));
  const activeTokens = meaningfulTokens.length > 0 ? meaningfulTokens : queryTokens;

  const propName = (spot.propertyName || spot.name || '').trim();
  const propCompact = normalizeCompact(propName);
  const propTokens = tokenize(propName);

  const stationName = (spot.stationName || spot.station || '').trim();
  const stationCompact = normalizeCompact(stationName);
  const stationTokens = tokenize(stationName);

  const address = (spot.address || '').trim();
  const addressCompact = normalizeCompact(address);
  const addressTokens = tokenize(address);

  const label = (spot.parkingLabel || '').trim();
  const labelCompact = normalizeCompact(label);
  const labelTokens = tokenize(label);

  const desc = `${(spot as any).description || ''} ${spot.type || ''}`.trim();

  const allWords = [...propTokens, ...stationTokens, ...addressTokens, ...labelTokens];
  const allWordSet = new Set(allWords);

  let bestScore = 0;
  let bestReason = '';

  const update = (score: number, reason: string) => {
    if (score > bestScore) {
      bestScore = score;
      bestReason = reason;
    }
  };

  // 1. EXACT / DELIMITER-AGNOSTIC MATCH
  if (propName.toLowerCase() === queryTrim) {
    update(100, 'Exact property name match');
  } else if (propCompact && queryCompact && propCompact === queryCompact) {
    update(98, 'Normalized property match (spaces/symbols ignored)');
  } else if (stationName.toLowerCase() === queryTrim) {
    update(95, 'Exact station match');
  } else if (stationCompact && queryCompact && stationCompact === queryCompact) {
    update(94, 'Normalized station match (spaces/symbols ignored)');
  }

  // 2. COMPACT SUBSTRING MATCH ("remove text in between")
  if (queryCompact.length >= 2) {
    if (propCompact.startsWith(queryCompact)) {
      update(92, 'Property name starts with search term');
    } else if (propCompact.includes(queryCompact)) {
      update(88, 'Property name contains search term');
    } else if (stationCompact.startsWith(queryCompact)) {
      update(86, 'Station starts with search term');
    } else if (stationCompact.includes(queryCompact)) {
      update(84, 'Station contains search term');
    } else if (addressCompact.includes(queryCompact)) {
      update(80, 'Address matches search term');
    } else if (labelCompact.includes(queryCompact)) {
      update(78, 'Parking bay label matches search term');
    }
  }

  // 3. STANDARD CONTAINS MATCH (with phrases)
  if (propName.toLowerCase().includes(queryTrim)) {
    update(85, 'Property name contains phrase');
  } else if (stationName.toLowerCase().includes(queryTrim)) {
    update(82, 'Station name contains phrase');
  } else if (address.toLowerCase().includes(queryTrim)) {
    update(78, 'Address contains phrase');
  } else if (label.toLowerCase().includes(queryTrim)) {
    update(75, 'Bay label contains phrase');
  } else if (desc.toLowerCase().includes(queryTrim)) {
    update(65, 'Description matches phrase');
  }

  // 4. MULTI-TOKEN OVERLAP MATCH (e.g. "Wangsa Maju PV" or "Setapak PV 128")
  if (activeTokens.length > 1) {
    let matchedTokenCount = 0;
    for (const token of activeTokens) {
      const isPureDigits = /^\d+$/.test(token);
      if (isPureDigits) {
        if (allWordSet.has(token) || allWords.some((w) => /^\d+$/.test(w) && w.startsWith(token))) {
          matchedTokenCount++;
        }
      } else {
        const cToken = normalizeCompact(token);
        if (
          allWordSet.has(token) ||
          allWords.some((w) => w.startsWith(token)) ||
          (cToken.length >= 2 && normalizeCompact(allWords.join('')).includes(cToken))
        ) {
          matchedTokenCount++;
        }
      }
    }

    if (matchedTokenCount === activeTokens.length) {
      update(75 + activeTokens.length * 3, 'All search terms matched across property, station, or address');
    } else if (matchedTokenCount > 0 && activeTokens.length > 2) {
      const partial = 35 + Math.round((matchedTokenCount / activeTokens.length) * 25);
      update(partial, `${matchedTokenCount}/${activeTokens.length} terms matched`);
    }
  }

  // 5. WILDCARD SUBSEQUENCE MATCH ("the wildcard", e.g. "pv18" inside "pv18residences")
  if (queryCompact.length >= 3) {
    if (isSubsequence(queryCompact, propCompact)) {
      update(72, 'Wildcard pattern matched property');
    } else if (isSubsequence(queryCompact, stationCompact)) {
      update(68, 'Wildcard pattern matched station');
    }
  }

  // 6. FUZZY SEARCH (Levenshtein Distance & Edit Similarity for typos)
  if (queryCompact.length >= 3) {
    if (propCompact.length >= 3) {
      const dist = levenshteinDistance(queryCompact, propCompact);
      const sim = similarityRatio(queryCompact, propCompact);
      if (dist <= 2 || sim >= 0.7) {
        const fuzzyScore = 45 + Math.round(sim * 35);
        update(fuzzyScore, `Fuzzy property match (${Math.round(sim * 100)}% similarity)`);
      }
    }

    if (stationCompact.length >= 3) {
      const dist = levenshteinDistance(queryCompact, stationCompact);
      const sim = similarityRatio(queryCompact, stationCompact);
      if (dist <= 2 || sim >= 0.7) {
        const fuzzyScore = 40 + Math.round(sim * 35);
        update(fuzzyScore, `Fuzzy station match (${Math.round(sim * 100)}% similarity)`);
      }
    }

    // Word-level fuzzy match
    for (const qToken of activeTokens.filter((t) => t.length >= 3)) {
      for (const pToken of [...propTokens, ...stationTokens]) {
        if (pToken.length < 3) continue;
        const d = levenshteinDistance(qToken, pToken);
        if (d <= 1 || (qToken.length >= 5 && d <= 2)) {
          const sim = similarityRatio(qToken, pToken);
          const score = 45 + Math.round(sim * 30);
          update(score, `Fuzzy word match '${pToken}' (${Math.round(sim * 100)}%)`);
        }
      }
    }
  }

  return { score: bestScore, reason: bestReason };
}

/**
 * Filter and sort spots by fuzzy relevance score.
 */
export function fuzzyFilterSpots(spots: ParkingSpot[], query: string): ParkingSpot[] {
  if (!query || !query.trim()) return spots;

  const rawQuery = query.trim();
  const scored = spots
    .map((spot) => ({
      spot,
      ...scoreParkingMatch(rawQuery, spot),
    }))
    .filter((item) => item.score >= 35);

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.spot);
}

/**
 * Builds smart auto-suggestions or "Did you mean" candidates.
 */
export function getFuzzySuggestions(
  spots: ParkingSpot[],
  query: string,
  extraCandidates: string[] = [],
): string[] {
  if (!query || query.trim().length < 2) return [];

  const rawQuery = query.trim();
  const queryLower = rawQuery.toLowerCase();
  const queryCompact = normalizeCompact(rawQuery);

  const candidateSet = new Set<string>();
  spots.forEach((s) => {
    if (s.propertyName) candidateSet.add(s.propertyName);
    if (s.stationName) candidateSet.add(s.stationName);
    if (s.name) candidateSet.add(s.name);
  });
  extraCandidates.forEach((c) => {
    if (c) candidateSet.add(c);
  });

  const scoredCandidates: Array<{ name: string; similarity: number }> = [];

  candidateSet.forEach((name) => {
    if (name.toLowerCase() === queryLower) return;

    const nameCompact = normalizeCompact(name);
    const simFull = similarityRatio(queryLower, name.toLowerCase());
    const simCompact = similarityRatio(queryCompact, nameCompact);
    const startsWithBonus = nameCompact.startsWith(queryCompact) ? 0.3 : 0;
    const containsBonus = nameCompact.includes(queryCompact) ? 0.2 : 0;

    const maxSim = Math.max(simFull, simCompact) + startsWithBonus + containsBonus;
    if (maxSim >= 0.55) {
      scoredCandidates.push({ name, similarity: maxSim });
    }
  });

  scoredCandidates.sort((a, b) => b.similarity - a.similarity);
  return scoredCandidates.slice(0, 4).map((c) => c.name);
}
