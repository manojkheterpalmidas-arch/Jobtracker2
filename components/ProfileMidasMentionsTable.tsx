"use client";

import { Check, Clipboard, Download, ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MidasMentionConfidence, ProfileMidasMentionResult } from "@/lib/types";

type ProfileMidasMentionsTableProps = {
  results: ProfileMidasMentionResult[];
  onExportCsv: () => void;
};

function confidenceVariant(confidence: MidasMentionConfidence) {
  if (confidence === "high") return "success";
  if (confidence === "medium") return "warning";
  return "muted";
}

export function ProfileMidasMentionsTable({ results, onExportCsv }: ProfileMidasMentionsTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showOnlyMentions, setShowOnlyMentions] = useState(true);
  const [confidence, setConfidence] = useState("");
  const [titleKeyword, setTitleKeyword] = useState("");
  const [matchedKeyword, setMatchedKeyword] = useState("");

  async function copyMessage(record: ProfileMidasMentionResult) {
    await navigator.clipboard.writeText(record.suggestedMessage);
    setCopiedId(record.id);
    window.setTimeout(() => setCopiedId(null), 1800);
  }

  const filteredResults = useMemo(() => {
    return results.filter((record) => {
      if (showOnlyMentions && !record.hasMidasMention) return false;
      if (confidence && record.confidence !== confidence) return false;
      if (titleKeyword && !record.currentTitle.toLowerCase().includes(titleKeyword.toLowerCase())) return false;
      if (matchedKeyword && !record.matchedKeywords.join(" ").toLowerCase().includes(matchedKeyword.toLowerCase())) return false;
      return true;
    });
  }, [confidence, matchedKeyword, results, showOnlyMentions, titleKeyword]);

  if (!results.length) {
    return (
      <div className="rounded-lg border bg-card p-10 text-center shadow-subtle">
        <p className="text-base font-semibold">No contacts checked yet</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Search a target company to scan available profile fields for direct MIDAS mentions.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card shadow-subtle">
      <div className="grid gap-3 border-b p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">Profile MIDAS mention results</h2>
            <p className="text-sm text-muted-foreground">Direct MIDAS evidence from available Lusha fields or manually pasted profile text.</p>
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
              checked={showOnlyMentions}
              onChange={(event) => setShowOnlyMentions(event.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Show only MIDAS mentions
          </label>
          <select
            value={confidence}
            onChange={(event) => setConfidence(event.target.value)}
            className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">All confidence</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <Input value={titleKeyword} onChange={(event) => setTitleKeyword(event.target.value)} placeholder="Filter by title keyword" />
          <Input value={matchedKeyword} onChange={(event) => setMatchedKeyword(event.target.value)} placeholder="Filter by matched keyword" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1480px] text-left text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Current company</th>
              <th className="px-4 py-3">Current title</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">LinkedIn</th>
              <th className="px-4 py-3">MIDAS mention</th>
              <th className="px-4 py-3">Matched keywords</th>
              <th className="px-4 py-3">Evidence field</th>
              <th className="px-4 py-3">Evidence snippet</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Confidence</th>
              <th className="px-4 py-3">Source</th>
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
                <td className="px-4 py-3">{record.hasMidasMention ? "Yes" : "No"}</td>
                <td className="px-4 py-3">{record.matchedKeywords.join(", ") || "-"}</td>
                <td className="px-4 py-3">{record.evidenceFields.slice(0, 2).join(", ") || "-"}</td>
                <td className="px-4 py-3 max-w-md">{record.evidenceSnippets[0] || "Profile fields unavailable or no direct MIDAS mention found."}</td>
                <td className="px-4 py-3 font-semibold">{record.midasMentionScore}</td>
                <td className="px-4 py-3">
                  <Badge variant={confidenceVariant(record.confidence)}>{record.confidence}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={record.source === "Manual" ? "success" : "muted"}>{record.source}</Badge>
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
