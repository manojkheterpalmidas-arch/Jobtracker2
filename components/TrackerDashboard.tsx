"use client";

import { Activity, AlertTriangle, BriefcaseBusiness, Database, History, Loader2, LockKeyhole, Server, ShieldCheck, Sparkles, Target, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ChampionResultsTable } from "@/components/ChampionResultsTable";
import { MidasAccountDatabase } from "@/components/MidasAccountDatabase";
import { ProfileMidasMentionsPage } from "@/components/ProfileMidasMentionsPage";
import { SearchForm } from "@/components/SearchForm";
import { SavedSearches } from "@/components/SavedSearches";
import { SummaryCards } from "@/components/SummaryCards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { disciplineLabels } from "@/lib/types";
import type {
  ChampionContactJobChange,
  Discipline,
  ProfileMidasMentionResponse,
  ProfileMidasMentionRequest,
  ProfileMidasMentionResult,
  RevealedContactDetails,
  SavedSearchRunsResponse,
  SearchRequest,
  SearchResponse
} from "@/lib/types";

type SharedSearchDraft = Omit<Partial<SearchRequest>, "discipline"> &
  Omit<Partial<ProfileMidasMentionRequest>, "discipline"> & {
    discipline?: string;
  };

function csvValue(value: unknown) {
  const stringValue = String(value ?? "");
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function revealedCsvFields(record: SearchResponse["results"][number], revealedContactDetails: Record<string, RevealedContactDetails>) {
  const details = record.lushaContactId ? revealedContactDetails[record.lushaContactId] : undefined;

  return [
    details?.emails.join("; ") ?? "",
    details?.phones.join("; ") ?? ""
  ];
}

function downloadCsv(response: SearchResponse, revealedContactDetails: Record<string, RevealedContactDetails>) {
  const championMode = response.results.some((record) => "championLikelihoodScore" in record);
  const headers = championMode ? [
    "Person name",
    "New company",
    "New title",
    "Previous company",
    "Previous domain",
    "MIDAS matched company",
    "MIDAS relationship status",
    "Match confidence",
    "Champion potential",
    "Champion score",
    "Champion reason",
    "Suggested action",
    "Suggested message",
    "LinkedIn URL",
    "Revealed emails",
    "Revealed phones",
    "Signal date"
  ] : [
    "Person name",
    "Previous company",
    "Previous company domain",
    "Previous title",
    "New company",
    "New company domain",
    "New title",
    "Location",
    "LinkedIn URL",
    "Revealed emails",
    "Revealed phones",
    "Signal date",
    "Relevance score",
    "Priority level",
    "Suggested sales action",
    "Suggested message",
    "Source",
    "Last checked date"
  ];

  const rows = response.results.map((record) => {
    if ("championLikelihoodScore" in record) {
      return [
        record.personName,
        record.newCompany,
        record.newTitle,
        record.previousCompany,
        record.previousCompanyDomain,
        record.midasMatchedCompanyName,
        record.midasRelationshipStatus,
        record.midasMatchConfidence,
        record.championPotential,
        record.championLikelihoodScore,
        record.championReason,
        record.suggestedSalesAction,
        record.suggestedMessage,
        record.linkedinUrl,
        ...revealedCsvFields(record, revealedContactDetails),
        record.signalDate
      ];
    }

    return [
      record.personName,
      record.previousCompany,
      record.previousCompanyDomain,
      record.previousTitle,
      record.newCompany,
      record.newCompanyDomain,
      record.newTitle,
      record.location,
      record.linkedinUrl,
      ...revealedCsvFields(record, revealedContactDetails),
      record.signalDate,
      record.relevanceScore,
      record.priorityLevel,
      record.suggestedSalesAction,
      record.suggestedMessage,
      record.source,
      record.lastCheckedDate
    ];
  });

  const csv = [headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `engineer-job-changes-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function isChampionRecord(record: SearchResponse["results"][number]): record is ChampionContactJobChange {
  return "championLikelihoodScore" in record;
}

function isProfileMentionRecord(record: unknown): record is ProfileMidasMentionResult {
  return Boolean(record && typeof record === "object" && ("decisionMakerScore" in record || "midasMentionScore" in record));
}

export function TrackerDashboard() {
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [history, setHistory] = useState<SavedSearchRunsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loadingRunId, setLoadingRunId] = useState<string | null>(null);
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null);
  const [savedPanelOpen, setSavedPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"jobChanges" | "profile" | "accounts">("jobChanges");
  const [loadedRequest, setLoadedRequest] = useState<SharedSearchDraft | null>(null);
  const [profileMentionResponse, setProfileMentionResponse] = useState<ProfileMidasMentionResponse | null>(null);
  const [revealedContactDetails, setRevealedContactDetails] = useState<Record<string, RevealedContactDetails>>({});
  const [error, setError] = useState<string | null>(null);

  async function loadHistory() {
    setHistoryLoading(true);

    try {
      const result = await fetch("/api/search-runs", {
        method: "GET",
        cache: "no-store"
      });
      const data = await result.json();

      if (result.ok) {
        setHistory(data);
      }
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    void loadHistory();
  }, []);

  function updateSharedDraft(patch: SharedSearchDraft) {
    setLoadedRequest((current) => ({
      ...(current ?? {}),
      ...patch
    }));
  }

  async function handleSearch(payload: SearchRequest) {
    setLoading(true);
    setError(null);
    setLoadedRequest(payload);
    setProfileMentionResponse(null);
    setRevealedContactDetails({});

    try {
      const result = await fetch("/api/search-champions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await result.json();

      if (!result.ok) {
        throw new Error(data.error || "Search failed.");
      }

      setResponse(data);
      void loadHistory();
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Search failed.");
      setResponse(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleViewSavedResults(id: string) {
    setLoadingRunId(id);
    setError(null);
    setRevealedContactDetails({});

    try {
      const result = await fetch(`/api/search-runs?id=${encodeURIComponent(id)}`, {
        method: "GET",
        cache: "no-store"
      });
      const data = await result.json();

      if (!result.ok || !data.run) {
        throw new Error(data.storage?.message || "Saved search results could not be loaded.");
      }

      const savedResults = (data.run.results ?? []) as SearchResponse["results"];
      const championResults = savedResults.filter(isChampionRecord);
      const profileResults = ((data.run.results ?? []) as unknown[]).filter(isProfileMentionRecord);
      const savedRequest = data.run.request as SharedSearchDraft;
      const savedSearchType = data.run.searchType || (data.run.request as Record<string, unknown>).searchType;
      const savedIsProfileMentionSearch = savedSearchType === "profile_midas_mentions" || profileResults.length > 0;
      const savedIsJobChangeSearch =
        !savedIsProfileMentionSearch &&
        (championResults.length > 0 ||
          typeof savedRequest.onlyKnownMidasAccounts === "boolean" ||
          typeof savedRequest.showUnknownPreviousCompanies === "boolean");

      setLoadedRequest(savedRequest);
      setActiveTab(savedIsProfileMentionSearch ? "profile" : "jobChanges");
      if (savedIsProfileMentionSearch) {
        setProfileMentionResponse({
          results: profileResults,
          summary: {
            contactsChecked: data.run.totalContactsFound,
            decisionMakersFound: data.run.jobChangesFound,
            highConfidence: data.run.highPriorityContacts,
            mediumConfidence: profileResults.filter((record) => record.championFit === "medium").length,
            lowConfidence: profileResults.filter((record) => record.championFit === "low").length,
            apiCallsUsed: data.run.apiCallsUsed,
            creditsUsed: data.run.creditsUsed,
            mockMode: data.run.mockMode
          },
          warnings: data.run.warnings ?? [],
          storage: {
            status: data.storage?.status === "supabase" ? "saved" : data.storage?.status,
            id: data.run.id,
            message: "Loaded from saved search history."
          }
        });
        setResponse(null);
        setSavedPanelOpen(false);
        return;
      }
      setProfileMentionResponse(null);
      setResponse({
        results: data.run.results,
        summary: {
          totalContactsFound: data.run.totalContactsFound,
          jobChangesFound: savedResults.length || data.run.jobChangesFound,
          highPriorityContacts: savedIsJobChangeSearch
            ? championResults.filter((record) => record.championPotential === "High").length
            : data.run.highPriorityContacts,
          matchType: "domain",
          movementDirection: "joined",
          creditsUsed: data.run.creditsUsed,
          apiCallsUsed: data.run.apiCallsUsed,
          signalLookupsRequested: data.run.signalLookupsRequested,
          mockMode: data.run.mockMode,
          lastCheckedAt: data.run.createdAt,
          knownMidasAccounts: savedIsJobChangeSearch
            ? championResults.filter((record) => record.midasAccountMatched).length
            : undefined,
          highPotentialChampions: savedIsJobChangeSearch
            ? championResults.filter((record) => record.championPotential === "High").length
            : undefined,
          mediumPotentialChampions: savedIsJobChangeSearch
            ? championResults.filter((record) => record.championPotential === "Medium").length
            : undefined,
          unknownPreviousCompanies: savedIsJobChangeSearch
            ? championResults.filter((record) => !record.midasAccountMatched).length
            : undefined,
          midasDatabaseCompaniesCount: undefined
        },
        warnings: data.run.warnings ?? [],
        storage: {
          status: data.storage?.status === "supabase" ? "saved" : data.storage?.status,
          id: data.run.id,
          message: "Loaded from saved search history."
        }
      });
      setSavedPanelOpen(false);
    } catch (savedError) {
      setError(savedError instanceof Error ? savedError.message : "Saved search results could not be loaded.");
    } finally {
      setLoadingRunId(null);
    }
  }

  async function handleDeleteSavedSearch(id: string) {
    setDeletingRunId(id);
    setError(null);

    try {
      const result = await fetch(`/api/search-runs?id=${encodeURIComponent(id)}`, {
        method: "DELETE"
      });
      const data = await result.json();

      if (!result.ok) {
        throw new Error(data.storage?.message || "Saved search could not be deleted.");
      }

      void loadHistory();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Saved search could not be deleted.");
    } finally {
      setDeletingRunId(null);
    }
  }

  const handleRevealedContactDetailsChange = useCallback((details: RevealedContactDetails) => {
    setRevealedContactDetails((current) => ({
      ...current,
      [details.contactId]: details
    }));
  }, []);

  const savedSearchCount = history?.runs?.length ?? 0;
  const jobChangeDisciplineLabel =
    loadedRequest?.discipline && loadedRequest.discipline in disciplineLabels
      ? disciplineLabels[loadedRequest.discipline as Discipline]
      : undefined;

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-w-0 max-w-[1480px] gap-5">
        <header className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-panel">
          <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,440px)] lg:p-7">
            <div className="min-w-0 max-w-4xl">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-primary">
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </span>
                <Badge variant="success">Internal sales intelligence</Badge>
                {response?.summary.mockMode ? <Badge variant="warning">Mock data</Badge> : null}
              </div>
              <h1 className="max-w-full break-words text-2xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-4xl">
                MIDAS Champion Migration Finder
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
                Identify engineers who recently joined target accounts and prioritize likely MIDAS-aware champions.
              </p>
            </div>

            <div className="grid min-w-0 content-start gap-3">
              <Button type="button" variant="outline" onClick={() => setSavedPanelOpen(true)} className="h-12 w-full min-w-0 justify-between px-4">
                <span className="inline-flex items-center gap-2">
                  <History className="h-4 w-4" aria-hidden="true" />
                  Saved searches
                </span>
                <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-white">{savedSearchCount}</span>
              </Button>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mode</p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">Domain-first</p>
                </div>
                <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Source</p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">Server-side Lusha</p>
                </div>
                <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Matching</p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">MIDAS database</p>
                </div>
                <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Admin</p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">Controlled</p>
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-3 border-t border-slate-200/80 bg-slate-50/90 px-6 py-3 text-xs font-medium text-slate-600 sm:grid-cols-3 lg:px-7">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
              Search mode: Domain-first
            </div>
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-primary" aria-hidden="true" />
              Source: Lusha via server routes
            </div>
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" aria-hidden="true" />
              Matching: MIDAS account database
            </div>
          </div>
        </header>

        {savedPanelOpen ? (
          <div className="fixed inset-0 z-50">
            <button
              type="button"
              className="absolute inset-0 bg-slate-950/25"
              aria-label="Dismiss saved searches overlay"
              onClick={() => setSavedPanelOpen(false)}
            />
            <aside className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto border-l bg-background p-5 shadow-2xl">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-muted-foreground">Saved search history</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setSavedPanelOpen(false)}
                  title="Close saved searches"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
              <SavedSearches
                history={history}
                loading={historyLoading}
                loadingRunId={loadingRunId}
                deletingRunId={deletingRunId}
                onViewResults={handleViewSavedResults}
                onDelete={handleDeleteSavedSearch}
              />
            </aside>
          </div>
        ) : null}

        <div className="grid content-start gap-6">
          <nav className="grid gap-3 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-subtle lg:grid-cols-[1fr_auto]">
            <div className="grid gap-1 rounded-xl bg-slate-100 p-1 sm:inline-grid sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setActiveTab("jobChanges")}
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${
                  activeTab === "jobChanges"
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-600 hover:bg-white/70 hover:text-slate-950"
                }`}
              >
                <BriefcaseBusiness className="h-4 w-4" aria-hidden="true" />
                Job Changes
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("profile")}
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${
                  activeTab === "profile"
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-600 hover:bg-white/70 hover:text-slate-950"
                }`}
              >
                <Target className="h-4 w-4" aria-hidden="true" />
                Decision Makers
              </button>
            </div>
            <Button
              type="button"
              variant={activeTab === "accounts" ? "default" : "outline"}
              onClick={() => setActiveTab("accounts")}
              className="h-11 justify-center lg:justify-start"
            >
              <LockKeyhole className="h-4 w-4" aria-hidden="true" />
              Admin: MIDAS Account Database
            </Button>
          </nav>

          {activeTab === "accounts" ? (
            <MidasAccountDatabase />
          ) : activeTab === "profile" ? (
            <ProfileMidasMentionsPage
              initialResponse={profileMentionResponse}
              initialRequest={loadedRequest}
              onDraftChange={updateSharedDraft}
            />
          ) : (
            <>
              <SearchForm
                loading={loading}
                onSearch={handleSearch}
                initialRequest={loadedRequest}
                onDraftChange={updateSharedDraft}
              />

          <section className="grid content-start gap-4">
            <SummaryCards summary={response?.summary} />

            {loading ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-subtle">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-primary">
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-950">Searching job changes and matching against MIDAS accounts...</p>
                      <p className="mt-1 text-xs text-muted-foreground">This may use Lusha prospecting and signal credits in live mode.</p>
                    </div>
                  </div>
                  <Badge variant="success">
                    <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                    Live matching
                  </Badge>
                </div>
                <div className="mt-5 grid gap-3">
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-[1.2fr_1fr_0.8fr]">
                      <div className="h-4 animate-pulse rounded-full bg-slate-200" />
                      <div className="h-4 animate-pulse rounded-full bg-slate-200" />
                      <div className="h-4 animate-pulse rounded-full bg-slate-200" />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4" aria-hidden="true" />
                  <div>
                    <p className="font-semibold">Search error</p>
                    <p>{error}</p>
                  </div>
                </div>
              </div>
            ) : null}

            {response?.warnings.length ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4" aria-hidden="true" />
                  <div>
                    <p className="font-semibold">Search notes</p>
                    <ul className="mt-1 list-inside list-disc space-y-1">
                      {response.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : null}

            {response?.storage?.status === "saved" ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                <p className="font-semibold">Saved to Supabase</p>
                <p>{response.storage.id ? `Search run ID: ${response.storage.id}` : "Search run saved."}</p>
              </div>
            ) : null}

            {response?.storage?.status === "failed" ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-semibold">Search completed, but was not saved</p>
                <p>{response.storage.message || "Check Supabase environment variables and the search_runs table."}</p>
              </div>
            ) : null}

            {!loading && !error && !response ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-subtle">
                <Database className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
                <p className="mt-3 text-base font-semibold">Ready to search</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Start with a company domain like wsp.com, arcadis.com, mottmac.com, ramboll.com, or cowi.com.
                </p>
              </div>
            ) : null}

            {!loading && response && activeTab === "jobChanges" ? (
              <ChampionResultsTable
                results={response.results.filter(isChampionRecord)}
                disciplineLabel={jobChangeDisciplineLabel}
                revealedContactDetails={revealedContactDetails}
                onRevealedContactDetailsChange={handleRevealedContactDetailsChange}
                onExportCsv={() => downloadCsv(response, revealedContactDetails)}
              />
            ) : null}
          </section>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
