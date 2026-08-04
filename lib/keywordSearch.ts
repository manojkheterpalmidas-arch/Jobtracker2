/**
 * Keyword-first title matching for the Decision Maker tab.
 *
 * The original decision-maker search always merged a user's keyword into a large
 * list of generic senior titles, so a specific search such as "Temporary Works
 * Designer" was drowned out by every Director and Partner at the target company.
 * This module keeps keyword handling in one place: how a keyword is widened into
 * realistic title variants for Lusha, and how a returned title is matched back
 * against what the user actually asked for.
 */

const KEYWORD_STOPWORDS = new Set(["of", "and", "the", "for", "a", "an", "at", "in", "to", "on", "with"]);

/** Role nouns that commonly end an engineering job title. */
const ROLE_NOUNS = [
  "engineer",
  "engineering",
  "designer",
  "design",
  "manager",
  "coordinator",
  "co-ordinator",
  "lead",
  "leader",
  "supervisor",
  "specialist",
  "consultant",
  "checker",
  "director",
  "advisor",
  "adviser",
  "officer",
  "technician",
  "analyst",
  "architect",
  "planner",
  "surveyor"
];

/** Suffixes appended to a keyword stem to widen recall on the Lusha side. */
const ROLE_SUFFIXES = [
  "Engineer",
  "Designer",
  "Design Engineer",
  "Design Manager",
  "Design Lead",
  "Coordinator",
  "Manager",
  "Lead",
  "Supervisor",
  "Specialist",
  "Consultant",
  "Checker",
  "Director"
];

/** Seniority prefixes applied to the keyword itself. */
const SENIORITY_PREFIXES = ["Senior", "Principal", "Lead", "Associate", "Head of"];

/**
 * Lusha's jobTitles filter matches real job-title strings, not substrings, so a
 * shorthand keyword must be widened into the words people actually put in their
 * title. Searching "Geotech" returned nothing precisely because no one's title
 * says "Geotech" — it says "Geotechnical Engineer".
 *
 * Keys are normalised; values are the full-word forms to query as well.
 */
const DISCIPLINE_SYNONYMS: Record<string, string[]> = {
  geotech: ["Geotechnical", "Geotechnics", "Ground Engineering"],
  geotechnical: ["Geotechnics", "Ground Engineering"],
  geotechnics: ["Geotechnical", "Ground Engineering"],
  struct: ["Structural", "Structures"],
  structural: ["Structures"],
  structures: ["Structural"],
  bridge: ["Bridges"],
  bridges: ["Bridge"],
  civil: ["Civils"],
  civils: ["Civil"],
  tw: ["Temporary Works"],
  "temp works": ["Temporary Works"],
  "temporary works": ["Temporary Works"],
  tunnel: ["Tunnelling", "Tunnels", "Tunnelling and Underground"],
  tunnels: ["Tunnelling", "Tunnel"],
  tunnelling: ["Tunnel", "Tunnels"],
  rail: ["Railway", "Rail and Civils"],
  highway: ["Highways"],
  highways: ["Highway"],
  seismic: ["Earthquake", "Seismic Design"],
  fea: ["Finite Element", "Finite Element Analysis"],
  cad: ["CAD", "Design Technician"],
  bim: ["BIM", "Digital Engineering"]
};

/** Suffixes tried first, because they cover most real engineering titles. */
const PRIORITY_SUFFIXES = ["Engineer", "Manager", "Director", "Lead"];

const MAX_EXPANDED_KEYWORDS = 80;

