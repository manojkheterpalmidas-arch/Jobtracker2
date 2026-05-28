"use client";

import { AlertTriangle, Database, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { SearchForm } from "@/components/SearchForm";
import { ResultsTable } from "@/components/ResultsTable";
import { SavedSearches } from "@/components/SavedSearches";
import { SummaryCards } from "@/components/SummaryCards";
import { Badge } from "@/components/ui/badge";
import type { SavedSearchRunsResponse, SearchRequest, SearchResponse } from "@/lib/types";

function csvValue(value: unknown) {
  const stringValue = String(value ?? "");
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function downloadCsv(response: SearchResponse) {
  const headers = [
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

  const rows = response.results.map((record) => [
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
  ]);

  const csv = [headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `engineer-job-changes-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function TrackerDashboard() {
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [history, setHistory] = useState<SavedSearchRunsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
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

    try {
      const result = await fetch("/api/search-job-changes", {
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

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6">
        <header className="grid gap-3 border-b pb-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">
                Engineer Job Change Tracker
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                Find structural, bridge, and civil structures contacts who recently joined target companies, then prioritize timely professional follow-up.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success">Domain-first</Badge>
              <Badge variant="muted">Server-side Lusha calls</Badge>
              {response?.summary.mockMode ? <Badge variant="warning">Mock data</Badge> : null}
            </div>
          </div>
        </header>

        <div className="grid gap-6">
          <SearchForm loading={loading} onSearch={handleSearch} />
          <SavedSearches history={history} loading={historyLoading} />

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

            {!loading && response ? (
              <ResultsTable results={response.results} onExportCsv={() => downloadCsv(response)} />
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}
