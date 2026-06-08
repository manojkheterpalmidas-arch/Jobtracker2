"use client";

import { ArrowRight, Check, Clipboard, Download, ExternalLink, Sparkles } from "lucide-react";
import { useState } from "react";
import { RevealContactDetails } from "@/components/RevealContactDetails";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ChampionContactJobChange, ChampionPotential, MidasRelationshipStatus } from "@/lib/types";

type ChampionResultsTableProps = {
  results: ChampionContactJobChange[];
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

export function ChampionResultsTable({ results, onExportCsv }: ChampionResultsTableProps) {
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
            <h2 className="text-base font-semibold text-slate-950">Job-change contacts</h2>
            <Badge variant="muted">{results.length} records</Badge>
          </div>
          <p className="text-sm text-muted-foreground">MIDAS champion matches are highlighted where the previous company is known.</p>
        </div>
        <Button type="button" variant="outline" onClick={onExportCsv}>
          <Download className="h-4 w-4" aria-hidden="true" />
          Export CSV
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1640px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">New company</th>
              <th className="px-4 py-3">New title</th>
              <th className="px-4 py-3">Previous company</th>
              <th className="px-4 py-3">MIDAS match</th>
              <th className="px-4 py-3">Relationship</th>
              <th className="px-4 py-3">Confidence</th>
              <th className="px-4 py-3">Potential</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Suggested action</th>
              <th className="px-4 py-3">LinkedIn</th>
              <th className="px-4 py-3">Contact details</th>
              <th className="px-4 py-3">Message</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {results.map((record) => (
              <tr key={record.id} className="align-top transition hover:bg-slate-50/80">
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-950">{record.personName}</div>
                  <Badge variant="info" className="mt-2">Job change</Badge>
                </td>
                <td className="px-4 py-3 font-medium">{record.newCompany}</td>
                <td className="px-4 py-3 text-slate-700">{record.newTitle}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{record.previousCompany}</div>
                  <div className="text-xs text-muted-foreground">{record.previousCompanyDomain || "-"}</div>
                </td>
                <td className="px-4 py-3">
                  {record.midasAccountMatched ? (
                    <Badge variant="success">{record.midasMatchedCompanyName}</Badge>
                  ) : (
                    <Badge variant="muted">No match</Badge>
                  )}
                  {record.previousCompanyCountryFromDatabase ? (
                    <div className="text-xs text-muted-foreground">{record.previousCompanyCountryFromDatabase}</div>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={relationshipVariant(record.midasRelationshipStatus)}>
                    {record.midasRelationshipStatus || "Unknown"}
                  </Badge>
                </td>
                <td className="px-4 py-3 capitalize">{record.midasMatchConfidence.replace("_", " ")}</td>
                <td className="px-4 py-3">
                  <Badge variant={potentialVariant(record.championPotential)}>{record.championPotential}</Badge>
                </td>
                <td className="px-4 py-3 font-semibold text-slate-950">{record.championLikelihoodScore}</td>
                <td className="px-4 py-3 max-w-sm">{record.championReason}</td>
                <td className="px-4 py-3 max-w-xs">{record.suggestedSalesAction}</td>
                <td className="px-4 py-3">
                  {record.linkedinUrl ? (
                    <a
                      href={record.linkedinUrl}
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
                  <RevealContactDetails contactId={record.lushaContactId} />
                </td>
                <td className="px-4 py-3">
                  <Button type="button" size="sm" variant="outline" onClick={() => copyMessage(record)}>
                    {copiedId === record.id ? (
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <Clipboard className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    <ArrowRight className="hidden h-3.5 w-3.5" aria-hidden="true" />
                    {copiedId === record.id ? "Copied" : "Copy"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
