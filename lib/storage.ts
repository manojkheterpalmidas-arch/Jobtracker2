import type {
  SavedSearchRun,
  SavedSearchRunDetail,
  SavedSearchRunDetailResponse,
  SavedSearchRunsResponse,
  SearchRequest,
  SearchResponse
} from "@/lib/types";
import { getServerSupabaseConfig } from "@/lib/supabaseClient";

type StoredWebhookEvent = {
  id: string;
  receivedAt: string;
  eventType?: string;
  entityType?: string;
  payload: unknown;
};

type StoredSearchRun = {
  id: string;
  createdAt: string;
  request: Omit<SearchRequest, "localLushaApiKey">;
  summary: SearchResponse["summary"];
  warnings: string[];
  results: SearchResponse["results"];
  searchType?: string;
};

declare global {
  var lushaWebhookEvents: StoredWebhookEvent[] | undefined;
  var searchRuns: StoredSearchRun[] | undefined;
}

function getWebhookStore() {
  if (!globalThis.lushaWebhookEvents) {
    globalThis.lushaWebhookEvents = [];
  }

  return globalThis.lushaWebhookEvents;
}

function getSearchRunStore() {
  if (!globalThis.searchRuns) {
    globalThis.searchRuns = [];
  }

  return globalThis.searchRuns;
}

function supabaseConfig() {
  const config = getServerSupabaseConfig();

  if (!config) {
    return undefined;
  }

  return {
    url: config.url,
    serviceRoleKey: config.key
  };
}

function omitApiKey(request: SearchRequest): Omit<SearchRequest, "localLushaApiKey"> {
  const safeRequest = { ...request };
  delete safeRequest.localLushaApiKey;
  return safeRequest;
}

async function insertSearchRun(
  config: { url: string; serviceRoleKey: string },
  payload: Record<string, unknown>
) {
  return fetch(`${config.url}/rest/v1/search_runs`, {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(payload),
    cache: "no-store"
  });
}

async function supabaseErrorText(response: Response) {
  const text = await response.text();

  if (!text) {
    return response.statusText || `HTTP ${response.status}`;
  }

  try {
    const data = JSON.parse(text) as { message?: string; details?: string; hint?: string; code?: string };
    return [data.message, data.details, data.hint, data.code ? `Code: ${data.code}` : ""]
      .filter(Boolean)
      .join(" ");
  } catch {
    return text;
  }
}

export async function storeWebhookEvent(event: StoredWebhookEvent) {
  // Vercel serverless memory is ephemeral. For production persistence, replace this
  // with Supabase/PostgreSQL using DATABASE_URL and store only the minimum B2B
  // professional signal fields required for audit, deletion, and export workflows.
  getWebhookStore().unshift(event);
}

export async function listWebhookEvents() {
  return getWebhookStore();
}

