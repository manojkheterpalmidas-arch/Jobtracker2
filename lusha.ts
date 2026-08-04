import { getStartDate, isOnOrAfter, toIsoDate } from "@/lib/date";
import { normalizeDomain } from "@/lib/domain";
import { generateSuggestedMessage } from "@/lib/messageTemplates";
import { buildProfileMidasMentionResult, decisionMakerScore } from "@/lib/profileMidasMentionScoring";
import {
  classifyPriority,
  excludeIrrelevantTitles,
  scoreContactJobChange,
  suggestedSalesAction
} from "@/lib/scoring";
import { cleanKeywords, expandKeywords, matchKeywords } from "@/lib/keywordSearch";
import {
  defaultTitleKeywords,
  type ContactRevealField,
  type ContactJobChange,
  type LushaContact,
  type LushaSignal,
  type MatchType,
  type MovementDirection,
  type ProfileMidasMentionRequest,
  type ProfileMidasMentionResponse,
  type RevealedContactDetails,
  type SearchRequest,
  type SearchResponse
} from "@/lib/types";

const LUSHA_BASE_URL = "https://api.lusha.com";
const MAX_RESULTS = 50;
/**
 * Pages the keyword recall fallback will scan before giving up. Scanning stops
 * early as soon as a keyword match is found, so the full cost is only paid when
 * the role genuinely is not present at the target company.
 */
const KEYWORD_FALLBACK_PAGES = 4;

type LushaBilling = {
  creditsCharged?: number;
  resultsReturned?: number;
};

type LushaContactSearchResponse = {
  requestId?: string;
  results?: LushaContact[];
  contacts?: LushaContact[];
  pagination?: { total?: number };
  billing?: LushaBilling;
};

type SearchJobChangesOptions = SearchRequest & {
  normalizedDomain?: string;
  normalizedDomains?: string[];
};

type ProfileMidasMentionOptions = ProfileMidasMentionRequest & {
  normalizedDomain?: string;
  normalizedDomains?: string[];
};

type LushaLocationFilter = {
  city?: string;
  state?: string;
  country?: string;
};

const countryAliases = new Map<string, string>([
  ["uk", "United Kingdom"],
  ["u.k.", "United Kingdom"],
  ["gb", "United Kingdom"],
  ["great britain", "United Kingdom"],
  ["england", "United Kingdom"],
  ["scotland", "United Kingdom"],
  ["wales", "United Kingdom"],
  ["northern ireland", "United Kingdom"],
  ["bosnia", "Bosnia and Herzegovina"],
  ["bosnia-herzegovina", "Bosnia and Herzegovina"],
  ["bosnia & herzegovina", "Bosnia and Herzegovina"],
  ["macedonia", "North Macedonia"],
  ["republic of ireland", "Ireland"],
  ["holy see", "Vatican City"],
  ["russia", "Russian Federation"],
  ["russian federation", "Russian Federation"],
  ["turkiye", "Turkey"],
  ["türkiye", "Turkey"],
  ["usa", "United States"],
  ["us", "United States"],
  ["u.s.", "United States"],
  ["united states of america", "United States"],
  ["uae", "United Arab Emirates"]
]);

const commonCountries = new Set([
  "albania",
  "andorra",
  "argentina",
  "armenia",
  "australia",
  "austria",
  "azerbaijan",
  "bahrain",
  "bangladesh",
  "belarus",
  "belgium",
  "bosnia and herzegovina",
  "brazil",
  "bulgaria",
  "canada",
  "chile",
  "china",
  "colombia",
  "croatia",
  "cyprus",
  "czech republic",
  "czechia",
  "denmark",
  "egypt",
  "estonia",
  "finland",
  "france",
  "georgia",
  "germany",
  "greece",
  "hong kong",
  "hungary",
  "iceland",
  "india",
  "indonesia",
  "ireland",
  "israel",
  "italy",
  "japan",
  "jordan",
  "kazakhstan",
  "kosovo",
  "kuwait",
  "latvia",
  "lebanon",
  "liechtenstein",
  "lithuania",
  "luxembourg",
  "malaysia",
  "malta",
  "mexico",
  "moldova",
  "monaco",
  "montenegro",
  "morocco",
  "netherlands",
  "new zealand",
  "north macedonia",
  "norway",
  "oman",
  "pakistan",
  "philippines",
  "poland",
  "portugal",
  "qatar",
  "romania",
  "russian federation",
  "saudi arabia",
  "san marino",
  "serbia",
  "singapore",
  "slovakia",
  "slovenia",
  "south africa",
  "south korea",
  "spain",
  "sweden",
  "switzerland",
  "taiwan",
  "thailand",
  "turkey",
  "ukraine",
  "united arab emirates",
  "united kingdom",
  "united states",
  "vatican city",
  "vietnam"
]);

function normalizeLocationName(value: string) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  return countryAliases.get(trimmed.toLowerCase()) ?? trimmed;
}

function looksLikeCountry(value: string) {
  const normalized = normalizeLocationName(value).toLowerCase();
  return commonCountries.has(normalized);
}

function parseLushaLocation(input?: string): LushaLocationFilter[] | undefined {
  const value = input?.trim();
  if (!value) return undefined;

  const parts = value.split(",").map((part) => normalizeLocationName(part)).filter(Boolean);

  if (parts.length >= 3) {
    const [city, state, ...countryParts] = parts;
    return [{ city, state, country: countryParts.join(", ") }];
  }

  if (parts.length === 2) {
    const [cityOrState, country] = parts;
    return [{ city: cityOrState, country }];
  }

  const location = normalizeLocationName(value);
  return looksLikeCountry(location) ? [{ country: location }] : [{ city: location }];
}

export class LushaApiError extends Error {
  status: number;
  friendlyMessage: string;

