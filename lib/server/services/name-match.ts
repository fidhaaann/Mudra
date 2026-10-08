/**
 * Deterministic fuzzy name matching for Team Lookup (server-side only).
 *
 * Normalisation is for comparison only — callers keep and display the original
 * registered names. Scores are in [0, 1]; callers decide what is confident
 * enough to return directly, what is only a "possible match", and what to drop.
 */

export const DIRECT_MATCH_MIN = 0.9;   // confident enough to return the result
export const DIRECT_MATCH_MARGIN = 0.05; // ...and clearly ahead of the runner-up
export const CANDIDATE_MIN = 0.72;     // below this a name is never suggested
export const MAX_CANDIDATES = 5;
// Queries shorter than this (in letters/digits) only match exactly.
export const MIN_FUZZY_QUERY_LENGTH = 3;
// Edit-distance similarity is only meaningful from this length up.
const MIN_EDIT_LENGTH = 4;

export interface NormalizedName {
  /** lower-cased, punctuation → space, whitespace collapsed */
  spaced: string;
  /** `spaced` with all spaces removed — ignores spacing around initials */
  compact: string;
  tokens: string[];
}

export function normalizeName(raw: string): NormalizedName {
  const spaced = raw
    .normalize("NFKC")
    .toLowerCase()
    // Any punctuation/symbol (".", ",", "-", "'", …) is optional for matching.
    // Letters + combining marks are kept so non-Latin names (e.g. Malayalam)
    // compare correctly.
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .trim();
  return {
    spaced,
    compact: spaced.replace(/ /g, ""),
    tokens: spaced ? spaced.split(" ") : [],
  };
}

/** Optimal-string-alignment distance (Levenshtein + adjacent transpositions). */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const A = Array.from(a);
  const B = Array.from(b);
  let prev2: number[] = [];
  let prev = Array.from({ length: B.length + 1 }, (_, j) => j);
  for (let i = 1; i <= A.length; i++) {
    const cur = [i];
    for (let j = 1; j <= B.length; j++) {
      const cost = A[i - 1] === B[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && A[i - 1] === B[j - 2] && A[i - 2] === B[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1);
      }
      cur.push(v);
    }
    prev2 = prev;
    prev = cur;
  }
  return prev[B.length];
}

function editSimilarity(a: string, b: string): number {
  const len = Math.max(Array.from(a).length, Array.from(b).length);
  return len === 0 ? 0 : 1 - editDistance(a, b) / len;
}

function tokenSimilarity(q: string, c: string): number {
  if (q === c) return 1;
  // Prefix of a name part, or an initial ("s" ↔ "sreekumar").
  if (c.startsWith(q)) return 0.9;
  // User typed the full word where the register only has the initial.
  if (c.length === 1 && q.startsWith(c)) return 0.85;
  if (Math.min(q.length, c.length) >= MIN_EDIT_LENGTH - 1) {
    const sim = editSimilarity(q, c);
    return sim >= 0.6 ? sim : 0;
  }
  return 0;
}

/**
 * Word-level score: every query word is paired with its best unused name word
 * (order-independent), weighted by length, then scaled by how much of the
 * registered name the query covered.
 */
function tokenScore(q: NormalizedName, c: NormalizedName): number {
  if (!q.tokens.length || !c.tokens.length) return 0;
  const used = new Set<number>();
  let weighted = 0;
  let weight = 0;
  let coveredChars = 0;
  const ordered = [...q.tokens].sort((x, y) => y.length - x.length);
  for (const qt of ordered) {
    let best = 0;
    let bestIdx = -1;
    c.tokens.forEach((ct, idx) => {
      if (used.has(idx)) return;
      const s = tokenSimilarity(qt, ct);
      if (s > best) {
        best = s;
        bestIdx = idx;
      }
    });
    if (bestIdx >= 0) {
      used.add(bestIdx);
      coveredChars += c.tokens[bestIdx].length;
    }
    weighted += best * qt.length;
    weight += qt.length;
  }
  const coverage = coveredChars / c.compact.length;
  return (weighted / weight) * (0.75 + 0.25 * coverage);
}

/** Similarity of a query to one registered name, in [0, 1]. */
export function scoreName(q: NormalizedName, c: NormalizedName): number {
  if (!q.compact || !c.compact) return 0;
  // Same letters, ignoring case, punctuation and spacing.
  if (q.compact === c.compact) return 1;
  // Very short queries never match fuzzily.
  if (q.compact.length < MIN_FUZZY_QUERY_LENGTH) return 0;

  let score = tokenScore(q, c);

  // Run-together partial name ("adithyansree" → "ADITHYAN SREEKUMAR").
  if (c.compact.startsWith(q.compact)) {
    score = Math.max(score, 0.75 + 0.2 * (q.compact.length / c.compact.length));
  }

  // Whole-name typo tolerance, also covers missing/extra spaces.
  if (q.compact.length >= MIN_EDIT_LENGTH) {
    score = Math.max(score, editSimilarity(q.compact, c.compact));
  }

  // Only an exact normalised match may score 1.
  return Math.min(score, 0.99);
}

export type NameMatchOutcome<T> =
  | { kind: "direct"; item: T }
  | { kind: "candidates"; items: T[]; more: boolean }
  | { kind: "none" };

/**
 * Rank `items` by name similarity to `query` and decide the outcome:
 *  - a single exact normalised match → direct
 *  - a single clearly-leading strong fuzzy match → direct
 *  - otherwise the strongest few plausible names → candidates
 *  - nothing plausible → none (never the "closest" unrelated name)
 */
export function matchByName<T>(
  query: string,
  items: readonly T[],
  getName: (item: T) => string
): NameMatchOutcome<T> {
  const q = normalizeName(query);
  if (!q.compact) return { kind: "none" };

  const scored = items
    .map((item) => ({ item, score: scoreName(q, normalizeName(getName(item))) }))
    .filter((s) => s.score >= CANDIDATE_MIN)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return { kind: "none" };

  const exact = scored.filter((s) => s.score === 1);
  if (exact.length === 1) return { kind: "direct", item: exact[0].item };

  const [top, second] = scored;
  if (
    exact.length === 0 &&
    q.compact.length >= MIN_EDIT_LENGTH &&
    top.score >= DIRECT_MATCH_MIN &&
    (!second || top.score - second.score >= DIRECT_MATCH_MARGIN)
  ) {
    return { kind: "direct", item: top.item };
  }

  return {
    kind: "candidates",
    items: scored.slice(0, MAX_CANDIDATES).map((s) => s.item),
    more: scored.length > MAX_CANDIDATES,
  };
}
