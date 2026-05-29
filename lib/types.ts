import { z } from "zod";

export const durationOptions = [30, 60, 90, 180, 365, 730] as const;

export const disciplineOptions = [
  "structural_bridge",
  "geotechnical",
  "transport_highways",
  "rail_structures",
  "custom"
] as const;

export const profileMentionDisciplineOptions = [
  "structural_bridge",
  "geotechnical",
  "civil_engineering",
  "all_engineering",
  "custom"
] as const;

export const movementDirectionOptions = ["left", "joined", "either"] as const;
export const visibleMovementDirectionOptions = ["joined", "either"] as const;

export const movementDirectionLabels: Record<MovementDirection, string> = {
  left: "People who left this company",
  joined: "People who joined this company",
  either: "Either left or joined"
};

export const signalLookupLimitOptions = [10, 25, 50, 100] as const;
export const profileMentionContactLimitOptions = [25, 50, 100, 200] as const;
export const midasKeywordModeOptions = ["default", "custom", "default_plus_custom"] as const;
export const titleFilterModeOptions = [
  "defaults_plus_custom",
  "discipline_defaults",
  "custom_only",
  "no_title_filter"
] as const;

export const titleFilterModeLabels: Record<TitleFilterMode, string> = {
  defaults_plus_custom: "Defaults + custom keywords",
  discipline_defaults: "Use discipline defaults",
  custom_only: "Use only custom keywords",
  no_title_filter: "No title filter"
};

export const disciplineLabels: Record<Discipline, string> = {
  structural_bridge: "Structural / Bridge / Civil Structures",
  geotechnical: "Geotechnical",
  transport_highways: "Transport / Highways",
  rail_structures: "Rail Structures",
  custom: "Custom"
};

export const profileMentionDisciplineLabels: Record<ProfileMentionDiscipline, string> = {
  structural_bridge: "Structural / Bridge / Civil Structures",
  geotechnical: "Geotechnical",
  civil_engineering: "Civil Engineering",
  all_engineering: "All Engineering",
  custom: "Custom"
};

export const defaultTitleKeywords: Record<Discipline, string[]> = {
  structural_bridge: [
    "Structural Engineer",
    "Senior Structural Engineer",
    "Senior Engineer",
    "Principal Structural Engineer",
    "Principal Engineer",
    "Principal Engineer Rail and Civils",
    "Principal Engineer Rail & Civils",
    "Principal Engineer Bridges",
    "Principal Engineer Major Bridges",
    "Associate Structural Engineer",
    "Civil Engineer",
    "Senior Civil Engineer",
    "Civil Structural Engineer",
    "Structural Design Engineer",
    "Bridge Engineer",
    "Senior Bridge Engineer",
    "Principal Bridge Engineer",
    "Associate Director Bridges",
    "Technical Director Bridges",
    "Technical Director Structures",
    "Head of Bridges",
    "Head of Structures",
    "Technical Manager",
    "Structural Technical Manager",
    "Bridge Technical Manager",
    "Technical Manager Rail and Civils",
    "Technical Manager Rail & Civils",
    "Technical Manager Bridges",
    "Technical Manager Major Bridges",
    "Engineering Manager",
    "Structural Engineering Manager",
    "Civil Engineering Manager",
    "Design Manager",
    "Structural Design Manager",
    "Bridge Design Manager",
    "Technical Lead",
    "Structural Technical Lead",
    "Bridge Technical Lead",
    "Engineering Lead",
    "Structural Engineering Lead",
    "Design Lead",
    "Structural Design Lead",
    "Project Manager Structures",
    "Project Manager Bridges",
    "Project Manager Rail and Civils",
    "Civil Structures Manager",
    "Bridge Team Leader",
    "Structures Team Leader",
    "Structures Lead",
    "Bridge Lead",
    "Highways Structures Engineer",
    "Rail Structures Engineer",
    "Rail and Civils",
    "Rail & Civils",
    "Major Bridges",
    "Bridge Assessment Engineer",
    "Temporary Works Engineer"
  ],
  geotechnical: [
    "Geotechnical Engineer",
    "Senior Geotechnical Engineer",
    "Principal Geotechnical Engineer",
    "Geotechnical Consultant",
    "Ground Engineering",
    "Tunnelling Engineer",
    "Soil Structure Interaction",
    "Technical Manager Geotechnical",
    "Geotechnical Technical Manager",
    "Ground Engineering Manager",
    "Geotechnical Design Manager",
    "Geotechnical Technical Lead",
    "Ground Engineering Lead",
    "Geotechnical Director"
  ],
  transport_highways: [
    "Highways Engineer",
    "Senior Highways Engineer",
    "Principal Highways Engineer",
    "Transport Planner",
    "Infrastructure Engineer",
    "Roads Engineer",
    "Highways Technical Manager",
    "Transport Technical Manager",
    "Infrastructure Technical Manager",
    "Highways Design Manager",
    "Infrastructure Design Manager",
    "Highways Technical Lead",
    "Transport Lead",
    "Technical Director Highways"
  ],
  rail_structures: [
    "Rail Structures Engineer",
    "Senior Rail Structures Engineer",
    "Principal Rail Structures Engineer",
    "Principal Engineer Rail and Civils",
    "Principal Engineer Rail & Civils",
    "Rail Civil Engineer",
    "Civil Engineer Rail",
    "Technical Manager Rail and Civils",
    "Technical Manager Rail & Civils",
    "Rail Bridge Engineer",
    "Rail Structures Technical Manager",
    "Rail Technical Manager",
    "Rail Design Manager",
    "Rail Structures Technical Lead",
    "Rail Structures Lead",
    "Rail Engineering Manager",
    "Technical Director Rail"
  ],
  custom: []
};

