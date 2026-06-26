"use client";

import { Check, Clipboard, Download, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ContactJobChange } from "@/lib/types";

type ResultsTableProps = {
  results: ContactJobChange[];
  onExportCsv: () => void;
};

function priorityVariant(priority: ContactJobChange["priorityLevel"]) {
  if (priority === "High") return "success";
  if (priority === "Medium") return "warning";
  return "muted";
}

export function ResultsTable({ results, onExportCsv }: ResultsTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copyMessage(record: ContactJobChange) {
    await navigator.clipboard.writeText(record.suggestedMessage);
    setCopiedId(record.id);
    window.setTimeout(() => setCopiedId(null), 1800);
  }

  if (!results.length) {
    return (
      <div className="rounded-lg border bg-card p-10 text-center shadow-subtle">
        <p className="text-base font-semibold">No job-change signals yet</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Try a broader duration, switch movement direction, or increase the credit guard only after a small test.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card shadow-subtle">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Job-change contacts</h2>
          <p className="text-sm text-muted-foreground">Sorted by relevance score and signal recency.</p>
        </div>
        <Button type="button" variant="outline" onClick={onExportCsv}>
          <Download className="h-4 w-4" aria-hidden="true" />
          Export CSV
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1320px] text-left text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Previous company</th>
              <th className="px-4 py-3">Previous domain</th>
              <th className="px-4 py-3">Previous title</th>
              <th className="px-4 py-3">New company</th>
              <th className="px-4 py-3">New domain</th>
              <th className="px-4 py-3">New title</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Signal date</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Suggested action</th>
              <th className="px-4 py-3">LinkedIn URL</th>
              <th className="px-4 py-3">Message</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {results.map((record) => (
              <tr key={record.id} className="align-top hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{record.personName}</td>
                <td className="px-4 py-3">{record.previousCompany}</td>
                <td className="px-4 py-3 text-muted-foreground">{record.previousCompanyDomain || "-"}</td>
                <td className="px-4 py-3">{record.previousTitle}</td>
                <td className="px-4 py-3">{record.newCompany}</td>
                <td className="px-4 py-3 text-muted-foreground">{record.newCompanyDomain || "-"}</td>
                <td className="px-4 py-3">{record.newTitle}</td>
                <td className="px-4 py-3">{record.location || "-"}</td>
                <td className="px-4 py-3">{record.signalDate}</td>
                <td className="px-4 py-3 font-semibold">{record.relevanceScore}</td>
                <td className="px-4 py-3">
                  <Badge variant={priorityVariant(record.priorityLevel)}>{record.priorityLevel}</Badge>
                </td>
                <td className="px-4 py-3">{record.suggestedSalesAction}</td>
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
