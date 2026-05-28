"use client";

import { Check, Clipboard, Download, ExternalLink } from "lucide-react";
import { useState } from "react";
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
      <div className="rounded-lg border bg-card p-10 text-center shadow-subtle">
        <p className="text-base font-semibold">No MIDAS champion matches yet</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Try a broader duration, fewer title filters, or add more previous-company records to the MIDAS Account Database.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card shadow-subtle">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">MIDAS champion candidates</h2>
          <p className="text-sm text-muted-foreground">Sorted by champion score and signal recency.</p>
        </div>
        <Button type="button" variant="outline" onClick={onExportCsv}>
          <Download className="h-4 w-4" aria-hidden="true" />
          Export CSV
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1480px] text-left text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
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
              <th className="px-4 py-3">Message</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {results.map((record) => (
              <tr key={record.id} className="align-top hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{record.personName}</td>
                <td className="px-4 py-3">{record.newCompany}</td>
                <td className="px-4 py-3">{record.newTitle}</td>
                <td className="px-4 py-3">
                  <div>{record.previousCompany}</div>
                  <div className="text-xs text-muted-foreground">{record.previousCompanyDomain || "-"}</div>
                </td>
                <td className="px-4 py-3">
                  {record.midasAccountMatched ? record.midasMatchedCompanyName : "No match"}
                  {record.previousCompanyCountryFromDatabase ? (
                    <div className="text-xs text-muted-foreground">{record.previousCompanyCountryFromDatabase}</div>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={relationshipVariant(record.midasRelationshipStatus)}>
                    {record.midasRelationshipStatus || "Unknown"}
                  </Badge>
                </td>
                <td className="px-4 py-3">{record.midasMatchConfidence.replace("_", " ")}</td>
                <td className="px-4 py-3">
                  <Badge variant={potentialVariant(record.championPotential)}>{record.championPotential}</Badge>
                </td>
                <td className="px-4 py-3 font-semibold">{record.championLikelihoodScore}</td>
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
                  <Button type="button" size="sm" variant="outline" onClick={() => copyMessage(record)}>
                    {copiedId === record.id ? (
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <Clipboard className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
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
