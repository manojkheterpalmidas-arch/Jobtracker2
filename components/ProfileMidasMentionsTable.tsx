"use client";

import { Check, Clipboard, Download, ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import { RevealContactDetails } from "@/components/RevealContactDetails";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DecisionMakerFit, ProfileMidasMentionResult } from "@/lib/types";

type ProfileMidasMentionsTableProps = {
  results: ProfileMidasMentionResult[];
  onExportCsv: () => void;
};

function fitVariant(fit: DecisionMakerFit) {
  if (fit === "high") return "success";
  if (fit === "medium") return "warning";
  return "muted";
}

export function ProfileMidasMentionsTable({ results, onExportCsv }: ProfileMidasMentionsTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showOnlyDecisionMakers, setShowOnlyDecisionMakers] = useState(true);
  const [fit, setFit] = useState("");
  const [titleKeyword, setTitleKeyword] = useState("");
  const [roleKeyword, setRoleKeyword] = useState("");

  async function copyMessage(record: ProfileMidasMentionResult) {
    await navigator.clipboard.writeText(record.suggestedMessage);
    setCopiedId(record.id);
    window.setTimeout(() => setCopiedId(null), 1800);
  }

  const filteredResults = useMemo(() => {
    return results.filter((record) => {
      if (showOnlyDecisionMakers && record.championFit === "low") return false;
      if (fit && record.championFit !== fit) return false;
      if (titleKeyword && !record.currentTitle.toLowerCase().includes(titleKeyword.toLowerCase())) return false;
      if (roleKeyword && !record.roleSignals.join(" ").toLowerCase().includes(roleKeyword.toLowerCase())) return false;
      return true;
    });
  }, [fit, results, roleKeyword, showOnlyDecisionMakers, titleKeyword]);

  if (!results.length) {
    return (
      <div className="rounded-lg border bg-card p-10 text-center shadow-subtle">
        <p className="text-base font-semibold">No contacts checked yet</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Search a target company to find senior engineers and likely technical decision makers.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card shadow-subtle">
      <div className="grid gap-3 border-b p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">Decision maker results</h2>
            <p className="text-sm text-muted-foreground">Senior engineers and technical leaders ranked by role fit.</p>
          </div>
          <Button type="button" variant="outline" onClick={onExportCsv}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-[auto_180px_1fr_1fr]">
          <label className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={showOnlyDecisionMakers}
              onChange={(event) => setShowOnlyDecisionMakers(event.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Show only medium/high fit
          </label>
          <select
            value={fit}
            onChange={(event) => setFit(event.target.value)}
            className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">All fit levels</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <Input value={titleKeyword} onChange={(event) => setTitleKeyword(event.target.value)} placeholder="Filter by title keyword" />
          <Input value={roleKeyword} onChange={(event) => setRoleKeyword(event.target.value)} placeholder="Filter by role signal" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1320px] text-left text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Current company</th>
              <th className="px-4 py-3">Current title</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">LinkedIn</th>
              <th className="px-4 py-3">Contact details</th>
              <th className="px-4 py-3">Seniority signals</th>
              <th className="px-4 py-3">Role signals</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Champion fit</th>
              <th className="px-4 py-3">Suggested action</th>
              <th className="px-4 py-3">Message</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredResults.map((record) => (
              <tr key={record.id} className="align-top hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{record.personName}</td>
                <td className="px-4 py-3">{record.currentCompany}</td>
                <td className="px-4 py-3">{record.currentTitle}</td>
                <td className="px-4 py-3">{record.location || "-"}</td>
                <td className="px-4 py-3">
                  {record.linkedinUrl ? (
                    <a href={record.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
                      Open
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  ) : "-"}
                </td>
                <td className="px-4 py-3">
                  <RevealContactDetails contactId={record.lushaContactId} />
                </td>
                <td className="px-4 py-3">{record.senioritySignals.join(", ") || "-"}</td>
                <td className="px-4 py-3">{record.roleSignals.join(", ") || "-"}</td>
                <td className="px-4 py-3 font-semibold">{record.decisionMakerScore}</td>
                <td className="px-4 py-3">
                  <Badge variant={fitVariant(record.championFit)}>{record.championFit}</Badge>
                </td>
                <td className="px-4 py-3 max-w-xs">{record.suggestedAction}</td>
                <td className="px-4 py-3">
                  <Button type="button" size="sm" variant="outline" onClick={() => copyMessage(record)}>
                    {copiedId === record.id ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Clipboard className="h-3.5 w-3.5" aria-hidden="true" />}
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