export const SearchRequestSchema = z
  .object({
    companyDomain: z.string().trim().max(253).optional().or(z.literal("")),
    companyName: z.string().trim().max(120).optional().or(z.literal("")),
    location: z.string().trim().max(120).optional().or(z.literal("")),
    durationDays: z.union([
      z.literal(30),
      z.literal(60),
      z.literal(90),
      z.literal(180),
      z.literal(365),
      z.literal(730)
    ]),
    discipline: z.enum(disciplineOptions),
    movementDirection: z.enum(movementDirectionOptions).default("joined"),
    maxSignalLookups: z.union([
      z.literal(10),
      z.literal(25),
      z.literal(50),
      z.literal(100)
    ]).default(25),
    titleFilterMode: z.enum(titleFilterModeOptions).default("defaults_plus_custom"),
    boostMidasMentions: z.boolean().default(true),
    onlyKnownMidasAccounts: z.boolean().default(true),
    showUnknownPreviousCompanies: z.boolean().default(false),
    customTitleKeywords: z.array(z.string().trim().min(1).max(100)).max(40).optional(),
    seniority: z.array(z.string().trim().max(80)).max(8).optional(),
    localLushaApiKey: z.string().trim().max(300).optional().or(z.literal(""))
  })
  .refine((value) => Boolean(value.companyDomain || value.companyName), {
    message: "Enter either a company domain or a company name.",
    path: ["companyDomain"]
  });

export type DurationDays = (typeof durationOptions)[number];
export type Discipline = (typeof disciplineOptions)[number];
export type ProfileMentionDiscipline = (typeof profileMentionDisciplineOptions)[number];
export type MovementDirection = (typeof movementDirectionOptions)[number];
export type VisibleMovementDirection = (typeof visibleMovementDirectionOptions)[number];
export type SignalLookupLimit = (typeof signalLookupLimitOptions)[number];
export type ProfileMentionContactLimit = (typeof profileMentionContactLimitOptions)[number];
export type TitleFilterMode = (typeof titleFilterModeOptions)[number];
export type SearchRequest = z.infer<typeof SearchRequestSchema>;
export type MidasKeywordMode = (typeof midasKeywordModeOptions)[number];

