"use client";

import { Check, Clipboard, Download, ExternalLink, Target } from "lucide-react";
import { useMemo, useState } from "react";
import { RevealContactDetails } from "@/components/RevealContactDetails";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DecisionMakerFit, ProfileMidasMentionResult, RevealedContactDetails } from "@/lib/types";

type ProfileMidasMentionsTableProps = {
  results: ProfileMidasMentionResult[];
  revealedContactDetails?: Record<string, RevealedContactDetails>;
  onRevealedContactDetailsChange?: (details: RevealedContactDetails) => void;
  onExportCsv: () => void;
};

function fitVariant(fit: DecisionMakerFit) {
  if (fit === "high") return "success";
  if (fit === "medium") return "warning";
  return "muted";
}

export function ProfileMidasMentionsTable({
  results,
  revealedContactDetails = {},
  onRevealedContactDetailsChange,
  onExportCsv
}: ProfileMidasMentionsTableProps) {
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
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-subtle">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-primary">
          <Target className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="mt-4 text-base font-semibold text-slate-950">No decision makers checked yet</p>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          Search a target company to find senior engineers and likely technical decision makers.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-subtle">
      <div className="grid gap-3 border-b border-slate-200/80 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-950">Decision maker results</h2>
              <Badge variant="muted">{filteredResults.length} shown</Badge>
            </div>
            <p className="text-sm text-muted-foreground">Senior engineers and technical leaders ranked by role fit.</p>
          </div>
          <Button type="button" variant="outline" onClick={onExportCsv}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-[auto_180px_1fr_1fr]">
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
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
            className="select-control h-10"
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
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
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
              <tr key={record.id} className="align-top transition hover:bg-slate-50/80">
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-950">{record.personName}</div>
                  {record.championFit !== "low" ? <Badge variant="info" className="mt-2">Decision maker</Badge> : null}
                </td>
                <td className="px-4 py-3 font-medium">{record.currentCompany}</td>
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
                  <RevealContactDetails
                    contactId={record.lushaContactId}
                    initialDetails={record.lushaContactId ? revealedContactDetails[record.lushaContactId] : undefined}
                    onDetailsChange={onRevealedContactDetailsChange}
                  />
                </td>
                <td className="px-4 py-3">{record.senioritySignals.join(", ") || "-"}</td>
                <td className="px-4 py-3">{record.roleSignals.join(", ") || "-"}</td>
                <td className="px-4 py-3 font-semibold text-slate-950">{record.decisionMakerScore}</td>
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
