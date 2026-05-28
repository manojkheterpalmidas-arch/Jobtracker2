"use client";

import { Clock3, Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SavedSearchRunsResponse } from "@/lib/types";

type SavedSearchesProps = {
  history?: SavedSearchRunsResponse | null;
  loading: boolean;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function SavedSearches({ history, loading }: SavedSearchesProps) {
  const runs = history?.runs ?? [];

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
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading saved searches...</p>
        ) : null}

        {!loading && !runs.length ? (
          <p className="text-sm text-muted-foreground">
            Saved searches will appear here after the first company search.
          </p>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {runs.map((run) => (
            <div key={run.id} className="rounded-lg border bg-background p-4">
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
                  <p className="text-base font-semibold">{run.totalContactsFound}</p>
                </div>
                <div className="rounded-md bg-muted p-2">
                  <p className="text-muted-foreground">Changes</p>
                  <p className="text-base font-semibold">{run.jobChangesFound}</p>
                </div>
                <div className="rounded-md bg-muted p-2">
                  <p className="text-muted-foreground">Credits</p>
                  <p className="text-base font-semibold">{run.creditsUsed ?? 0}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {run.location || "Any location"} · {run.durationDays ?? "-"} days · {run.signalLookupsRequested} signal checks
              </p>
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