export interface LushaContact {
  id?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  jobTitle?: { title?: string; seniority?: string; departments?: string[] } | string;
  title?: string;
  company?: {
    id?: string;
    name?: string;
    domain?: string;
    industry?: string;
  };
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
  socialLinks?: {
    linkedin?: string;
  };
  linkedinUrl?: string;
  skills?: string[];
  linkedinSkills?: string[];
  headline?: string;
  summary?: string;
  description?: string;
  experience?: unknown[];
  experiences?: unknown[];
  certifications?: unknown[];
  courses?: unknown[];
  education?: unknown[];
  technologies?: string[];
  tags?: string[];
}

export interface LushaSignal {
  id?: string;
  type?: string;
  signalDate?: string;
  previousCompany?: string;
  previousCompanyName?: string;
  previousDomain?: string;
  previousCompanyDomain?: string;
  currentCompany?: string;
  currentCompanyName?: string;
  currentCompanyDomain?: string;
  previousTitle?: string;
  newCompany?: string;
  newCompanyName?: string;
  newDomain?: string;
  newCompanyDomain?: string;
  newTitle?: string;
}

export type MatchType = "domain" | "name" | "mock";
export type PriorityLevel = "High" | "Medium" | "Monitor";

export interface ContactJobChange {
  id: string;
  lushaContactId?: string;
  personName: string;
  previousCompany: string;
  previousCompanyDomain?: string;
  previousTitle: string;
  newCompany: string;
  newCompanyDomain?: string;
  newTitle: string;
  location?: string;
  linkedinUrl?: string;
  skills?: string[];
  profileText?: string;
  signalDate: string;
  relevanceScore: number;
  priorityLevel: PriorityLevel;
  suggestedSalesAction: string;
  suggestedMessage: string;
  source: "Lusha";
  lastCheckedDate: string;
}

export const relationshipStatusOptions = [
  "Client",
  "Former Client",
  "Prospect",
  "Partner",
  "Unknown"
] as const;

export type MidasRelationshipStatus = (typeof relationshipStatusOptions)[number];
export type MidasMatchConfidence = "exact_domain" | "exact_name" | "fuzzy_name" | "none";
export type ChampionPotential = "High" | "Medium" | "Low" | "Unknown";

export const MidasAccountSchema = z.object({
  id: z.string().uuid().optional(),
  companyName: z.string().trim().min(1).max(160),
  companyDomain: z.string().trim().max(253).optional().or(z.literal("")),
  country: z.string().trim().min(1).max(120),
  relationshipStatus: z.enum(relationshipStatusOptions),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  createdBy: z.string().trim().max(120).optional().or(z.literal("")),
  updatedBy: z.string().trim().max(120).optional().or(z.literal(""))
});

export type MidasAccountInput = z.infer<typeof MidasAccountSchema>;