  constructor(status: number, message: string) {
    super(message);
    this.name = "LushaApiError";
    this.status = status;
    this.friendlyMessage = friendlyLushaError(status, message);
  }
}

function friendlyLushaError(status: number, message: string) {
  if (status === 401) return "Lusha authentication failed. Check LUSHA_API_KEY in your environment variables.";
  if (status === 402) return "Lusha returned an insufficient credits or payment-required response.";
  if (status === 403) return "Lusha rejected this request for the current account or plan. Signals/prospecting may need to be enabled.";
  if (status === 429) return "Lusha rate limit exceeded. Wait briefly and try again.";
  if (status === 451) return "Lusha blocked this request for legal or regional compliance reasons.";
  if (status >= 500) return "Lusha is currently returning a server error. Try again shortly.";
  return message || "Lusha request failed.";
}

function apiKey(localLushaApiKey?: string) {
  const envKey = process.env.LUSHA_API_KEY?.trim();

  if (envKey) {
    return envKey;
  }

  // Manual key input is supported for this lightweight deployed workflow. The key
  // is used only for the current server request and is never returned to the UI.
  return localLushaApiKey?.trim();
}

async function lushaFetch<T>(path: string, init: RequestInit, localLushaApiKey?: string) {
  const key = apiKey(localLushaApiKey);

  if (!key) {
    throw new LushaApiError(401, "Missing LUSHA_API_KEY.");
  }

  const response = await fetch(`${LUSHA_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      api_key: key,
      ...init.headers
    },
    cache: "no-store"
  });

  const text = await response.text();
  const data = text ? safeJsonParse(text) : undefined;

  if (!response.ok) {
    const message =
      typeof data?.message === "string"
        ? data.message
        : typeof data?.error?.message === "string"
          ? data.error.message
          : response.statusText;
    throw new LushaApiError(response.status, message);
  }

  return data as T;
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function textValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["email", "value", "address", "phone", "number", "rawNumber", "internationalNumber"]) {
      const candidate = record[key];
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
  }
  return "";
}

function collectStringValues(...values: unknown[]) {
  const flattened = values.flatMap((value) => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  });

  return Array.from(new Set(flattened.map(textValue).filter(Boolean)));
}

function firstContactLike(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};

  const record = value as Record<string, unknown>;
  const arrayCandidates = [
    record.contacts,
    record.results,
    record.data,
    record.items
  ];

  for (const candidate of arrayCandidates) {
    if (Array.isArray(candidate) && candidate[0] && typeof candidate[0] === "object") {
      return candidate[0] as Record<string, unknown>;
    }
  }

  for (const key of ["contact", "person", "profile"]) {
    const candidate = record[key];
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      return candidate as Record<string, unknown>;
    }
  }

  return record;
}

export async function revealContactDetails(params: {
  contactId: string;
  reveal: ContactRevealField[];
  localLushaApiKey?: string;
}): Promise<RevealedContactDetails> {
  const data = await lushaFetch<Record<string, unknown>>("/v3/contacts/enrich", {
    method: "POST",
    body: JSON.stringify({
      ids: [params.contactId],
      reveal: params.reveal
    })
  }, params.localLushaApiKey);

  const contact = firstContactLike(data);
  const emails = collectStringValues(contact.emails, contact.email, contact.workEmail, contact.emailAddresses);
  const phones = collectStringValues(contact.phones, contact.phoneNumbers, contact.phone, contact.mobilePhone, contact.directDial);
  const billing = data.billing && typeof data.billing === "object" ? data.billing as LushaBilling : undefined;

  return {
    contactId: params.contactId,
    emails,
    phones,
    creditsUsed: billing?.creditsCharged,
    apiCallsUsed: 1,
    source: "Lusha"
  };
}

function selectedTitleKeywords(request: SearchRequest) {
  if (request.titleFilterMode === "no_title_filter") {
    return [];
  }

  const defaults = defaultTitleKeywords[request.discipline] ?? [];
  const custom = request.customTitleKeywords ?? [];
  const keywords =
    request.titleFilterMode === "custom_only" && custom.length
      ? custom
      : request.titleFilterMode === "defaults_plus_custom"
        ? [...defaults, ...custom]
        : defaults;

  return Array.from(new Set(keywords.map((value) => value.trim()).filter(Boolean)));
}

function selectedCompanyDomains(params: SearchJobChangesOptions) {
  if (params.normalizedDomains?.length) {
    return params.normalizedDomains;
  }

  return params.normalizedDomain ? [params.normalizedDomain] : [];
}

function buildProspectingPayload(params: SearchJobChangesOptions, startDate: string) {
  const titleKeywords = selectedTitleKeywords(params);
  const companyDomains = selectedCompanyDomains(params);
  const companyInclude = companyDomains.length
    ? { domains: companyDomains }
    : { names: [params.companyName || ""].filter(Boolean) };
  const includeCompanyFilter = params.movementDirection === "joined";
  const contactInclude: {
    departments: string[];
    jobTitles?: string[];
    locations?: LushaLocationFilter[];
    signals: {
      types: string[];
      startDate: string;
    };
  } = {
    departments: ["Engineering & Technical"],
    locations: parseLushaLocation(params.location),
    signals: {
      types: ["companyChange"],
      startDate
    }
  };

  if (titleKeywords.length) {
    contactInclude.jobTitles = titleKeywords;
  }

  const filters: {
    contacts: {
      include: typeof contactInclude;
    };
    companies?: {
      include: { domains: string[] } | { names: Array<string | undefined> };
    };
  } = {
    contacts: {
      include: contactInclude
    }
  };

  if (includeCompanyFilter) {
    filters.companies = {
      include: companyInclude
    };
  }

  // Lusha V3 validates filter keys strictly. Keep endpoint-specific names isolated
  // here so account-specific payload changes do not leak through the app.
  // Seniority values in our UI are human-readable labels; Lusha expects numeric
  // seniorityIds from the filters API, so we do not send that field until a
  // dynamic lookup/cache is added. For "left company" mode, the contact's current
  // company is no longer the searched company, so we search signal-matched
  // engineering contacts and post-filter companyChange.previousCompany.
  return {
    pagination: {
      page: 0,
      size: MAX_RESULTS
    },
    filters,
    options: {
      includePartialProfiles: true
    }
  };
}

export async function searchContacts(params: SearchJobChangesOptions, startDate: string) {
  return lushaFetch<{
    requestId?: string;
    results?: LushaContact[];
    contacts?: LushaContact[];
    pagination?: { total?: number };
    billing?: LushaBilling;
  }>("/v3/contacts/prospecting", {
    method: "POST",
    body: JSON.stringify(buildProspectingPayload(params, startDate))
  }, params.localLushaApiKey);
}

/** Keywords the user typed, used for both querying and post-filtering. */
function profileUserKeywords(params: ProfileMidasMentionOptions) {
  return cleanKeywords(params.customTitleKeywords);
}

/**
 * True when the search should be driven by the user's keyword rather than by the
 * generic senior-title list. This is what makes "Temporary Works Designer"
 * return temporary works designers instead of every Director at the company.
 */
function isKeywordDrivenSearch(params: ProfileMidasMentionOptions) {
  const mode = params.keywordMode ?? "expanded";
  return mode !== "blended" && profileUserKeywords(params).length > 0;
}

function profileTitleKeywords(params: ProfileMidasMentionOptions) {
  const userKeywords = profileUserKeywords(params);

  if (isKeywordDrivenSearch(params)) {
    // Send only the keyword (and, in expanded mode, close title variants of the
    // same role). Mixing in generic senior titles is what buried the keyword.
    return (params.keywordMode ?? "expanded") === "exact"
      ? userKeywords
      : expandKeywords(userKeywords);
  }

  const decisionMakerTitles = [
    "Associate Director",
    "Director",
    "Technical Director",
    "Technical Manager",
    "Engineering Manager",
    "Managing Director",
    "Regional Director",
    "Discipline Lead",
    "Technical Lead",
    "Team Leader",
    "Head of Department",
    "Head of Engineering",
    "Head of Structures",
    "Head of Bridges",
    "Principal",
    "Principal Engineer",
    "Partner",
    "Owner",
    "Founder",
    "Professor",
    "Assistant Professor",
    "Associate Professor"
  ];

  if (params.discipline === "all_engineering") {
    return [
      "Engineer",
      "Senior Engineer",
      "Principal Engineer",
      "Associate Engineer",
      "Technical Director",
      "Director",
      "Head of Engineering",
      ...decisionMakerTitles
    ];
  }

  if (params.discipline === "civil_engineering") {
    return [
      "Civil Engineer",
      "Senior Civil Engineer",
      "Principal Civil Engineer",
      "Civil Engineering Manager",
      "Technical Director Civil",
      ...decisionMakerTitles
    ];
  }

  if (params.discipline === "custom") {
    return [...decisionMakerTitles, ...(params.customTitleKeywords ?? [])];
  }

  const defaults = defaultTitleKeywords[params.discipline] ?? [];

  return [
    ...defaults,
    "Bridge Engineering",
    "Engineering Director",
    ...decisionMakerTitles
  ];
}

function selectedProfileCompanyDomains(params: ProfileMidasMentionOptions) {
  if (params.normalizedDomains?.length) return params.normalizedDomains;
  return params.normalizedDomain ? [params.normalizedDomain] : [];
}

/**
 * `titled`      - filter by job title (and, outside keyword mode, department).
 * `company_only`- company + location only; used as a keyword recall fallback and
 *                 post-filtered locally, so a weak Lusha title index cannot hide
 *                 a contact whose title clearly contains the keyword.
 * `broad`       - legacy unfiltered fallback, blended mode only.
 */
type CompanyContactSearchMode = "titled" | "company_only" | "broad";

/**
 * Keyword searches pull a wider candidate pool than the user's check limit,
 * because the limit should cap how many contacts are *enriched* (the costly
 * step), not how many are considered. Otherwise the one matching contact can be
 * truncated out of the page before it is ever scored.
 */
function contactPoolSize(params: ProfileMidasMentionOptions) {
  return isKeywordDrivenSearch(params)
    ? Math.min(200, Math.max(params.maxContactsToCheck, 100))
    : Math.min(params.maxContactsToCheck, 200);
}

function buildCompanyContactPayload(
  params: ProfileMidasMentionOptions,
  mode: CompanyContactSearchMode = "titled"
) {
  const keywordDriven = isKeywordDrivenSearch(params);
  const titleKeywords = keywordDriven
    ? profileTitleKeywords(params)
    : Array.from(new Set([
      ...profileTitleKeywords(params),
      ...(params.customTitleKeywords ?? [])
    ].map((value) => value.trim()).filter(Boolean)));
  const contactInclude: {
    departments?: string[];
    jobTitles?: string[];
    locations?: LushaLocationFilter[];
  } = {
    locations: parseLushaLocation(params.location)
  };

  // The department filter is deliberately skipped for keyword searches. At
  // contractors, roles such as temporary works sit under Construction or
  // Operations, so "Engineering & Technical" silently removed them server-side.
  if (mode === "titled" && !keywordDriven) {
    contactInclude.departments = ["Engineering & Technical"];
  }

  if (mode === "titled" && titleKeywords.length) {
    contactInclude.jobTitles = titleKeywords;
  }

  const filters: {
    contacts?: {
      include: typeof contactInclude;
    };
    companies: {
      include: { domains: string[] } | { names: string[] };
    };
  } = {
    companies: {
      include: selectedProfileCompanyDomains(params).length
        ? { domains: selectedProfileCompanyDomains(params) }
        : { names: [params.companyName || ""].filter(Boolean) }
    }
  };

  if (Object.values(contactInclude).some(Boolean)) {
    filters.contacts = {
      include: contactInclude
    };
  }

  const poolSize = contactPoolSize(params);

  return {
    pagination: {
      page: 0,
      size: poolSize
    },
    filters,
    options: {
      includePartialProfiles: true
    }
  };
}

export async function searchContactsInCompany(
  params: ProfileMidasMentionOptions,
  options?: { mode?: CompanyContactSearchMode; page?: number }
) {
  const payload = buildCompanyContactPayload(params, options?.mode ?? "titled");

  if (options?.page) {
    payload.pagination.page = options.page;
  }

  return lushaFetch<LushaContactSearchResponse>("/v3/contacts/prospecting", {
    method: "POST",
    body: JSON.stringify(payload)
  }, params.localLushaApiKey);
}

export async function enrichContactProfile(contactId: string, localLushaApiKey?: string) {
  // Lusha enrichment endpoint availability can vary by account/API version. The
  // v2 person enrichment API supports personId; if unavailable, caller falls
  // back to the prospecting contact object and local detection still works.
  return lushaFetch<LushaContact>("/v2/person", {
    method: "POST",
    body: JSON.stringify({ personId: contactId })
  }, localLushaApiKey);
}

export async function getContactSignals(
  contacts: LushaContact[],
  startDate: string,
  maxSignalLookups: number,
  localLushaApiKey?: string
) {
  const ids = contacts.map((contact) => contact.id).filter(Boolean).slice(0, maxSignalLookups) as string[];

  if (!ids.length) {
    return { results: [], billing: { creditsCharged: 0, resultsReturned: 0 } };
  }

  return lushaFetch<{
    results?: Array<{ id?: string; companyChange?: LushaSignal[]; promotion?: LushaSignal[] }>;
    startDate?: string;
    endDate?: string;
    billing?: LushaBilling;
  }>("/v3/contacts/signals", {
    method: "POST",
    body: JSON.stringify({
      ids,
      signalTypes: ["companyChange"],
      startDate
    })
  }, localLushaApiKey);
}

function contactName(contact?: LushaContact) {
  return (
    contact?.fullName ||
    [contact?.firstName, contact?.lastName].filter(Boolean).join(" ") ||
    "Unknown contact"
  );
}

function contactTitle(contact?: LushaContact) {
  if (typeof contact?.jobTitle === "string") return contact.jobTitle;
  return contact?.jobTitle?.title || contact?.title || "Unknown title";
}

function contactLocation(contact?: LushaContact) {
  return [contact?.location?.city, contact?.location?.state, contact?.location?.country]
    .filter(Boolean)
    .join(", ");
}

function contactSkills(contact?: LushaContact) {
  return Array.isArray(contact?.skills) ? contact.skills.filter((skill) => typeof skill === "string") : [];
}

function contactProfileText(contact?: LushaContact) {
  return [contact?.summary, contact?.description].filter(Boolean).join(" ");
}

function signalCompany(signal: LushaSignal, key: "previous" | "new") {
  if (key === "previous") {
    return signal.previousCompanyName || signal.previousCompany || "Unknown previous company";
  }

  return signal.newCompanyName || signal.currentCompanyName || signal.newCompany || signal.currentCompany || "Unknown new company";
}

function signalDomain(signal: LushaSignal, key: "previous" | "new") {
  if (key === "previous") {
    return normalizeDomain(signal.previousCompanyDomain || signal.previousDomain || "");
  }

  return normalizeDomain(signal.newCompanyDomain || signal.currentCompanyDomain || signal.newDomain || "");
}

function normalizeCompanyName(value?: string) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function companyMatchesTarget(domain: string | undefined, name: string | undefined, params: SearchJobChangesOptions) {
  const targetDomains = selectedCompanyDomains(params);
  const targetName = normalizeCompanyName(params.companyName);
  const candidateDomain = normalizeDomain(domain || "");
  const candidateName = normalizeCompanyName(name);

  if (candidateDomain && targetDomains.includes(candidateDomain)) {
    return true;
  }

  if (!targetDomains.length && targetName && candidateName) {
    return candidateName === targetName || candidateName.includes(targetName) || targetName.includes(candidateName);
  }

  return false;
}

function movementMatches(record: ContactJobChange, params: SearchJobChangesOptions) {
  const left = companyMatchesTarget(record.previousCompanyDomain, record.previousCompany, params);
  const joined = companyMatchesTarget(record.newCompanyDomain, record.newCompany, params);

  if (params.movementDirection === "left") return left;
  if (params.movementDirection === "joined") return joined;
  return left || joined;
}

function movementLabel(direction: MovementDirection) {
  if (direction === "left") return "people who left the company";
  if (direction === "joined") return "people who joined the company";
  return "people who left or joined the company";
}

function normalizeJobChange(
  contact: LushaContact | undefined,
  signal: LushaSignal,
  lastCheckedDate: string,
  boostMidasMentions: boolean
) {
  const newTitle = signal.newTitle || contactTitle(contact);
  const previousTitle = signal.previousTitle || contactTitle(contact);
  const linkedinUrl = contact?.socialLinks?.linkedin || contact?.linkedinUrl;
  const signalDate = signal.signalDate?.slice(0, 10) || lastCheckedDate;

  const base: ContactJobChange = {
    id: [
      contact?.id,
      linkedinUrl,
      contactName(contact),
      signalDomain(signal, "previous"),
      signalDomain(signal, "new"),
      signalDate
    ]
      .filter(Boolean)
      .join("|"),
    lushaContactId: contact?.id,
    personName: contactName(contact),
    previousCompany: signalCompany(signal, "previous"),
    previousCompanyDomain: signalDomain(signal, "previous"),
    previousTitle,
    newCompany: signalCompany(signal, "new"),
    newCompanyDomain: signalDomain(signal, "new"),
    newTitle,
    location: contactLocation(contact),
    linkedinUrl,
    skills: contactSkills(contact),
    profileText: contactProfileText(contact),
    signalDate,
    relevanceScore: 0,
    priorityLevel: "Monitor",
    suggestedSalesAction: "Monitor only",
    suggestedMessage: "",
    source: "Lusha",
    lastCheckedDate
  };

  const relevanceScore = scoreContactJobChange({ ...base, boostMidasMentions });
  const priorityLevel = classifyPriority(relevanceScore, `${base.previousTitle} ${base.newTitle}`, base.signalDate);

  return {
    ...base,
    relevanceScore,
    priorityLevel,
    suggestedSalesAction: suggestedSalesAction(priorityLevel, `${base.previousTitle} ${base.newTitle}`),
    suggestedMessage: generateSuggestedMessage(base)
  };
}

function dedupe(records: ContactJobChange[]) {
  const seen = new Set<string>();

  return records.filter((record) => {
    const key =
      record.lushaContactId ||
      record.linkedinUrl ||
      [
        record.personName,
        record.previousCompanyDomain,
        record.newCompanyDomain,
        record.previousCompany,
        record.newCompany
      ]
        .filter(Boolean)
        .join("|")
        .toLowerCase();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function sortResults(records: ContactJobChange[]) {
  return [...records].sort((a, b) => {
    if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
    return b.signalDate.localeCompare(a.signalDate);
  });
}

function buildResponse(
  results: ContactJobChange[],
  summary: Omit<SearchResponse["summary"], "jobChangesFound" | "highPriorityContacts">,
  warnings: string[]
): SearchResponse {
  return {
    results,
    summary: {
      ...summary,
      jobChangesFound: results.length,
      highPriorityContacts: results.filter((result) => result.priorityLevel === "High").length
    },
    warnings
  };
}

function mockSignals(lastCheckedDate: string, boostMidasMentions: boolean): ContactJobChange[] {
  const rows: Array<Omit<ContactJobChange, "relevanceScore" | "priorityLevel" | "suggestedSalesAction" | "suggestedMessage" | "source" | "lastCheckedDate">> = [
    {
      id: "mock-wsp-bridge",
      lushaContactId: "mock-1001",
      personName: "Sarah Whitfield",
      previousCompany: "WSP",
      previousCompanyDomain: "wsp.com",
      previousTitle: "Senior Bridge Engineer",
      newCompany: "Northline Consulting Engineers",
      newCompanyDomain: "northline-engineers.example",
      newTitle: "Associate Bridge Engineer",
      location: "Manchester, United Kingdom",
      linkedinUrl: "https://www.linkedin.com/in/sarah-whitfield-bridge",
      skills: ["MIDAS Civil", "Bridge assessment", "Eurocodes"],
      profileText: "Bridge analysis and structural assessment using MIDAS Civil.",
      signalDate: getStartDate(21)
    },
    {
      id: "mock-arcadis-structural",
      lushaContactId: "mock-1002",
      personName: "James Patel",
      previousCompany: "Arcadis",
      previousCompanyDomain: "arcadis.com",
      previousTitle: "Principal Structural Engineer",
      newCompany: "Harbour Structures Ltd",
      newCompanyDomain: "harbourstructures.example",
      newTitle: "Technical Lead, Civil Structures",
      location: "London, United Kingdom",
      linkedinUrl: "https://www.linkedin.com/in/james-patel-structures",
      skills: ["Structural analysis", "FEM"],
      profileText: "Principal structural engineer with civil structures experience.",
      signalDate: getStartDate(47)
    },
    {
      id: "mock-mottmac-director",
      lushaContactId: "mock-1003",
      personName: "Emma MacLeod",
      previousCompany: "Mott MacDonald",
      previousCompanyDomain: "mottmac.com",
      previousTitle: "Technical Director Bridges",
      newCompany: "Civic Bridge Partners",
      newCompanyDomain: "civicbridgepartners.example",
      newTitle: "Director of Bridges",
      location: "Glasgow, United Kingdom",
      linkedinUrl: "https://www.linkedin.com/in/emma-macleod-bridges",
      skills: ["MIDAS Civil NX", "Bridge design", "Design management"],
      profileText: "Technical director for bridge teams using MIDAS and assessment workflows.",
      signalDate: getStartDate(82)
    },
    {
      id: "mock-irrelevant",
      lushaContactId: "mock-1004",
      personName: "Alex Morgan",
      previousCompany: "WSP",
      previousCompanyDomain: "wsp.com",
      previousTitle: "Recruitment Marketing Manager",
      newCompany: "TalentWorks",
      newCompanyDomain: "talentworks.example",
      newTitle: "HR Marketing Lead",
      location: "Birmingham, United Kingdom",
      linkedinUrl: "https://www.linkedin.com/in/alex-morgan-hr",
      skills: ["Recruitment marketing"],
      profileText: "HR and recruitment marketing.",
      signalDate: getStartDate(12)
    }
  ];

  return rows
    .map((row) => {
      const base: ContactJobChange = {
        ...row,
        relevanceScore: 0,
        priorityLevel: "Monitor",
        suggestedSalesAction: "Monitor only",
        suggestedMessage: "",
        source: "Lusha",
        lastCheckedDate
      };
      const relevanceScore = scoreContactJobChange({ ...base, boostMidasMentions });
      const priorityLevel = classifyPriority(relevanceScore, `${base.previousTitle} ${base.newTitle}`, base.signalDate);

      return {
        ...base,
        relevanceScore,
        priorityLevel,
        suggestedSalesAction: suggestedSalesAction(priorityLevel, `${base.previousTitle} ${base.newTitle}`),
        suggestedMessage: generateSuggestedMessage(base)
      };
    })
    .filter((row) => !excludeIrrelevantTitles(`${row.previousTitle} ${row.newTitle}`));
}

function mockSearchResponse(params: SearchJobChangesOptions, startDate: string, warnings: string[]): SearchResponse {
  const lastCheckedDate = toIsoDate(new Date());
  const results = mockSignals(lastCheckedDate, params.boostMidasMentions).filter(
    (record) => isOnOrAfter(record.signalDate, startDate) && movementMatches(record, params)
  );

  return buildResponse(sortResults(results), {
    totalContactsFound: 4,
    matchType: "mock",
    movementDirection: params.movementDirection,
    creditsUsed: 0,
    apiCallsUsed: 0,
    signalLookupsRequested: 0,
    mockMode: true,
    lastCheckedAt: new Date().toISOString()
  }, [
    "Mock data: LUSHA_API_KEY is not configured, so no live Lusha calls were made.",
    ...warnings,
    selectedCompanyDomains(params).length
      ? `Mock search used domain-first matching logic for ${selectedCompanyDomains(params).length} target ${selectedCompanyDomains(params).length === 1 ? "company" : "companies"}.`
      : "Mock search used company-name fallback logic."
  ]);
}

export async function searchJobChanges(params: SearchJobChangesOptions): Promise<SearchResponse> {
  const startDate = getStartDate(params.durationDays);
  const companyDomains = selectedCompanyDomains(params);
  const matchType: MatchType = companyDomains.length ? "domain" : "name";
  const warnings: string[] = [];

  if (!companyDomains.length && params.companyName) {
    warnings.push("Company name fallback was used. Domain-based matching is more reliable.");
  }

  if (companyDomains.length > 1) {
    warnings.push(`Multi-company search: ${companyDomains.length} target domains were searched together.`);
  }

  if (params.movementDirection === "either") {
    warnings.push(
      `Movement filter: showing ${movementLabel(params.movementDirection)} by matching the selected company against companyChange previous/new company fields. Live signal checks are capped at ${params.maxSignalLookups} contacts to control Lusha credit use.`
    );
  }

  if (params.titleFilterMode === "no_title_filter") {
    warnings.push("No title filter was sent to Lusha. Results may be broader, but this can find contacts whose title is stored differently.");
  }

  if (!apiKey(params.localLushaApiKey)) {
    return mockSearchResponse(params, startDate, warnings);
  }

  const lastCheckedDate = toIsoDate(new Date());
  const contactSearch = await searchContacts(params, startDate);
  const contacts = contactSearch.results ?? contactSearch.contacts ?? [];
  const signalLookupsRequested = contacts.filter((contact) => contact.id).slice(0, params.maxSignalLookups).length;
  const signals = await getContactSignals(
    contacts,
    startDate,
    params.maxSignalLookups,
    params.localLushaApiKey
  );
  const byId = new Map(contacts.map((contact) => [contact.id, contact]));
  const records: ContactJobChange[] = [];

  for (const item of signals.results ?? []) {
    const contact = byId.get(item.id);

    for (const signal of item.companyChange ?? []) {
      if (!isOnOrAfter(signal.signalDate, startDate)) continue;

      const record = normalizeJobChange(contact, signal, lastCheckedDate, params.boostMidasMentions);
      if (excludeIrrelevantTitles(`${record.previousTitle} ${record.newTitle}`)) continue;
      if (!movementMatches(record, params)) continue;
      records.push(record);
    }
  }

  const creditsUsed =
    (contactSearch.billing?.creditsCharged ?? 0) + (signals.billing?.creditsCharged ?? 0);

  if (!contacts.length) {
    warnings.push("No contacts were found for the selected company and filters.");
  } else if (!records.length) {
    warnings.push(`Contacts were found, but no companyChange signals matched the selected duration and movement direction.`);
  }

  return buildResponse(sortResults(dedupe(records)), {
    totalContactsFound: contactSearch.pagination?.total ?? contactSearch.billing?.resultsReturned ?? contacts.length,
    matchType,
    movementDirection: params.movementDirection,
    creditsUsed,
    apiCallsUsed: 2,
    signalLookupsRequested,
    mockMode: false,
    lastCheckedAt: new Date().toISOString()
  }, warnings);
}

function mockProfileMentionContacts(targetCompany: string, targetDomain?: string): LushaContact[] {
  return [
    {
      id: "mock-profile-1",
      fullName: "Aisha Rahman",
      title: "Technical Director Structures",
      company: { name: targetCompany, domain: targetDomain },
      location: { city: "London", country: "United Kingdom" },
      linkedinUrl: "https://www.linkedin.com/in/aisha-rahman-structures",
      summary: "Technical director for structural and bridge engineering teams."
    },
    {
      id: "mock-profile-2",
      fullName: "Daniel Kovacs",
      title: "Principal Geotechnical Engineer",
      company: { name: targetCompany, domain: targetDomain },
      location: { city: "Budapest", country: "Hungary" },
      linkedinUrl: "https://www.linkedin.com/in/daniel-kovacs-geotechnical",
      experiences: [{ description: "Ground engineering and tunnel design leadership." }]
    },
    {
      id: "mock-profile-3",
      fullName: "Priya Shah",
      title: "Associate Director Bridges",
      company: { name: targetCompany, domain: targetDomain },
      location: { city: "Manchester", country: "United Kingdom" },
      linkedinUrl: "https://www.linkedin.com/in/priya-shah-civil"
    },
    {
      id: "mock-profile-4",
      fullName: "Chris Walker",
      title: "Civil Engineer",
      company: { name: targetCompany, domain: targetDomain },
      location: { city: "Bristol", country: "United Kingdom" },
      linkedinUrl: "https://www.linkedin.com/in/chris-walker-civil",
      summary: "Civil engineer delivering infrastructure design projects."
    },
    {
      id: "mock-profile-5",
      fullName: "Morgan Lee",
      title: "Recruitment Manager",
      company: { name: targetCompany, domain: targetDomain },
      location: { city: "London", country: "United Kingdom" },
      linkedinUrl: "https://www.linkedin.com/in/morgan-lee-recruitment",
      summary: "Recruitment and employer branding."
    }
  ];
}

function summarizeProfileMentionResults(
  results: ProfileMidasMentionResponse["results"],
  apiCallsUsed: number,
  creditsUsed: number | undefined,
  mockMode: boolean,
  filteredOutByKeyword = 0
): ProfileMidasMentionResponse["summary"] {
  return {
    contactsChecked: results.length,
    decisionMakersFound: results.filter((result) => result.championFit !== "low").length,
    highConfidence: results.filter((result) => result.championFit === "high").length,
    mediumConfidence: results.filter((result) => result.championFit === "medium").length,
    lowConfidence: results.filter((result) => result.championFit === "low").length,
    keywordMatches: results.filter((result) => result.matchedKeywords.length > 0).length,
    filteredOutByKeyword,
    apiCallsUsed,
    creditsUsed,
    mockMode
  };
}

function extractContacts(response: LushaContactSearchResponse) {
  return response.results ?? response.contacts ?? [];
}

function contactDedupeKey(contact: LushaContact) {
  return (
    contact.id ||
    contact.socialLinks?.linkedin ||
    contact.linkedinUrl ||
    [
      contact.fullName || [contact.firstName, contact.lastName].filter(Boolean).join(" "),
      typeof contact.jobTitle === "string" ? contact.jobTitle : contact.jobTitle?.title || contact.title,
      contact.company?.domain || contact.company?.name
    ]
      .filter(Boolean)
      .join("|")
      .toLowerCase()
  );
}

function mergeContacts(...groups: LushaContact[][]) {
  const seen = new Set<string>();
  const merged: LushaContact[] = [];

  for (const contact of groups.flat()) {
    const key = contactDedupeKey(contact);

    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(contact);
  }

  return merged;
}

export async function findProfileMidasMentions(
  params: ProfileMidasMentionOptions
): Promise<ProfileMidasMentionResponse> {
  const warnings = [
    "Decision-maker search uses Lusha prospecting and can consume credits based on the selected contact limit."
  ];
  const checkedAt = new Date().toISOString();
  const targetDomains = selectedProfileCompanyDomains(params);

  if (targetDomains.length > 1) {
    warnings.push(`${targetDomains.length} target company domains were searched together.`);
  }

  if (!apiKey(params.localLushaApiKey)) {
    const targets = targetDomains.length ? targetDomains : [params.companyName || "Target company"];
    const contacts = targets.flatMap((domain, index) => (
      mockProfileMentionContacts(
        targets.length === 1 && params.companyName ? params.companyName : domain,
        targetDomains.length ? domain : undefined
      ).map((contact) => ({ ...contact, id: `${contact.id ?? "mock"}-${index}` }))
    )).slice(0, params.maxContactsToCheck);
    const mockKeywords = profileUserKeywords(params);
    const mockKeywordDriven = isKeywordDrivenSearch(params);
    const results = contacts
      .filter((contact) => {
        const title = contactTitle(contact);
        if (matchKeywords(title, mockKeywords).matchedKeywords.length) return true;
        if (mockKeywordDriven) return false;
        return !excludeIrrelevantTitles(title);
      })
      .map((contact) => buildProfileMidasMentionResult(contact, checkedAt, mockKeywords))
      .sort((a, b) => b.decisionMakerScore - a.decisionMakerScore);

    return {
      results,
      summary: summarizeProfileMentionResults(results, 0, 0, true),
      warnings: [
        "Mock data: LUSHA_API_KEY is not configured, so no live Lusha calls were made.",
        ...warnings
      ]
    };
  }

  const userKeywords = profileUserKeywords(params);
  const keywordDriven = isKeywordDrivenSearch(params);
  const contactSearch = await searchContactsInCompany(params);
  const filteredContacts = extractContacts(contactSearch);
  let contacts = filteredContacts;
  let fallbackSearch: LushaContactSearchResponse | undefined;
  let fallbackUsed = false;
  let filteredOutByKeyword = 0;
  let fallbackCreditsUsed = 0;
  let fallbackApiCalls = 0;

  if (keywordDriven) {
    warnings.push(
      params.keywordMode === "exact"
        ? `Exact keyword search: only contacts whose job title contains ${userKeywords.map((keyword) => `"${keyword}"`).join(" or ")} are returned.`
        : `Keyword search: Lusha was queried for "${userKeywords.join('", "')}" plus close title variants, and results were filtered back to your keyword.`
    );

    // Exact mode demands the literal phrase. Expanded mode accepts the role stem,
    // so a "Temporary Works Coordinator" surfaced by the widened query survives a
    // search for "Temporary Works Designer" instead of being filtered back out.
    const exactOnly = params.keywordMode === "exact";
    const isKeywordMatch = (contact: LushaContact) => {
      const match = matchKeywords(contactTitle(contact), userKeywords, { allowStem: !exactOnly });
      return exactOnly ? match.strength === "exact" : match.strength !== "none";
    };

    let pool = filteredContacts;
    let matched = pool.filter(isKeywordMatch);

    // When Lusha returns fewer contacts than the page size we asked for, its
    // title index is exhausted: that count is real coverage, not truncation, and
    // scanning the company again only re-finds the same people at credit cost
    // (measured: 4 extra pages, ~14 credits, zero new matches). So the direct
    // scan runs only when the title filter found nothing at all, which is
    // genuinely ambiguous between "nobody matches" and "the index missed a
    // non-standard title", as it did for "Geotech".
    const titleIndexExhausted = filteredContacts.length > 0 && filteredContacts.length < contactPoolSize(params);

    if (!matched.length && !titleIndexExhausted) {
      let pagesScanned = 0;

      for (let page = 0; page < KEYWORD_FALLBACK_PAGES; page += 1) {
        try {
          const pageResult = await searchContactsInCompany(params, { mode: "company_only", page });
          const pageContacts = extractContacts(pageResult);

          fallbackSearch = pageResult;
          fallbackUsed = true;
          pagesScanned += 1;
          fallbackApiCalls += 1;
          fallbackCreditsUsed += pageResult.billing?.creditsCharged ?? 0;

          pool = mergeContacts(pool, pageContacts);
          matched = pool.filter(isKeywordMatch);

          if (!pageContacts.length) break;
          if (matched.length >= params.maxContactsToCheck) break;
        } catch {
          break;
        }
      }

      if (pagesScanned) {
        warnings.push(
          `Keyword recall scan: Lusha's title filter returned only ${filteredContacts.length} contact${filteredContacts.length === 1 ? "" : "s"}, so the app also listed the target company and matched your keyword locally against ${pool.length} contacts across ${pagesScanned} ${pagesScanned === 1 ? "page" : "pages"}.`
        );
      }
    }

    filteredOutByKeyword = pool.length - matched.length;
    contacts = matched;

    if (filteredOutByKeyword > 0) {
      warnings.push(
        `${filteredOutByKeyword} contact${filteredOutByKeyword === 1 ? " was" : "s were"} scanned but dropped because the job title did not match your keyword.`
      );
    }

    if (titleIndexExhausted && matched.length < params.maxContactsToCheck) {
      warnings.push(
        `Lusha holds only ${filteredContacts.length} contact${filteredContacts.length === 1 ? "" : "s"} at this company and location whose job title matches your keyword, so this is Lusha's coverage rather than a filter limit. Many engineers do not carry the discipline in their job title at all — a "Principal Engineer" may well be a bridge engineer. To reach those people, widen the location to a country, or clear the keyword and use the Discipline dropdown instead.`
      );
    }

    if (!matched.length) {
      warnings.push(
        "If you expected more people here, the location filter is the most likely cause — try a country instead of a city, or clear it."
      );
    }
  } else if (filteredContacts.length < params.maxContactsToCheck) {
    try {
      fallbackSearch = await searchContactsInCompany(params, { mode: "broad" });
      const broadContacts = extractContacts(fallbackSearch);
      contacts = mergeContacts(filteredContacts, broadContacts);
      fallbackUsed = true;
      warnings.push(
        "Broad fallback used: the first title-filtered search returned fewer contacts than your selected cap, so the app also searched the target company without title/department filters and ranked the merged results locally."
      );
    } catch {
      warnings.push("Broad fallback search failed, so only the title-filtered contacts were scored.");
    }
  }

  // Rank before truncating so the check limit caps enrichment cost rather than
  // deciding, arbitrarily, which contacts get considered at all.
  if (keywordDriven) {
    contacts = contacts
      .map((contact) => ({ contact, score: decisionMakerScore(contact, userKeywords) }))
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.contact);
  }

  contacts = contacts.slice(0, params.maxContactsToCheck);
  const enrichedContacts: LushaContact[] = [];
  let enrichmentAttempts = 0;

  for (const contact of contacts) {
    if (!contact.id) {
      enrichedContacts.push(contact);
      continue;
    }

    enrichmentAttempts += 1;

    try {
      const enriched = await enrichContactProfile(contact.id, params.localLushaApiKey);
      const maybeContact = (enriched as unknown as { contact?: LushaContact; person?: LushaContact }).contact ||
        (enriched as unknown as { person?: LushaContact }).person ||
        enriched;
      enrichedContacts.push({ ...contact, ...maybeContact });
    } catch {
      enrichedContacts.push(contact);
    }
  }

  const results = enrichedContacts
    // The irrelevant-title blocklist is bypassed for keyword matches: if the user
    // searched for "Temporary Works Designer" or an architect, that is the answer,
    // not noise to be stripped out.
    .filter((contact) => {
      const title = contactTitle(contact);
      if (matchKeywords(title, userKeywords).matchedKeywords.length) return true;
      return !excludeIrrelevantTitles(title);
    })
    .map((contact) => buildProfileMidasMentionResult(contact, checkedAt, userKeywords))
    .sort((a, b) => b.decisionMakerScore - a.decisionMakerScore);

  if (!results.length) {
    warnings.push(
      keywordDriven
        ? `No contacts at the selected ${targetDomains.length > 1 ? "companies" : "company"} had a job title matching your keyword. Try "Keyword + close variants", a shorter keyword such as a role stem, a wider location, or a higher contact limit.`
        : "No decision-maker contacts were found for the selected company and filters."
    );
  }

  return {
    results,
    summary: summarizeProfileMentionResults(
      results,
      1 + (fallbackApiCalls || (fallbackUsed ? 1 : 0)) + enrichmentAttempts,
      (contactSearch.billing?.creditsCharged ?? 0) +
        (fallbackCreditsUsed || (fallbackSearch?.billing?.creditsCharged ?? 0)),
      false,
      filteredOutByKeyword
    ),
    warnings
  };
}
