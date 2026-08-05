"use client";

import {
  AlertTriangle,
  Check,
  ClipboardCopy,
  Download,
  ExternalLink,
  History,
  Loader2,
  Mail,
  Phone,
  Users
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toBulkCandidates } from "@/lib/bulkContacts";
import { maxBulkRevealContacts } from "@/lib/types";
import type {
  BulkContactCandidate,
  BulkRevealResponse,
  ContactRevealField,
  ProfileMidasMentionResult,
  RevealedContactDetails,
  SavedSearchRun,
  SearchResponse
} from "@/lib/types";

type ContactSource = "decisionMakers" | "jobChanges" | "saved";
type ContactFilter = "all" | "missing" | "withEmail" | "withPhone" | "revealed";

type BulkContactsPageProps = {
  decisionMakerResults: ProfileMidasMentionResult[];
  jobChangeResults: SearchResponse["results"];
  revealedContactDetails: Record<string, RevealedContactDetails>;
  onRevealedContactDetailsChange: (details: RevealedContactDetails) => void;
};

type RunSummary = {
  requested: number;
  revealed: number;
  cached: number;
  empty: number;
  failed: number;
  creditsUsed: number;
  apiCallsUsed: number;
};

const emptyRunSummary: RunSummary = {
  requested: 0,
  revealed: 0,
  cached: 0,
  empty: 0,
  failed: 0,
  creditsUsed: 0,
  apiCallsUsed: 0
};

