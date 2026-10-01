/**
 * Pure text utilities shared by the AIE agent's tool layer.
 *
 * This is the reason a typo still lands: the model may emit "apolo", "sara",
 * or "onbaording flow", but every tool resolves its arguments through
 * `findFuzzy`, so the *database* decides what was meant — not the model's
 * guess. Pure string math only, so it is safe to import from both the
 * "use node" action and the regular Convex functions.
 */

export interface FuzzyCandidate<T> {
  value: T;
  label: string;
  /** Extra spellings that should also match, e.g. an email or job title. */
  aliases?: string[];
}

export interface FuzzyMatch<T> {
  item: FuzzyCandidate<T>;
  /** 1 = exact, ~0.4 = weak but plausible. */
  score: number;
  /** Which label/alias won. */
  label: string;
  /** True when the input was not spelled exactly like the winner. */
  corrected: boolean;
}

/* ── Normalisation ─────────────────────────────────────────────── */

/** Lowercase, strip accents and punctuation, collapse whitespace. */
export function normalizeText(input: string): string {
  return (input ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/* ── Similarity ────────────────────────────────────────────────── */

function bigrams(s: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length - 1; i += 1) out.push(s.slice(i, i + 2));
  return out;
}

/** Sørensen–Dice coefficient over character bigrams. Good at transpositions. */
export function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const pool = bigrams(b).slice();
  let hits = 0;
  for (const g of bigrams(a)) {
    const idx = pool.indexOf(g);
    if (idx >= 0) {
      pool.splice(idx, 1);
      hits += 1;
    }
  }
  return (2 * hits) / (bigrams(a).length + pool.length + hits);
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[b.length];
}

export function levenshteinRatio(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

/** Similarity for two already-normalised single words. */
function coreSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  let score = Math.max(diceCoefficient(a, b), levenshteinRatio(a, b));
  if (a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a))) {
    const ratio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
    score = Math.max(score, 0.8 + 0.2 * ratio);
  }
  return score;
}

/**
 * Blended similarity in [0, 1]. Combines whole-string edit distance with a
 * per-word best-match average, so both "onbaording" -> "onboarding" and
 * "design onboard flow" -> "design onboarding flow" score well.
 */
export function similarity(a: string, b: string): number {
  const A = normalizeText(a);
  const B = normalizeText(b);
  if (!A || !B) return 0;
  if (A === B) return 1;

  let best = coreSimilarity(A, B);

  if (A.length >= 3 && B.length >= 3 && (A.includes(B) || B.includes(A))) {
    const ratio = Math.min(A.length, B.length) / Math.max(A.length, B.length);
    best = Math.max(best, 0.78 + 0.22 * ratio);
  }

  const wordsA = A.split(" ").filter(Boolean);
  const wordsB = B.split(" ").filter(Boolean);

  // Best word alignment in both directions. This is what lets a single
  // misspelled word reach a longer name ("nebla" -> "Project Nebula") and a
  // padded enum reach its option ("hgh priorty" -> "high").
  let bestWord = 0;
  let sum = 0;
  for (const wa of wordsA) {
    let top = 0;
    for (const wb of wordsB) top = Math.max(top, coreSimilarity(wa, wb));
    bestWord = Math.max(bestWord, top);
    sum += top;
  }
  if (wordsA.length > 0) best = Math.max(best, 0.9 * bestWord);

  // Whole-input coverage: every word the user typed has a plausible home.
  if (wordsA.length > 1 && wordsB.length > 1) {
    best = Math.max(best, (sum / wordsA.length) * 0.92);
  }

  return Math.min(1, best);
}

/**
 * Best fuzzy match for `input` among `candidates`, or null when nothing is
 * close enough. Also reports whether the match had to correct the spelling so
 * the agent can say "I matched that to Apollo" instead of silently guessing.
 */
export function findFuzzy<T>(
  input: string,
  candidates: FuzzyCandidate<T>[],
  threshold = 0.55
): FuzzyMatch<T> | null {
  return findAllFuzzy(input, candidates, threshold)[0] ?? null;
}

/**
 * Every candidate that matches, best first. "Remove the unknown members" is a
 * plural request that names a group, not a person — a single-winner matcher
 * would silently act on only one of them.
 */