export async function storeSearchRun(
  request: SearchRequest,
  response: Pick<SearchResponse, "summary" | "warnings" | "results">
): Promise<SearchResponse["storage"]> {
  const safeRequest = omitApiKey(request);
  const config = supabaseConfig();

  if (!config) {
    const run: StoredSearchRun = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      request: safeRequest,
      summary: response.summary,
      warnings: response.warnings,
      results: response.results
    };

    getSearchRunStore().unshift(run);

    return {
      status: "memory",
      id: run.id,
      message: "Search run stored in memory because Supabase is not configured."
    };
  }

  const payload = {
    company_domain: safeRequest.companyDomain || null,
    company_name: safeRequest.companyName || null,
    location: safeRequest.location || null,
    duration_days: safeRequest.durationDays,
    discipline: safeRequest.discipline,
    title_filter_mode: safeRequest.titleFilterMode,
    max_signal_lookups: safeRequest.maxSignalLookups,
    boost_midas_mentions: safeRequest.boostMidasMentions,
    match_type: response.summary.matchType,
    mock_mode: response.summary.mockMode,
    total_contacts_found: response.summary.totalContactsFound,
    job_changes_found: response.summary.jobChangesFound,
    high_priority_contacts: response.summary.highPriorityContacts,
    credits_used: response.summary.creditsUsed ?? null,
    api_calls_used: response.summary.apiCallsUsed,
    signal_lookups_requested: response.summary.signalLookupsRequested,
    warnings: response.warnings,
    request: safeRequest,
    results: response.results
  };
  const legacyPayload = {
    company_domain: safeRequest.companyDomain || null,
    company_name: safeRequest.companyName || null,
    location: safeRequest.location || null,
    duration_days: safeRequest.durationDays,
    discipline: safeRequest.discipline,
    match_type: response.summary.matchType,
    mock_mode: response.summary.mockMode,
    total_contacts_found: response.summary.totalContactsFound,
    job_changes_found: response.summary.jobChangesFound,
    high_priority_contacts: response.summary.highPriorityContacts,
    credits_used: response.summary.creditsUsed ?? null,
    api_calls_used: response.summary.apiCallsUsed,
    signal_lookups_requested: response.summary.signalLookupsRequested,
    warnings: response.warnings,
    request: safeRequest,
    results: response.results
  };

  try {
    let saveResponse = await insertSearchRun(config, payload);
    let saveError = "";

    if (!saveResponse.ok) {
      saveError = await supabaseErrorText(saveResponse);
      // Some existing deployments have an older search_runs table without newer
      // optional columns. Retry with the original core schema so Champion Finder
      // results still persist in request/results JSON.
      saveResponse = await insertSearchRun(config, legacyPayload);

      if (!saveResponse.ok) {
        const legacyError = await supabaseErrorText(saveResponse);
        return {
          status: "failed",
          message: `Supabase search-run save failed. Full payload error: ${saveError}. Legacy payload error: ${legacyError}.`
        };
      }
    }

    const rows = (await saveResponse.json()) as Array<{ id?: string }>;

    return {
      status: "saved",
      id: rows[0]?.id,
      message: "Search run saved to Supabase."
    };
  } catch {
    return {
      status: "failed",
      message: "Supabase search-run save failed."
    };
  }
}

export async function storeGenericSearchRun(params: {
  searchType: "job_change_tracker" | "champion_finder" | "profile_midas_mentions";
  request: Record<string, unknown>;
  summary: Record<string, unknown>;
  warnings: string[];
  results: unknown[];
  companyDomain?: string;
  companyName?: string;
  location?: string;
  durationDays?: number;
  discipline?: string;
  titleFilterMode?: string;
  maxSignalLookups?: number;
  boostMidasMentions?: boolean;
  mockMode?: boolean;
  totalContactsFound?: number;
  jobChangesFound?: number;
  highPriorityContacts?: number;
  creditsUsed?: number;
  apiCallsUsed?: number;
  signalLookupsRequested?: number;
}): Promise<SearchResponse["storage"]> {
  const config = supabaseConfig();
  const safeRequest = { ...params.request };
  delete safeRequest.localLushaApiKey;

  if (!config) {
    return {
      status: "memory",
      id: crypto.randomUUID(),
      message: "Search run stored in memory because Supabase is not configured."
    };
  }

  const payload = {
    search_type: params.searchType,
    company_domain: params.companyDomain || null,
    company_name: params.companyName || null,
    location: params.location || null,
    duration_days: params.durationDays ?? null,
    discipline: params.discipline || null,
    title_filter_mode: params.titleFilterMode || null,
    max_signal_lookups: params.maxSignalLookups ?? null,
    boost_midas_mentions: params.boostMidasMentions ?? true,
    match_type: params.companyDomain ? "domain" : params.companyName ? "name" : null,
    mock_mode: Boolean(params.mockMode),
    total_contacts_found: params.totalContactsFound ?? 0,
    job_changes_found: params.jobChangesFound ?? 0,
    high_priority_contacts: params.highPriorityContacts ?? 0,
    credits_used: params.creditsUsed ?? null,
    api_calls_used: params.apiCallsUsed ?? 0,
    signal_lookups_requested: params.signalLookupsRequested ?? 0,
    warnings: params.warnings,
    request: safeRequest,
    results: params.results
  };
  const legacyPayload = {
    company_domain: params.companyDomain || null,
    company_name: params.companyName || null,
    location: params.location || null,
    duration_days: params.durationDays ?? null,
    discipline: params.discipline || null,
    match_type: params.companyDomain ? "domain" : params.companyName ? "name" : null,
    mock_mode: Boolean(params.mockMode),
    total_contacts_found: params.totalContactsFound ?? 0,
    job_changes_found: params.jobChangesFound ?? 0,
    high_priority_contacts: params.highPriorityContacts ?? 0,
    credits_used: params.creditsUsed ?? null,
    api_calls_used: params.apiCallsUsed ?? 0,
    signal_lookups_requested: params.signalLookupsRequested ?? 0,
    warnings: params.warnings,
    request: { ...safeRequest, searchType: params.searchType },
    results: params.results
  };

  try {
    let response = await insertSearchRun(config, payload);
    let error = "";

    if (!response.ok) {
      error = await supabaseErrorText(response);
      response = await insertSearchRun(config, legacyPayload);

      if (!response.ok) {
        return {
          status: "failed",
          message: `Supabase search-run save failed. Full payload error: ${error}. Legacy payload error: ${await supabaseErrorText(response)}.`
        };
      }
    }

    const rows = (await response.json()) as Array<{ id?: string }>;

    return {
      status: "saved",
      id: rows[0]?.id,
      message: "Search run saved to Supabase."
    };
  } catch {
    return {
      status: "failed",
      message: "Supabase search-run save failed."
    };
  }
}