export function normalizeTitleText(value = "") {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function keywordTokens(keyword = "") {
  return normalizeTitleText(keyword)
    .split(" ")
    .filter((token) => token && !KEYWORD_STOPWORDS.has(token));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Word-boundary prefix match, so "design" matches "designer" and "designs" but
 * not "redesign". Prefix rather than whole-word matching is deliberate: job
 * titles pluralise and inflect constantly.
 */
function hasToken(normalizedTitle: string, token: string) {
  if (!token) return false;
  return new RegExp(`\\b${escapeRegExp(token)}`).test(normalizedTitle);
}

/**
 * `exact`      - the title contains the keyword phrase verbatim.
 * `all_tokens` - every significant word of the keyword appears in the title.
 * `stem`       - the role stem matches, e.g. "Temporary Works Coordinator" for a
 *                search of "Temporary Works Designer". This is what makes the
 *                widened query worth running: without it, the variants sent to
 *                Lusha would be filtered straight back out.
 */
export type KeywordMatchStrength = "exact" | "all_tokens" | "stem" | "none";

const STRENGTH_ORDER: Record<KeywordMatchStrength, number> = {
  exact: 3,
  all_tokens: 2,
  stem: 1,
  none: 0
};

/** How strongly a single title matches a single keyword. */
export function matchKeyword(
  title: string,
  keyword: string,
  options: { allowStem?: boolean } = {}
): KeywordMatchStrength {
  const { allowStem = true } = options;
  const normalizedTitle = normalizeTitleText(title);
  const normalizedKeyword = normalizeTitleText(keyword);

  if (!normalizedTitle || !normalizedKeyword) return "none";
  if (normalizedTitle.includes(normalizedKeyword)) return "exact";

  const tokens = keywordTokens(keyword);

  if (tokens.length > 1 && tokens.every((token) => hasToken(normalizedTitle, token))) {
    return "all_tokens";
  }

  if (allowStem) {
    const stemTokens = keywordTokens(keywordStem(keyword));

    if (stemTokens.length && stemTokens.every((token) => hasToken(normalizedTitle, token))) {
      return "stem";
    }
  }

  return "none";
}

export interface KeywordMatchResult {
  /** Original user keywords the title matched, strongest first. */
  matchedKeywords: string[];
  /** True when the title contains a keyword phrase verbatim. */
  exact: boolean;
  strength: KeywordMatchStrength;
}

/** Match a title against every keyword the user supplied. */
export function matchKeywords(
  title: string,
  keywords: string[],
  options: { allowStem?: boolean } = {}
): KeywordMatchResult {
  const scored = keywords
    .map((keyword) => ({ keyword, strength: matchKeyword(title, keyword, options) }))
    .filter((entry) => entry.strength !== "none")
    .sort((a, b) => STRENGTH_ORDER[b.strength] - STRENGTH_ORDER[a.strength]);

  return {
    matchedKeywords: scored.map((entry) => entry.keyword),
    exact: scored.some((entry) => entry.strength === "exact"),
    strength: scored[0]?.strength ?? "none"
  };
}

function titleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Strip a trailing role noun so "Temporary Works Designer" yields the stem
 * "Temporary Works", which can then be recombined with other role nouns.
 */
function keywordStem(keyword: string) {
  const tokens = keywordTokens(keyword);
  if (tokens.length < 2) return "";

  const last = tokens[tokens.length - 1];
  if (!ROLE_NOUNS.includes(last)) return "";

  const stem = tokens.slice(0, -1);
  // Drop a trailing "design" from e.g. "temporary works design engineer".
  if (stem.length > 1 && ROLE_NOUNS.includes(stem[stem.length - 1])) {
    return stem.slice(0, -1).join(" ");
  }

  return stem.join(" ");
}

/**
 * Widen each keyword into realistic title variants. "Temporary Works Designer"
 * becomes Temporary Works Engineer / Coordinator / Design Manager / Senior
 * Temporary Works Designer and so on, which is how the same role is actually
 * titled across different contractors.
 */
export function expandKeywords(keywords: string[]): string[] {
  const expanded: string[] = [];
  const seen = new Set<string>();

  function push(value: string) {
    const cleaned = value.trim().replace(/\s+/g, " ");
    if (!cleaned) return;
    const key = normalizeTitleText(cleaned);
    if (!key || seen.has(key)) return;
    seen.add(key);
    expanded.push(cleaned);
  }

  // The literal keywords always go first so they are never lost to the cap.
  for (const keyword of keywords) {
    push(keyword);
  }

  // Each keyword yields a set of base terms: its own role stem plus any
  // full-word discipline forms, e.g. "Geotech" -> Geotechnical, Geotechnics.
  const basesByKeyword = keywords.map((keyword) => {
    const stem = keywordStem(keyword);
    const root = stem || normalizeTitleText(keyword);
    const synonyms = [
      ...(DISCIPLINE_SYNONYMS[root] ?? []),
      ...(DISCIPLINE_SYNONYMS[normalizeTitleText(keyword)] ?? [])
    ];

    return {
      keyword,
      bases: Array.from(new Set([root, ...synonyms.map(normalizeTitleText)].filter(Boolean)))
    };
  });

  // Bare discipline terms next: "Geotechnical" on its own is a common title word.
  for (const { bases } of basesByKeyword) {
    for (const base of bases) push(titleCase(base));
  }

  for (const { bases } of basesByKeyword) {
    for (const base of bases) {
      for (const suffix of PRIORITY_SUFFIXES) push(`${titleCase(base)} ${suffix}`);
    }
  }

  for (const { bases } of basesByKeyword) {
    for (const base of bases) {
      for (const suffix of ROLE_SUFFIXES) push(`${titleCase(base)} ${suffix}`);
    }
  }

  for (const { bases } of basesByKeyword) {
    for (const base of bases) {
      for (const prefix of SENIORITY_PREFIXES) push(`${prefix} ${titleCase(base)} Engineer`);
    }
  }

  return expanded.slice(0, MAX_EXPANDED_KEYWORDS);
}

/**
 * Keywords used for post-filtering. Only what the user typed is used here — the
 * generated variants widen the Lusha query but must not widen what counts as a
 * match, otherwise "Temporary Works" would start matching plain "Design Manager".
 */
export function cleanKeywords(keywords?: string[]) {
  return Array.from(
    new Set((keywords ?? []).map((keyword) => keyword.trim()).filter(Boolean))
  );
}
