"use client";

import { Check, Clipboard, Download, ExternalLink, Loader2, Mail, Phone, Target } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { RevealContactDetails } from "@/components/RevealContactDetails";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { maxBulkRevealContacts } from "@/lib/types";
import type {
  BulkRevealResponse,
  ContactRevealField,
  DecisionMakerFit,
  ProfileMidasMentionResult,
  RevealedContactDetails
} from "@/lib/types";

type ProfileMidasMentionsTableProps = {
  results: ProfileMidasMentionResult[];
  revealedContactDetails?: Record<string, RevealedContactDetails>;
  onRevealedContactDetailsChange?: (details: RevealedContactDetails) => void;
  onExportCsv: () => void;
};

const fieldLabels: Record<ContactRevealField, string> = {
  emails: "email addresses",
  phones: "phone numbers"
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
  const [onlyKeywordMatches, setOnlyKeywordMatches] = useState(false);
  const [fit, setFit] = useState("");
  const [titleKeyword, setTitleKeyword] = useState("");
  const [roleKeyword, setRoleKeyword] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  // Which reveal is in flight, so emails and phones can be pulled independently.
  const [revealingField, setRevealingField] = useState<ContactRevealField | null>(null);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkStatus, setBulkStatus] = useState<{ kind: "success" | "warning"; message: string } | null>(null);
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

  async function copyMessage(record: ProfileMidasMentionResult) {
    await navigator.clipboard.writeText(record.suggestedMessage);
    setCopiedId(record.id);
    window.setTimeout(() => setCopiedId(null), 1800);
  }

  // Saved runs created before keyword matching existed have no matchedKeywords,
  // so every read of it is defaulted rather than assumed.
  const hasKeywordMatches = useMemo(
    () => results.some((record) => (record.matchedKeywords ?? []).length > 0),
    [results]
  );

  const filteredResults = useMemo(() => {
    return results.filter((record) => {
      const keywordMatched = (record.matchedKeywords ?? []).length > 0;
      // Never hide a contact the user explicitly searched for, whatever its
      // seniority score. This filter is why exact keyword matches used to vanish.
      if (showOnlyDecisionMakers && !keywordMatched && record.championFit === "low") return false;
      if (onlyKeywordMatches && !keywordMatched) return false;
      if (fit && record.championFit !== fit) return false;
      if (titleKeyword && !record.currentTitle.toLowerCase().includes(titleKeyword.toLowerCase())) return false;
      if (roleKeyword && !record.roleSignals.join(" ").toLowerCase().includes(roleKeyword.toLowerCase())) return false;
      return true;
    });
  }, [fit, onlyKeywordMatches, results, roleKeyword, showOnlyDecisionMakers, titleKeyword]);

  const visibleContactIds = useMemo(
    () => Array.from(new Set(filteredResults.map((record) => record.lushaContactId).filter(Boolean) as string[])),
    [filteredResults]
  );
  const allVisibleSelected =
    visibleContactIds.length > 0 && visibleContactIds.every((contactId) => selectedContactIds.has(contactId));
  const someVisibleSelected =
    !allVisibleSelected && visibleContactIds.some((contactId) => selectedContactIds.has(contactId));

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

  useEffect(() => {
    const availableContactIds = new Set(results.map((record) => record.lushaContactId).filter(Boolean) as string[]);

    setSelectedContactIds((current) => {
      const next = new Set(Array.from(current).filter((contactId) => availableContactIds.has(contactId)));
      return next.size === current.size ? current : next;
    });
  }, [results]);

  function toggleContact(contactId: string) {
    setBulkStatus(null);
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
    setBulkStatus(null);
    setSelectedContactIds((current) => {
      const next = new Set(current);

      if (allVisibleSelected) {
        visibleContactIds.forEach((contactId) => next.delete(contactId));
      } else {
        visibleContactIds.forEach((contactId) => next.add(contactId));
      }

      return next;
    });
  }

  async function revealSelectedContacts(field: ContactRevealField) {
    if (!selectedContactIds.size || revealingField) return;

    const contactIds = Array.from(selectedContactIds).filter((contactId) =>
      results.some((record) => record.lushaContactId === contactId)
    );

    if (!contactIds.length) {
      setSelectedContactIds(new Set());
      return;
    }

    const confirmed = window.confirm(
      `Get ${fieldLabels[field]} for ${contactIds.length} selected ${contactIds.length === 1 ? "contact" : "contacts"}? This may consume Lusha credits. Contacts already revealed are reused for free.`
    );

    if (!confirmed) return;

    setRevealingField(field);
    setBulkProgress(0);
    setBulkStatus(null);

    const localLushaApiKey = window.sessionStorage.getItem("localLushaApiKey") ?? "";
    const failedIds: string[] = [];
    const messages: string[] = [];
    let revealed = 0;
    let cached = 0;
    let empty = 0;

    try {
      for (let start = 0; start < contactIds.length; start += maxBulkRevealContacts) {
        const chunk = contactIds.slice(start, start + maxBulkRevealContacts);
        const result = await fetch("/api/reveal-contacts-bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactIds: chunk, reveal: [field], localLushaApiKey })
        });
        const data = await result.json();

        if (!result.ok) {
          throw new Error(data.error || "Reveal failed.");
        }

        const bulk = data as BulkRevealResponse;

        bulk.results.forEach((entry) => {
          if (entry.details) {
            onRevealedContactDetailsChange?.(entry.details);
          }
          if (entry.status === "failed") {
            failedIds.push(entry.contactId);
          }
        });

        revealed += bulk.summary.revealed;
        cached += bulk.summary.cached;
        empty += bulk.summary.empty;
        messages.push(...bulk.warnings);
        setBulkProgress(Math.min(start + chunk.length, contactIds.length));
      }

      const label = field === "emails" ? "Email" : "Phone";
      const detail = `${revealed} revealed, ${cached} already stored, ${empty} with none found, ${failedIds.length} failed.`;

      setBulkStatus({
        kind: failedIds.length || messages.length ? "warning" : "success",
        message: `${label} reveal finished. ${detail}${messages.length ? ` ${Array.from(new Set(messages)).join(" ")}` : ""}`
      });
      // Only failures stay selected so a retry does not re-bill the rest.
      setSelectedContactIds(new Set(failedIds));
    } catch (error) {
      setBulkStatus({
        kind: "warning",
        message: error instanceof Error ? error.message : "Reveal failed."
      });
    } finally {
      setRevealingField(null);
    }
  }

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
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => revealSelectedContacts("emails")}
              disabled={!selectedContactIds.size || revealingField !== null}
            >
              {revealingField === "emails" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Mail className="h-4 w-4" aria-hidden="true" />
              )}
              {revealingField === "emails"
                ? `Getting emails ${bulkProgress}/${selectedContactIds.size}`
                : `Get emails (${selectedContactIds.size})`}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => revealSelectedContacts("phones")}
              disabled={!selectedContactIds.size || revealingField !== null}
            >
              {revealingField === "phones" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Phone className="h-4 w-4" aria-hidden="true" />
              )}
              {revealingField === "phones"
                ? `Getting phones ${bulkProgress}/${selectedContactIds.size}`
                : `Get phones (${selectedContactIds.size})`}
            </Button>
            <Button type="button" variant="outline" onClick={onExportCsv}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Export CSV
            </Button>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-[auto_auto_180px_1fr_1fr]">
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
            <input
              type="checkbox"
              checked={showOnlyDecisionMakers}
              onChange={(event) => setShowOnlyDecisionMakers(event.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Show only medium/high fit
          </label>
          {hasKeywordMatches ? (
            <label className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900 shadow-sm">
              <input
                type="checkbox"
                checked={onlyKeywordMatches}
                onChange={(event) => setOnlyKeywordMatches(event.target.checked)}
                className="h-4 w-4 accent-emerald-600"
              />
              Keyword matches only
            </label>
          ) : null}
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
        <p className="text-xs text-muted-foreground">
          Select contacts in the table, then pull emails and phone numbers separately. Contacts already revealed are reused
          without spending credits again.
        </p>
        {bulkStatus ? (
          <div
            role="status"
            className={`rounded-xl border px-3 py-2 text-sm ${
              bulkStatus.kind === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            {bulkStatus.message}
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1380px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-12 px-4 py-3">
                <input
                  ref={selectAllCheckboxRef}
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  disabled={!visibleContactIds.length || revealingField !== null}
                  aria-label="Select all visible contacts"
                  title="Select all visible contacts"
                  className="h-4 w-4 accent-primary"
                />
              </th>
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
                  <input
                    type="checkbox"
                    checked={Boolean(record.lushaContactId && selectedContactIds.has(record.lushaContactId))}
                    onChange={() => record.lushaContactId && toggleContact(record.lushaContactId)}
                    disabled={!record.lushaContactId || revealingField !== null}
                    aria-label={`Select ${record.personName}`}
                    className="h-4 w-4 accent-primary"
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-950">{record.personName}</div>
                  {record.championFit !== "low" ? <Badge variant="info" className="mt-2">Decision maker</Badge> : null}
                </td>
                <td className="px-4 py-3 font-medium">{record.currentCompany}</td>
                <td className="px-4 py-3">
                  <div>{record.currentTitle}</div>
                  {(record.matchedKeywords ?? []).length ? (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {(record.matchedKeywords ?? []).map((keyword) => (
                        <span
                          key={keyword}
                          title={record.exactKeywordMatch ? "Exact keyword match" : "Matched all keyword terms"}
                          className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800"
                        >
                          {record.exactKeywordMatch ? "Exact" : "Close"}: {keyword}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </td>
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
                    disabled={revealingField !== null && Boolean(record.lushaContactId && selectedContactIds.has(record.lushaContactId))}
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
