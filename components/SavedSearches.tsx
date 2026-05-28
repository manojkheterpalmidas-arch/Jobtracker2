"use client";

import { useMemo, useState } from "react";
import { Clock3, Database, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { SavedSearchRunsResponse } from "@/lib/types";

type SavedSearchesProps = {
  history?: SavedSearchRunsResponse | null;
  loading: boolean;
  loadingRunId?: string | null;
  deletingRunId?: string | null;
  onViewResults: (id: string) => void;
  onDelete: (id: string) => void;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function SavedSearches({
  history,
  loading,
  loadingRunId,
  deletingRunId,
  onViewResults,
  onDelete
}: SavedSearchesProps) {
  const [query, setQuery] = useState("");
  const runs = useMemo(() => history?.runs ?? [], [history?.runs]);
  const filteredRuns = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return runs;
    }

    return runs.filter((run) => {
      return [
        run.companyName,
        run.companyDomain,
        run.location,
        run.discipline,
        run.titleFilterMode
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [query, runs]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" aria-hidden="true" />
            <CardTitle>Saved company searches</CardTitle>
          </div>
          {history?.storage.status ? (
            <Badge variant={history.storage.status === "supabase" ? "success" : "muted"}>
              {history.storage.status === "supabase" ? "Supabase" : history.storage.status}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search saved companies"
              className="pl-9"
            />
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading saved searches...</p>
        ) : null}

        {!loading && !runs.length ? (
          <p className="text-sm text-muted-foreground">
            Saved searches will appear here after the first company search.
          </p>
        ) : null}

        {!loading && runs.length > 0 && !filteredRuns.length ? (
          <p className="text-sm text-muted-foreground">No saved searches match this filter.</p>
        ) : null}

        <div className="grid max-h-[calc(100vh-240px)] gap-3 overflow-y-auto pr-1">
          {filteredRuns.map((run) => (
            <div key={run.id} className="rounded-lg border bg-background p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{run.companyName || run.companyDomain || "Unnamed company"}</p>
                  <p className="text-xs text-muted-foreground">{run.companyDomain || "Name search"}</p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                  {formatDate(run.createdAt)}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-md bg-muted p-2">
                  <p className="text-muted-foreground">Contacts</p>
                  <p className="text-sm font-semibold">{run.totalContactsFound}</p>
                </div>
                <div className="rounded-md bg-muted p-2">
                  <p className="text-muted-foreground">Changes</p>
                  <p className="text-sm font-semibold">{run.jobChangesFound}</p>
                </div>
                <div className="rounded-md bg-muted p-2">
                  <p className="text-muted-foreground">Credits</p>
                  <p className="text-sm font-semibold">{run.creditsUsed ?? 0}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {run.location || "Any location"} - {run.durationDays ?? "-"} days - {run.signalLookupsRequested} signal checks
              </p>
              <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onViewResults(run.id)}
                  disabled={loadingRunId === run.id || deletingRunId === run.id}
                >
                  {loadingRunId === run.id ? "Loading..." : "View results"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => onDelete(run.id)}
                  disabled={deletingRunId === run.id}
                  title="Delete saved search"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {history?.storage.message ? (
          <p className="mt-3 text-xs text-muted-foreground">{history.storage.message}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