export function findAllFuzzy<T>(
  input: string,
  candidates: FuzzyCandidate<T>[],
  threshold = 0.55
): FuzzyMatch<T>[] {
  if (!candidates.length) return [];
  const normalizedInput = normalizeText(input);
  const matches: FuzzyMatch<T>[] = [];

  for (const candidate of candidates) {
    let best: FuzzyMatch<T> | null = null;
    for (const label of [candidate.label, ...(candidate.aliases ?? [])]) {
      const score = similarity(normalizedInput, label);
      if (!best || score > best.score) {
        best = {
          item: candidate,
          score,
          label,
          corrected: normalizeText(label) !== normalizedInput,
        };
      }
    }
    if (best && best.score >= threshold) matches.push(best);
  }

  return matches.sort((a, b) => b.score - a.score);
}

/* ── Value coercion ────────────────────────────────────────────── */

/** Snap a near-miss enum value onto the allowed list, e.g. "hgh" -> "high". */
export function normEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  const s = normalizeText(String(value ?? ""));
  if (!s) return fallback;
  if ((allowed as readonly string[]).includes(s)) return s as T;
  let best: T = fallback;
  let bestScore = 0.6; // only override the fallback on a confident match
  for (const option of allowed) {
    const score = similarity(s, option);
    if (score > bestScore) {
      bestScore = score;
      best = option;
    }
  }
  return best;
}

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * Forgiving date parser: accepts ISO strings, "Dec 15", "15 December 2026",
 * "tomorrow", "in 3 days", "2 weeks", "next friday". Returns YYYY-MM-DD or
 * undefined when nothing sensible was found.
 */
export function parseDateInput(
  value: unknown,
  now: Date = new Date()
): string | undefined {
  const raw = normalizeText(String(value ?? ""));
  if (!raw) return undefined;

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const d = new Date(
      Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
    );
    return isNaN(d.getTime()) ? undefined : isoDate(d);
  }

  if (raw === "today" || raw === "now") return isoDate(now);
  if (raw === "tomorrow") return isoDate(addDays(now, 1));
  if (raw === "yesterday") return isoDate(addDays(now, -1));

  const inDays = raw.match(/^(?:in|after)?\s*(\d+)\s*(day|week|month)s?$/);
  if (inDays) {
    const n = Number(inDays[1]);
    const unit = inDays[2];
    if (unit === "day") return isoDate(addDays(now, n));
    if (unit === "week") return isoDate(addDays(now, n * 7));
    return isoDate(addDays(now, n * 30));
  }

  const weekdays = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const weekday = weekdays.findIndex((w) => raw.includes(w));
  if (weekday >= 0) {
    let delta = (weekday - now.getUTCDay() + 7) % 7;
    if (delta === 0 || raw.includes("next")) delta = delta === 0 ? 7 : delta + 7;
    return isoDate(addDays(now, delta));
  }

  const month = MONTHS.findIndex((m) => raw.startsWith(m.slice(0, 3)));
  if (month >= 0) {
    const rest = raw.slice(3);
    const dayMatch = rest.match(/(\d{1,2})(?:st|nd|rd|th)?/);
    const yearMatch = rest.match(/(\d{4})/);
    if (dayMatch) {
      let year = now.getUTCFullYear();
      if (yearMatch) {
        year = Number(yearMatch[1]);
      } else {
        const candidate = new Date(
          Date.UTC(year, month, Number(dayMatch[1]), 12)
        );
        // A bare month/day already in the past means next year.
        if (candidate.getTime() < now.getTime()) year += 1;
      }
      const d = new Date(
        Date.UTC(year, month, Number(dayMatch[1]), 12)
      );
      return isNaN(d.getTime()) ? undefined : isoDate(d);
    }
  }

  const fallback = Date.parse(String(value));
  if (!isNaN(fallback)) return isoDate(new Date(fallback));
  return undefined;
}

/** "in 3 days" / "2 days ago" style relative label, used in reports. */
export function describeRelative(timestamp: number, now = Date.now()): string {
  const diff = now - timestamp;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toISOString().slice(0, 10);
}