function csvValue(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function runLabel(run: SavedSearchRun) {
  const company = run.companyDomains?.length
    ? run.companyDomains.join(", ")
    : run.companyDomain || run.companyName || "Saved search";
  const when = new Date(run.createdAt).toLocaleString();
  return `${company} - ${run.jobChangesFound} results - ${when}`;
}

export function BulkContactsPage({
  decisionMakerResults,
  jobChangeResults,
  revealedContactDetails,
  onRevealedContactDetailsChange
}: BulkContactsPageProps) {
  const [source, setSource] = useState<ContactSource>("decisionMakers");
  const [history, setHistory] = useState<SavedSearchRun[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [savedRunId, setSavedRunId] = useState("");
  const [savedCandidates, setSavedCandidates] = useState<BulkContactCandidate[]>([]);
  const [savedRunLoading, setSavedRunLoading] = useState(false);
  const [savedRunError, setSavedRunError] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ContactFilter>("all");
  const [wantEmails, setWantEmails] = useState(true);
  const [wantPhones, setWantPhones] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const selectAllRef = useRef<HTMLInputElement>(null);

  const decisionMakerCandidates = useMemo(
    () => toBulkCandidates(decisionMakerResults, "Decision makers"),
    [decisionMakerResults]
  );
  const jobChangeCandidates = useMemo(
    () => toBulkCandidates(jobChangeResults, "Job changes"),
    [jobChangeResults]
  );

  const candidates = useMemo(() => {
    if (source === "jobChanges") return jobChangeCandidates;
    if (source === "saved") return savedCandidates;
    return decisionMakerCandidates;
  }, [decisionMakerCandidates, jobChangeCandidates, savedCandidates, source]);

  const filteredCandidates = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return candidates.filter((candidate) => {
      const details = candidate.lushaContactId ? revealedContactDetails[candidate.lushaContactId] : undefined;
      const hasEmail = Boolean(details?.emails.length);
      const hasPhone = Boolean(details?.phones.length);

      if (filter === "missing" && (hasEmail || hasPhone)) return false;
      if (filter === "withEmail" && !hasEmail) return false;
      if (filter === "withPhone" && !hasPhone) return false;
      if (filter === "revealed" && !hasEmail && !hasPhone) return false;

      if (!needle) return true;

      return [candidate.personName, candidate.company, candidate.title, candidate.location]
        .filter(Boolean)
        .some((field) => (field as string).toLowerCase().includes(needle));
    });
  }, [candidates, filter, query, revealedContactDetails]);

  const selectableIds = useMemo(
    () => Array.from(new Set(filteredCandidates.map((candidate) => candidate.lushaContactId).filter(Boolean) as string[])),
    [filteredCandidates]
  );
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedContactIds.has(id));
  const someSelected = !allSelected && selectableIds.some((id) => selectedContactIds.has(id));
  const withoutContactId = candidates.filter((candidate) => !candidate.lushaContactId).length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);

    async function loadHistory() {
      try {
        const result = await fetch("/api/search-runs", { method: "GET", cache: "no-store" });
        const data = await result.json();

        if (!cancelled && result.ok) {
          setHistory((data.runs ?? []) as SavedSearchRun[]);
        }
      } catch {
        // The saved-search source is optional; the session sources still work.
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    }

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, []);

  // Selections are keyed by Lusha contact ID, so drop any that the current
  // source no longer contains rather than billing a reveal for a stale row.
  useEffect(() => {
    const availableIds = new Set(candidates.map((candidate) => candidate.lushaContactId).filter(Boolean) as string[]);

    setSelectedContactIds((current) => {
      const next = new Set(Array.from(current).filter((id) => availableIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [candidates]);

  async function loadSavedRun(id: string) {
    setSavedRunId(id);
    setSavedRunError("");

    if (!id) {
      setSavedCandidates([]);
      return;
    }

    setSavedRunLoading(true);

    try {
      const result = await fetch(`/api/search-runs?id=${encodeURIComponent(id)}`, {
        method: "GET",
        cache: "no-store"
      });
      const data = await result.json();

      if (!result.ok || !data.run) {
        throw new Error(data.storage?.message || "Saved search could not be loaded.");
      }

      setSavedCandidates(toBulkCandidates((data.run.results ?? []) as unknown[], "Saved search"));
    } catch (loadError) {
      setSavedCandidates([]);
      setSavedRunError(loadError instanceof Error ? loadError.message : "Saved search could not be loaded.");
    } finally {
      setSavedRunLoading(false);
    }
  }

  function toggleContact(contactId: string) {
    setSelectedContactIds((current) => {
      const next = new Set(current);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }
      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedContactIds((current) => {
      const next = new Set(current);

      if (allSelected) {
        selectableIds.forEach((id) => next.delete(id));
      } else {
        selectableIds.forEach((id) => next.add(id));
      }

      return next;
    });
  }

  function selectMissingOnly() {
    setSelectedContactIds(
      new Set(
        selectableIds.filter((id) => {
          const details = revealedContactDetails[id];
          return !details?.emails.length && !details?.phones.length;
        })
      )
    );
  }

  async function copyValues(kind: "emails" | "phones") {
    const values = Array.from(
      new Set(
        filteredCandidates.flatMap((candidate) => {
          const details = candidate.lushaContactId ? revealedContactDetails[candidate.lushaContactId] : undefined;
          return details ? details[kind] : [];
        })
      )
    );

    if (!values.length) return;

    await navigator.clipboard.writeText(values.join("; "));
    setCopied(kind);
    window.setTimeout(() => setCopied(""), 1800);
  }

  function exportCsv() {
    const headers = [
      "personName",
      "company",
      "companyDomain",
      "title",
      "location",
      "linkedinUrl",
      "emails",
      "phones",
      "source"
    ];
    const rows = filteredCandidates.map((candidate) => {
      const details = candidate.lushaContactId ? revealedContactDetails[candidate.lushaContactId] : undefined;

      return [
        candidate.personName,
        candidate.company,
        candidate.companyDomain ?? "",
        candidate.title,
        candidate.location ?? "",
        candidate.linkedinUrl ?? "",
        details?.emails.join("; ") ?? "",
        details?.phones.join("; ") ?? "",
        candidate.sourceLabel
      ];
    });

    const csv = [headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `bulk-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function revealSelected() {
    const reveal: ContactRevealField[] = [
      ...(wantEmails ? (["emails"] as const) : []),
      ...(wantPhones ? (["phones"] as const) : [])
    ];
    const contactIds = Array.from(selectedContactIds);

    if (!contactIds.length || !reveal.length || running) return;

    const fieldLabel = reveal.length === 2 ? "email addresses and phone numbers" : reveal[0] === "emails" ? "email addresses" : "phone numbers";
    const confirmed = window.confirm(
      `Get ${fieldLabel} for ${contactIds.length} selected ${contactIds.length === 1 ? "contact" : "contacts"}? This may consume Lusha credits. Contacts already revealed are reused for free.`
    );

    if (!confirmed) return;

    setRunning(true);
    setError("");
    setWarnings([]);
    setRunSummary(null);
    setRowErrors({});
    setProgress({ done: 0, total: contactIds.length });

    const totals: RunSummary = { ...emptyRunSummary };
    const collectedWarnings: string[] = [];
    const failedIds: string[] = [];
    const failuresByContactId: Record<string, string> = {};
    const localLushaApiKey = window.sessionStorage.getItem("localLushaApiKey") ?? "";

    try {
      for (let start = 0; start < contactIds.length; start += maxBulkRevealContacts) {
        const chunk = contactIds.slice(start, start + maxBulkRevealContacts);
        const result = await fetch("/api/reveal-contacts-bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactIds: chunk, reveal, localLushaApiKey })
        });
        const data = await result.json();

        if (!result.ok) {
          throw new Error(data.error || "Bulk reveal failed.");
        }

        const bulk = data as BulkRevealResponse;

        bulk.results.forEach((entry) => {
          if (entry.details) {
            onRevealedContactDetailsChange(entry.details);
          }
          if (entry.status === "failed") {
            failedIds.push(entry.contactId);
            failuresByContactId[entry.contactId] = entry.error || "Reveal failed.";
          }
        });

        totals.requested += bulk.summary.requested;
        totals.revealed += bulk.summary.revealed;
        totals.cached += bulk.summary.cached;
        totals.empty += bulk.summary.empty;
        totals.failed += bulk.summary.failed;
        totals.creditsUsed += bulk.summary.creditsUsed;
        totals.apiCallsUsed += bulk.summary.apiCallsUsed;
        collectedWarnings.push(...bulk.warnings);

        setProgress({ done: Math.min(start + chunk.length, contactIds.length), total: contactIds.length });
      }

      setRunSummary(totals);
      setRowErrors(failuresByContactId);
      setWarnings(Array.from(new Set(collectedWarnings)));
      // Keep only the failures selected so a retry does not re-bill the rest.
      setSelectedContactIds(new Set(failedIds));
    } catch (revealError) {
      setError(revealError instanceof Error ? revealError.message : "Bulk reveal failed.");
    } finally {
      setRunning(false);
    }
  }

  const sourceButtons: Array<{ value: ContactSource; label: string; count: number }> = [
    { value: "decisionMakers", label: "Decision maker results", count: decisionMakerCandidates.length },
    { value: "jobChanges", label: "Job change results", count: jobChangeCandidates.length },
    { value: "saved", label: "Saved search", count: savedCandidates.length }
  ];

  return (
    <div className="grid gap-5">
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-slate-200/80 bg-white pb-5">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-primary/10 p-2 text-primary">
              <Users className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <CardTitle className="text-lg">Bulk Emails &amp; Phones</CardTitle>
              <CardDescription className="mt-2">
                Pull contact details for a whole result set in one go. Contacts are enriched in batches of up to{" "}
                {maxBulkRevealContacts} per request, and anything revealed earlier is reused without spending credits again.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 p-6">
          <div className="grid gap-2">
            <p className="text-sm font-semibold text-slate-950">Contact source</p>
            <div className="flex flex-wrap gap-2">
              {sourceButtons.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={source === option.value ? "default" : "outline"}
                  onClick={() => setSource(option.value)}
                  disabled={running}
                >
                  {option.label}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      source === option.value ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {option.count}
                  </span>
                </Button>
              ))}
            </div>
          </div>

          {source === "saved" ? (
            <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <label className="text-sm font-semibold text-slate-950" htmlFor="bulkSavedRun">
                Load contacts from a saved search
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  id="bulkSavedRun"
                  value={savedRunId}
                  onChange={(event) => void loadSavedRun(event.target.value)}
                  disabled={running || historyLoading}
                  className="select-control h-10 min-w-0 flex-1"
                >
                  <option value="">
                    {historyLoading ? "Loading saved searches..." : history.length ? "Select a saved search" : "No saved searches yet"}
                  </option>
                  {history.map((run) => (
                    <option key={run.id} value={run.id}>
                      {runLabel(run)}
                    </option>
                  ))}
                </select>
                {savedRunLoading ? <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" /> : null}
              </div>
              <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <History className="h-3.5 w-3.5" aria-hidden="true" />
                Saved runs keep their Lusha contact IDs, so their contacts can be enriched later without re-running the search.
              </p>
              {savedRunError ? <p className="text-xs text-red-700">{savedRunError}</p> : null}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-[1fr_200px_auto]">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter by name, company or title"
            />
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as ContactFilter)}
              className="select-control h-10"
            >
              <option value="all">All contacts</option>
              <option value="missing">Missing details</option>
              <option value="revealed">Has any detail</option>
              <option value="withEmail">Has email</option>
              <option value="withPhone">Has phone</option>
            </select>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={wantEmails}
                  onChange={(event) => setWantEmails(event.target.checked)}
                  disabled={running}
                  className="h-4 w-4 accent-primary"
                />
                Emails
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={wantPhones}
                  onChange={(event) => setWantPhones(event.target.checked)}
                  disabled={running}
                  className="h-4 w-4 accent-primary"
                />
                Phones
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={revealSelected}
              disabled={running || !selectedContactIds.size || (!wantEmails && !wantPhones)}
            >
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  <Phone className="h-4 w-4" aria-hidden="true" />
                </span>
              )}
              {running
                ? `Getting details ${progress.done}/${progress.total}`
                : `Get details (${selectedContactIds.size})`}
            </Button>
            <Button type="button" variant="outline" onClick={toggleAllVisible} disabled={running || !selectableIds.length}>
              {allSelected ? "Clear selection" : `Select all shown (${selectableIds.length})`}
            </Button>
            <Button type="button" variant="outline" onClick={selectMissingOnly} disabled={running || !selectableIds.length}>
              Select missing only
            </Button>
            <Button type="button" variant="outline" onClick={() => void copyValues("emails")}>
              {copied === "emails" ? <Check className="h-4 w-4" aria-hidden="true" /> : <ClipboardCopy className="h-4 w-4" aria-hidden="true" />}
              Copy emails
            </Button>
            <Button type="button" variant="outline" onClick={() => void copyValues("phones")}>
              {copied === "phones" ? <Check className="h-4 w-4" aria-hidden="true" /> : <ClipboardCopy className="h-4 w-4" aria-hidden="true" />}
              Copy phones
            </Button>
            <Button type="button" variant="outline" onClick={exportCsv} disabled={!filteredCandidates.length}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Export CSV
            </Button>
          </div>

          {withoutContactId ? (
            <p className="text-xs text-muted-foreground">
              {withoutContactId} {withoutContactId === 1 ? "contact has" : "contacts have"} no Lusha contact ID and cannot be
              enriched.
            </p>
          ) : null}

          {error ? (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}

          {runSummary ? (
            <div
              className={`rounded-xl border p-3 text-sm ${
                runSummary.failed
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
              }`}
              role="status"
            >
              <p className="font-semibold">
                {runSummary.revealed} revealed - {runSummary.cached} already stored - {runSummary.empty} with no details -{" "}
                {runSummary.failed} failed
              </p>
              <p className="mt-1 text-xs">
                {runSummary.creditsUsed.toFixed(2)} Lusha credits across {runSummary.apiCallsUsed}{" "}
                {runSummary.apiCallsUsed === 1 ? "API call" : "API calls"} for {runSummary.requested} contacts.
              </p>
            </div>
          ) : null}

          {warnings.map((warning) => (
            <div key={warning} className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{warning}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-subtle">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 p-5">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-950">Contacts</h2>
            <Badge variant="muted">{filteredCandidates.length} shown</Badge>
            {selectedContactIds.size ? <Badge variant="info">{selectedContactIds.size} selected</Badge> : null}
          </div>
          <p className="text-xs text-muted-foreground">Emails and phones stay available to every tab once revealed.</p>
        </div>

        {filteredCandidates.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-12 px-4 py-3">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAllVisible}
                      disabled={running || !selectableIds.length}
                      aria-label="Select all shown contacts"
                      className="h-4 w-4 accent-primary"
                    />
                  </th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">LinkedIn</th>
                  <th className="px-4 py-3">Emails</th>
                  <th className="px-4 py-3">Phones</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredCandidates.map((candidate) => {
                  const details = candidate.lushaContactId ? revealedContactDetails[candidate.lushaContactId] : undefined;
                  const hasDetails = Boolean(details?.emails.length || details?.phones.length);
                  const rowError = candidate.lushaContactId ? rowErrors[candidate.lushaContactId] : undefined;

                  return (
                    <tr key={candidate.id} className="align-top transition hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={Boolean(candidate.lushaContactId && selectedContactIds.has(candidate.lushaContactId))}
                          onChange={() => candidate.lushaContactId && toggleContact(candidate.lushaContactId)}
                          disabled={running || !candidate.lushaContactId}
                          aria-label={`Select ${candidate.personName}`}
                          className="h-4 w-4 accent-primary"
                        />
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-950">{candidate.personName}</td>
                      <td className="px-4 py-3">{candidate.company || "-"}</td>
                      <td className="px-4 py-3">{candidate.title || "-"}</td>
                      <td className="px-4 py-3">{candidate.location || "-"}</td>
                      <td className="px-4 py-3">
                        {candidate.linkedinUrl ? (
                          <a
                            href={candidate.linkedinUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                          >
                            Open
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {details?.emails.length ? (
                          <div className="grid gap-1">
                            {details.emails.map((email) => (
                              <a key={email} href={`mailto:${email}`} className="text-primary underline-offset-4 hover:underline">
                                {email}
                              </a>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {details?.phones.length ? (
                          <div className="grid gap-1">
                            {details.phones.map((phone) => (
                              <a key={phone} href={`tel:${phone}`} className="text-primary underline-offset-4 hover:underline">
                                {phone}
                              </a>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!candidate.lushaContactId ? (
                          <Badge variant="muted">No Lusha ID</Badge>
                        ) : hasDetails ? (
                          <Badge variant="success">Have details</Badge>
                        ) : rowError ? (
                          <Badge variant="destructive" title={rowError}>Failed</Badge>
                        ) : details ? (
                          <Badge variant="warning">None found</Badge>
                        ) : (
                          <Badge variant="muted">Not checked</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-primary">
              <Users className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="mt-4 text-base font-semibold text-slate-950">No contacts to enrich yet</p>
            <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
              Run a Job Changes or Decision Makers search, or pick a saved search above, then select the contacts you want
              emails and phone numbers for.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
