"use client";

import { Building2, Check, Clipboard, Download, ExternalLink, MapPin, MessageSquare, ShieldCheck, Sparkles, Star, UserRound } from "lucide-react";
import { useState } from "react";
import { RevealContactDetails } from "@/components/RevealContactDetails";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ChampionContactJobChange, ChampionPotential, MidasRelationshipStatus, RevealedContactDetails } from "@/lib/types";

type ChampionResultsTableProps = {
  results: ChampionContactJobChange[];
  disciplineLabel?: string;
  revealedContactDetails?: Record<string, RevealedContactDetails>;
  onRevealedContactDetailsChange?: (details: RevealedContactDetails) => void;
  onExportCsv: () => void;
};

function relationshipVariant(status?: MidasRelationshipStatus) {
  if (status === "Client") return "success";
  if (status === "Former Client") return "info";
  if (status === "Prospect") return "warning";
  if (status === "Partner") return "purple";
  return "muted";
}

function potentialVariant(potential: ChampionPotential) {
  if (potential === "High") return "success";
  if (potential === "Medium") return "warning";
  return "muted";
}

function formatConfidence(value: ChampionContactJobChange["midasMatchConfidence"]) {
  return value.replace(/_/g, " ");
}

function hasMidasProfileMention(record: ChampionContactJobChange) {
  const profileText = [record.profileText, ...(record.skills ?? [])].join(" ").toLowerCase();
  return /\bmidas\b/.test(profileText);
}

export function ChampionResultsTable({
  results,
  disciplineLabel,
  revealedContactDetails = {},
  onRevealedContactDetailsChange,
  onExportCsv
}: ChampionResultsTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copyMessage(record: ChampionContactJobChange) {
    await navigator.clipboard.writeText(record.suggestedMessage);
    setCopiedId(record.id);
    window.setTimeout(() => setCopiedId(null), 1800);
  }

  if (!results.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-subtle">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-primary">
          <Sparkles className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="mt-4 text-base font-semibold text-slate-950">No matching champion migrations found</p>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          Try broadening the duration, location, or disabling known-account-only filtering.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-subtle">
      <div className="flex flex-col gap-3 border-b border-slate-200/80 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-950">Champion migration results</h2>
            <Badge variant="muted">{results.length} records</Badge>
            {disciplineLabel ? <Badge variant="info">{disciplineLabel}</Badge> : null}
          </div>
          <p className="text-sm text-muted-foreground">Compact sales intelligence view sorted by champion potential and MIDAS match strength.</p>
        </div>
        <Button type="button" variant="outline" onClick={onExportCsv}>
          <Download className="h-4 w-4" aria-hidden="true" />
          Export CSV
        </Button>
      </div>

      <div className="grid gap-3 bg-slate-50/50 p-4">
        {results.map((record) => {
          const midasMentioned = hasMidasProfileMention(record);

          return (
            <article
              key={record.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-subtle"
            >
              <div className="grid gap-4 xl:grid-cols-[minmax(250px,1fr)_minmax(320px,1.35fr)_minmax(250px,0.95fr)_minmax(190px,auto)]">
                <div className="grid content-start gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-primary">
                      <UserRound className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="font-semibold text-slate-950">{record.personName}</h3>
                      <p className="mt-1 text-sm leading-5 text-slate-600">{record.newTitle}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="info">Job change</Badge>
                    {record.championPotential === "High" ? <Badge variant="success">High priority</Badge> : null}
                    {record.midasAccountMatched ? <Badge variant="success">Known MIDAS account</Badge> : null}
                    {midasMentioned ? <Badge variant="purple">MIDAS mention</Badge> : null}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    {record.location || "Location unavailable"}
                  </div>
                </div>

                <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current company</p>
                      <p className="mt-1 font-semibold text-slate-950">{record.newCompany}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{record.newCompanyDomain || "Domain unavailable"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Previous company</p>
                      <p className="mt-1 font-semibold text-slate-950">{record.previousCompany}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{record.previousCompanyDomain || "Domain unavailable"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Building2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    Previous role: {record.previousTitle || "Unavailable"}
                  </div>
                </div>

                <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Champion score</p>
                      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{record.championLikelihoodScore}</p>
                    </div>
                    <Badge variant={potentialVariant(record.championPotential)}>
                      <Star className="h-3.5 w-3.5" aria-hidden="true" />
                      {record.championPotential}
                    </Badge>
                  </div>
                  <div className="grid gap-2 text-xs text-slate-600">
                    <div className="flex items-center justify-between gap-3">
                      <span>Match confidence</span>
                      <span className="font-semibold capitalize text-slate-900">{formatConfidence(record.midasMatchConfidence)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Relationship</span>
                      <Badge variant={relationshipVariant(record.midasRelationshipStatus)}>
                        {record.midasRelationshipStatus || "Unknown"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Profile mentions MIDAS</span>
                      <Badge variant={midasMentioned ? "purple" : "muted"}>{midasMentioned ? "Yes" : "No"}</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Previous company known</span>
                      <Badge variant={record.midasAccountMatched ? "success" : "muted"}>
                        {record.midasAccountMatched ? "Yes" : "No"}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="grid content-start gap-2">
                  {record.linkedinUrl ? (
                    <a
                      href={record.linkedinUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-10 items-center justify-start gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      Open LinkedIn
                    </a>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-muted-foreground">No LinkedIn URL</div>
                  )}
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Contact details</p>
                    <RevealContactDetails
                      contactId={record.lushaContactId}
                      initialDetails={record.lushaContactId ? revealedContactDetails[record.lushaContactId] : undefined}
                      onDetailsChange={onRevealedContactDetailsChange}
                    />
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => copyMessage(record)} className="h-10 justify-start">
                    {copiedId === record.id ? (
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <Clipboard className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {copiedId === record.id ? "Copied message" : "Copy message"}
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 lg:grid-cols-[1fr_1fr]">
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    Follow-up reason
                  </div>
                  <p className="text-sm leading-6 text-slate-700">{record.championReason}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <MessageSquare className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    Suggested action
                  </div>
                  <p className="text-sm leading-6 text-slate-700">{record.suggestedSalesAction}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