function mapStoredSearchRun(run: StoredSearchRun): SavedSearchRun {
  return {
    id: run.id,
    createdAt: run.createdAt,
    searchType: run.searchType,
    companyDomain: run.request.companyDomain || undefined,
    companyName: run.request.companyName || undefined,
    location: run.request.location || undefined,
    durationDays: run.request.durationDays,
    discipline: run.request.discipline,
    titleFilterMode: run.request.titleFilterMode,
    maxSignalLookups: run.request.maxSignalLookups,
    boostMidasMentions: run.request.boostMidasMentions,
    mockMode: run.summary.mockMode,
    totalContactsFound: run.summary.totalContactsFound,
    jobChangesFound: run.summary.jobChangesFound,
    highPriorityContacts: run.summary.highPriorityContacts,
    creditsUsed: run.summary.creditsUsed,
    apiCallsUsed: run.summary.apiCallsUsed,
    signalLookupsRequested: run.summary.signalLookupsRequested
  };
}

function mapStoredSearchRunDetail(run: StoredSearchRun): SavedSearchRunDetail {
  return {
    ...mapStoredSearchRun(run),
    warnings: run.warnings,
    request: run.request,
    results: run.results
  };
}

function mapSupabaseSearchRun(row: Record<string, unknown>): SavedSearchRun {
  return {
    id: String(row.id),
    createdAt: String(row.created_at),
    searchType: typeof row.search_type === "string" ? row.search_type : asRecord(row.request).searchType as string | undefined,
    companyDomain: typeof row.company_domain === "string" ? row.company_domain : undefined,
    companyName: typeof row.company_name === "string" ? row.company_name : undefined,
    location: typeof row.location === "string" ? row.location : undefined,
    durationDays: typeof row.duration_days === "number" ? row.duration_days : undefined,
    discipline: typeof row.discipline === "string" ? row.discipline : undefined,
    titleFilterMode: typeof row.title_filter_mode === "string" ? row.title_filter_mode : undefined,
    maxSignalLookups: typeof row.max_signal_lookups === "number" ? row.max_signal_lookups : undefined,
    boostMidasMentions: typeof row.boost_midas_mentions === "boolean" ? row.boost_midas_mentions : undefined,
    mockMode: Boolean(row.mock_mode),
    totalContactsFound: Number(row.total_contacts_found ?? 0),
    jobChangesFound: Number(row.job_changes_found ?? 0),
    highPriorityContacts: Number(row.high_priority_contacts ?? 0),
    creditsUsed: typeof row.credits_used === "number" ? row.credits_used : undefined,
    apiCallsUsed: Number(row.api_calls_used ?? 0),
    signalLookupsRequested: Number(row.signal_lookups_requested ?? 0)
  };
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asResults(value: unknown) {
  return Array.isArray(value) ? (value as SearchResponse["results"]) : [];
}

function mapSupabaseSearchRunDetail(row: Record<string, unknown>): SavedSearchRunDetail {
  return {
    ...mapSupabaseSearchRun(row),
    warnings: asStringArray(row.warnings),
    request: asRecord(row.request),
    results: asResults(row.results)
  };
}

export async function listSearchRuns(limit = 20): Promise<SavedSearchRunsResponse> {
  const config = supabaseConfig();

  if (!config) {
    return {
      runs: getSearchRunStore().slice(0, limit).map(mapStoredSearchRun),
      storage: {
        status: "memory",
        message: "Supabase is not configured; showing only searches saved in this server session."
      }
    };
  }

  const params = new URLSearchParams({
    // Select all columns so older search_runs tables keep working if they do
    // not yet have newer optional fields such as boost_midas_mentions.
    select: "*",
    order: "created_at.desc",
    limit: String(limit)
  });

  try {
    const response = await fetch(`${config.url}/rest/v1/search_runs?${params.toString()}`, {
      method: "GET",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return {
        runs: [],
        storage: {
          status: "failed",
          message: "Could not load saved searches from Supabase."
        }
      };
    }

    const rows = (await response.json()) as Array<Record<string, unknown>>;

    return {
      runs: rows.map(mapSupabaseSearchRun),
      storage: {
        status: "supabase"
      }
    };
  } catch {
    return {
      runs: [],
      storage: {
        status: "failed",
        message: "Could not load saved searches from Supabase."
      }
    };
  }
}

export async function getSearchRun(id: string): Promise<SavedSearchRunDetailResponse> {
  const config = supabaseConfig();

  if (!config) {
    const run = getSearchRunStore().find((item) => item.id === id);

    return {
      run: run ? mapStoredSearchRunDetail(run) : undefined,
      storage: {
        status: "memory",
        message: "Supabase is not configured; showing only searches saved in this server session."
      }
    };
  }

  const params = new URLSearchParams({
    select: "*",
    id: `eq.${id}`,
    limit: "1"
  });

  try {
    const response = await fetch(`${config.url}/rest/v1/search_runs?${params.toString()}`, {
      method: "GET",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return {
        storage: {
          status: "failed",
          message: "Could not load saved search results from Supabase."
        }
      };
    }

    const rows = (await response.json()) as Array<Record<string, unknown>>;

    return {
      run: rows[0] ? mapSupabaseSearchRunDetail(rows[0]) : undefined,
      storage: {
        status: "supabase"
      }
    };
  } catch {
    return {
      storage: {
        status: "failed",
        message: "Could not load saved search results from Supabase."
      }
    };
  }
}

export async function deleteSearchRun(id: string): Promise<SavedSearchRunsResponse["storage"]> {
  const config = supabaseConfig();

  if (!config) {
    const store = getSearchRunStore();
    const index = store.findIndex((item) => item.id === id);

    if (index >= 0) {
      store.splice(index, 1);
    }

    return {
      status: "memory",
      message: "Deleted from in-memory search history."
    };
  }

  const params = new URLSearchParams({
    id: `eq.${id}`
  });

  try {
    const response = await fetch(`${config.url}/rest/v1/search_runs?${params.toString()}`, {
      method: "DELETE",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return {
        status: "failed",
        message: "Could not delete saved search from Supabase."
      };
    }

    return {
      status: "supabase",
      message: "Saved search deleted."
    };
  } catch {
    return {
      status: "failed",
      message: "Could not delete saved search from Supabase."
    };
  }
}