export interface MidasAccount {
  id: string;
  companyName: string;
  companyDomain?: string;
  country: string;
  relationshipStatus: MidasRelationshipStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface MidasAccountStats {
  total: number;
  clients: number;
  formerClients: number;
  prospects: number;
  partners: number;
  countriesCovered: number;
}

export interface MidasAccountListResponse {
  accounts: MidasAccount[];
  stats: MidasAccountStats;
  storage: {
    status: "supabase" | "memory" | "disabled" | "failed";
    message?: string;
  };
}

export interface MidasImportRow extends MidasAccountInput {
  rowNumber: number;
  duplicate?: boolean;
  duplicateOf?: string;
  error?: string;
}

export interface MidasImportPreviewResponse {
  rows: MidasImportRow[];
  validRows: number;
  duplicateRows: number;
  errorRows: number;
}

export type MidasDuplicateStrategy = "skip_duplicates" | "update_duplicates" | "insert_new_only";

export interface MidasCompanyMatch {
  matched: boolean;
  account?: MidasAccount;
  confidence: MidasMatchConfidence;
  normalizedPreviousCompany: string;
}

export interface ChampionContactJobChange extends ContactJobChange {
  previousCompanyCountryFromDatabase?: string;
  midasRelationshipStatus?: MidasRelationshipStatus;
  midasAccountMatched: boolean;
  midasMatchedCompanyName?: string;
  midasMatchConfidence: MidasMatchConfidence;
  championPotential: ChampionPotential;
  championReason: string;
  championLikelihoodScore: number;
}

export interface SearchSummary {
  totalContactsFound: number;
  jobChangesFound: number;
  highPriorityContacts: number;
  matchType: MatchType;
  movementDirection: MovementDirection;
  creditsUsed?: number;
  apiCallsUsed: number;
  signalLookupsRequested: number;
  mockMode: boolean;
  lastCheckedAt: string;
  knownMidasAccounts?: number;
  highPotentialChampions?: number;
  mediumPotentialChampions?: number;
  unknownPreviousCompanies?: number;
  midasDatabaseCompaniesCount?: number;
}

export interface SearchResponse {
  results: Array<ContactJobChange | ChampionContactJobChange>;
  summary: SearchSummary;
  warnings: string[];
  storage?: {
    status: "saved" | "disabled" | "failed" | "memory";
    id?: string;
    message?: string;
  };
}

export interface SavedSearchRun {
  id: string;
  createdAt: string;
  companyDomain?: string;
  companyName?: string;
  location?: string;
  durationDays?: number;
  discipline?: string;
  titleFilterMode?: string;
  maxSignalLookups?: number;
  boostMidasMentions?: boolean;
  mockMode: boolean;
  totalContactsFound: number;
  jobChangesFound: number;
  highPriorityContacts: number;
  creditsUsed?: number;
  apiCallsUsed: number;
  signalLookupsRequested: number;
}

export interface SavedSearchRunDetail extends SavedSearchRun {
  warnings: string[];
  request: Record<string, unknown>;
  results: Array<ContactJobChange | ChampionContactJobChange>;
}

export interface SavedSearchRunsResponse {
  runs: SavedSearchRun[];
  storage: {
    status: "supabase" | "memory" | "disabled" | "failed";
    message?: string;
  };
}

export interface SavedSearchRunDetailResponse {
  run?: SavedSearchRunDetail;
  storage: SavedSearchRunsResponse["storage"];
}

export const ProfileMidasMentionRequestSchema = z
  .object({
    companyDomain: z.string().trim().max(253).optional().or(z.literal("")),
    companyName: z.string().trim().max(120).optional().or(z.literal("")),
    location: z.string().trim().max(120).optional().or(z.literal("")),
    discipline: z.enum(profileMentionDisciplineOptions),
    customTitleKeywords: z.array(z.string().trim().min(1).max(100)).max(40).optional(),
    seniority: z.array(z.string().trim().max(80)).max(8).optional(),
    maxContactsToCheck: z.union([
      z.literal(25),
      z.literal(50),
      z.literal(100),
      z.literal(200)
    ]),
    keywordMode: z.enum(midasKeywordModeOptions),
    customMidasKeywords: z.array(z.string().trim().min(1).max(80)).max(40).optional(),
    localLushaApiKey: z.string().trim().max(300).optional().or(z.literal(""))
  })
  .refine((value) => Boolean(value.companyDomain || value.companyName), {
    message: "Enter either a target company domain or company name.",
    path: ["companyDomain"]
  });

export type ProfileMidasMentionRequest = z.infer<typeof ProfileMidasMentionRequestSchema>;
export type MidasMentionConfidence = "high" | "medium" | "low";

export interface MidasMentionDetection {
  hasMidasMention: boolean;
  matchedKeywords: string[];
  evidenceSnippets: string[];
  evidenceFields: string[];
  confidence: MidasMentionConfidence;
}

export interface ProfileMidasMentionResult extends MidasMentionDetection {
  id: string;
  lushaContactId?: string;
  personName: string;
  currentCompany: string;
  currentCompanyDomain?: string;
  currentTitle: string;
  location?: string;
  linkedinUrl?: string;
  midasMentionScore: number;
  suggestedAction: string;
  suggestedMessage: string;
  checkedAt: string;
  source: "Lusha";
}

export interface ProfileMidasMentionResponse {
  results: ProfileMidasMentionResult[];
  summary: {
    contactsChecked: number;
    mentionsFound: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
    apiCallsUsed?: number;
    creditsUsed?: number;
    mockMode: boolean;
  };
  warnings: string[];
}
