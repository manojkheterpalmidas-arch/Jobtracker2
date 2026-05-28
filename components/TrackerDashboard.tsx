"use client";

import { AlertTriangle, Database, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ChampionResultsTable } from "@/components/ChampionResultsTable";
import { MidasAccountDatabase } from "@/components/MidasAccountDatabase";
import { SearchForm } from "@/components/SearchForm";
import { ResultsTable } from "@/components/ResultsTable";
import { SavedSearches } from "@/components/SavedSearches";
import { SummaryCards } from "@/components/SummaryCards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  ChampionContactJobChange,
  ContactJobChange,
  SavedSearchRunsResponse,
  SearchRequest,
  SearchResponse
} from "@/lib/types";

function csvValue(value: unknown) {
  const stringValue = String(value ?? "");
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function downloadCsv(response: SearchResponse) {
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

export function TrackerDashboard() {
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [history, setHistory] = useState<SavedSearchRunsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loadingRunId, setLoadingRunId] = useState<string | null>(null);
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null);
  const [savedPanelOpen, setSavedPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"champion" | "tracker" | "accounts">("champion");
  const [loadedRequest, setLoadedRequest] = useState<Partial<SearchRequest> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadHistory() {
    setHistoryLoading(true);

    try {
      const result = await fetch("/api/search-runs?limit=12", {
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

  async function handleSearch(payload: SearchRequest) {
    setLoading(true);
    setError(null);
    setLoadedRequest(payload);

    try {
      const result = await fetch(activeTab === "champion" ? "/api/search-champions" : "/api/search-job-changes", {
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
      const savedRequest = data.run.request as Partial<SearchRequest>;
      const savedIsChampionSearch =
        championResults.length > 0 ||
        typeof savedRequest.onlyKnownMidasAccounts === "boolean" ||
        typeof savedRequest.showUnknownPreviousCompanies === "boolean";

      setLoadedRequest(savedRequest);
      setActiveTab(savedIsChampionSearch ? "champion" : "tracker");
      setResponse({
        results: data.run.results,
        summary: {
          totalContactsFound: data.run.totalContactsFound,
          jobChangesFound: savedResults.length || data.run.jobChangesFound,
          highPriorityContacts: savedIsChampionSearch
            ? championResults.filter((record) => record.championPotential === "High").length
            : data.run.highPriorityContacts,
          matchType: "domain",
          movementDirection: "joined",
          creditsUsed: data.run.creditsUsed,
          apiCallsUsed: data.run.apiCallsUsed,
          signalLookupsRequested: data.run.signalLookupsRequested,
          mockMode: data.run.mockMode,
          lastCheckedAt: data.run.createdAt,
          knownMidasAccounts: savedIsChampionSearch
            ? championResults.filter((record) => record.midasAccountMatched).length
            : undefined,
          highPotentialChampions: savedIsChampionSearch
            ? championResults.filter((record) => record.championPotential === "High").length
            : undefined,
          mediumPotentialChampions: savedIsChampionSearch
            ? championResults.filter((record) => record.championPotential === "Medium").length
            : undefined,
          unknownPreviousCompanies: savedIsChampionSearch
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

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6">
        <header className="grid gap-3 border-b pb-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">
                MIDAS Champion Migration Finder
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                Find people who recently joined target companies from known MIDAS accounts, then prioritize likely MIDAS-aware champions for professional follow-up.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={() => setSavedPanelOpen(true)}>
                <Database className="h-4 w-4" aria-hidden="true" />
                Saved searches
                {history?.runs?.length ? (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{history.runs.length}</span>
                ) : null}
              </Button>
              <Badge variant="success">Domain-first</Badge>
              <Badge variant="muted">Server-side Lusha calls</Badge>
              {response?.summary.mockMode ? <Badge variant="warning">Mock data</Badge> : null}
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
            <aside className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto border-l bg-background p-4 shadow-2xl">
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
          <nav className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={activeTab === "champion" ? "default" : "outline"}
              onClick={() => setActiveTab("champion")}
            >
              Champion Finder
            </Button>
            <Button
              type="button"
              variant={activeTab === "tracker" ? "default" : "outline"}
              onClick={() => setActiveTab("tracker")}
            >
              Job Change Tracker
            </Button>
            <Button
              type="button"
              variant={activeTab === "accounts" ? "default" : "ghost"}
              onClick={() => setActiveTab("accounts")}
              className="ml-auto"
            >
              Admin: MIDAS Account Database
            </Button>
          </nav>

          {activeTab === "accounts" ? (
            <MidasAccountDatabase />
          ) : (
            <>
              <SearchForm
                loading={loading}
                onSearch={handleSearch}
                mode={activeTab === "champion" ? "champion" : "tracker"}
                initialRequest={loadedRequest}
              />

          <section className="grid content-start gap-4">
            <SummaryCards summary={response?.summary} />

            {loading ? (
              <div className="flex min-h-72 items-center justify-center rounded-lg border bg-card shadow-subtle">
                <div className="text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" aria-hidden="true" />
                  <p className="mt-3 text-sm font-medium">Checking contacts and companyChange signals</p>
                  <p className="mt-1 text-xs text-muted-foreground">This may use Lusha prospecting and signal credits in live mode.</p>
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
                <p>Check `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and the `search_runs` table.</p>
              </div>
            ) : null}

            {!loading && !error && !response ? (
              <div className="rounded-lg border bg-card p-10 text-center shadow-subtle">
                <Database className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
                <p className="mt-3 text-base font-semibold">Ready to search</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Start with a company domain like wsp.com, arcadis.com, mottmac.com, ramboll.com, or cowi.com.
                </p>
              </div>
            ) : null}

            {!loading && response && activeTab === "champion" ? (
              <ChampionResultsTable
                results={response.results.filter(isChampionRecord)}
                onExportCsv={() => downloadCsv(response)}
              />
            ) : null}

            {!loading && response && activeTab === "tracker" ? (
              <ResultsTable
                results={response.results.filter((record): record is ContactJobChange => !isChampionRecord(record))}
                onExportCsv={() => downloadCsv(response)}
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
