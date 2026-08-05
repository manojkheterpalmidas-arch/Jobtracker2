"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AlertTriangle, KeyRound, Loader2, Search, Target, Users } from "lucide-react";
import {
  keywordModeDescriptions,
  keywordModeLabels,
  keywordModeOptions,
  maxTitleKeywords as MAX_TITLE_KEYWORDS,
  profileMentionContactLimitOptions,
  profileMentionDisciplineLabels,
  profileMentionDisciplineOptions,
  type KeywordMode,
  type ProfileMentionContactLimit,
  type ProfileMentionDiscipline,
  type ProfileMidasMentionRequest,
  type ProfileMidasMentionResponse,
  type ProfileMidasMentionResult,
  type RevealedContactDetails,
  type SearchRequest
} from "@/lib/types";
import { ProfileMidasMentionsTable } from "@/components/ProfileMidasMentionsTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseDomains } from "@/lib/domain";

const seniorityOptions = ["Engineer", "Senior", "Principal", "Associate", "Director", "Technical Director", "Head"];

function parseKeywords(value: string) {
  return value
    .split(/[\n,]/)
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

function hasSameKeywords(value: string, keywords: string[]) {
  const parsed = parseKeywords(value);
  return parsed.length === keywords.length && parsed.every((keyword, index) => keyword === keywords[index]);
}

function csvValue(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

type ProfileMidasMentionsPageProps = {
  initialResponse?: ProfileMidasMentionResponse | null;
  initialRequest?: DecisionMakerDraft | null;
  onDraftChange?: (request: DecisionMakerDraft) => void;
  /** Publishes results so other tabs (e.g. bulk contacts) can work on the same people. */
  onResultsChange?: (results: ProfileMidasMentionResult[]) => void;
  /** When supplied, revealed emails/phones are shared with the rest of the app. */
  revealedContactDetails?: Record<string, RevealedContactDetails>;
  onRevealedContactDetailsChange?: (details: RevealedContactDetails) => void;
};

type DecisionMakerDraft = Omit<Partial<ProfileMidasMentionRequest>, "discipline"> &
  Omit<Partial<SearchRequest>, "discipline"> & {
    discipline?: string;
  };

function toProfileDiscipline(value?: string): ProfileMentionDiscipline {
  if (value === "geotechnical" || value === "custom" || value === "structural_bridge") return value;
  if (value === "transport_highways" || value === "rail_structures") return "all_engineering";
  if (value === "civil_engineering" || value === "all_engineering") return value;
  return "structural_bridge";
}

export function ProfileMidasMentionsPage({
  initialResponse,
  initialRequest,
  onDraftChange,
  onResultsChange,
  revealedContactDetails: sharedRevealedContactDetails,
  onRevealedContactDetailsChange: onSharedRevealedContactDetailsChange
}: ProfileMidasMentionsPageProps) {
  const [companyDomainsText, setCompanyDomainsText] = useState("wsp.com");
  const [companyName, setCompanyName] = useState("WSP");
  const [location, setLocation] = useState("United Kingdom");
  const [discipline, setDiscipline] = useState<ProfileMentionDiscipline>("structural_bridge");
  const [seniority, setSeniority] = useState<string[]>(["Principal", "Associate", "Director", "Technical Director", "Head"]);
  const [maxContactsToCheck, setMaxContactsToCheck] = useState<ProfileMentionContactLimit>(25);
  const [customTitleKeywords, setCustomTitleKeywords] = useState("");
  const [keywordMode, setKeywordMode] = useState<KeywordMode>("expanded");
  const [localLushaApiKey, setLocalLushaApiKey] = useState("");
  const [response, setResponse] = useState<ProfileMidasMentionResponse | null>(null);
  const [localRevealedContactDetails, setLocalRevealedContactDetails] = useState<Record<string, RevealedContactDetails>>({});
  const revealedContactDetails = sharedRevealedContactDetails ?? localRevealedContactDetails;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLocalLushaApiKey(window.sessionStorage.getItem("localLushaApiKey") ?? "");
  }, []);

  useEffect(() => {
    if (initialResponse) {
      setResponse(initialResponse);
      setLocalRevealedContactDetails({});
    }
  }, [initialResponse]);

  // Only a real response is published. Switching tabs unmounts this page, and an
  // empty remount must not wipe the contacts the bulk tab is holding.
  useEffect(() => {
    if (!response) return;
    onResultsChange?.(response.results);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  useEffect(() => {
    if (!initialRequest) return;

    const incomingDomains = initialRequest.companyDomains?.length
      ? initialRequest.companyDomains
      : initialRequest.companyDomain
        ? [initialRequest.companyDomain]
        : parseDomains(companyDomainsText);
    setCompanyDomainsText(incomingDomains.join("\n"));
    setCompanyName(initialRequest.companyName ?? companyName);
    setLocation(initialRequest.location ?? location);
    setDiscipline(toProfileDiscipline(initialRequest.discipline));
    setSeniority(initialRequest.seniority ?? seniority);
    setMaxContactsToCheck(initialRequest.maxContactsToCheck ?? maxContactsToCheck);
    if (initialRequest.keywordMode) setKeywordMode(initialRequest.keywordMode);
    const incomingTitleKeywords = initialRequest.customTitleKeywords ?? [];
    setCustomTitleKeywords((current) => (
      hasSameKeywords(current, incomingTitleKeywords) ? current : incomingTitleKeywords.join("\n")
    ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRequest]);

  function updateDraft(patch: DecisionMakerDraft) {
    onDraftChange?.(patch);
  }

  function toggleSeniority(value: string) {
    setSeniority((current) => {
      const nextValue = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
      updateDraft({ seniority: nextValue });
      return nextValue;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setLocalRevealedContactDetails({});
    window.sessionStorage.setItem("localLushaApiKey", localLushaApiKey);

    const companyDomains = parseDomains(companyDomainsText);
    const payload: ProfileMidasMentionRequest = {
      companyDomain: companyDomains[0] ?? "",
      companyDomains,
      companyName,
      location,
      discipline,
      customTitleKeywords: parseKeywords(customTitleKeywords),
      keywordMode,
      seniority,
      maxContactsToCheck,
      localLushaApiKey
    };

    try {
      const result = await fetch("/api/profile-midas-mentions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await result.json();

      if (!result.ok) throw new Error(data.error || "Decision-maker search failed.");

      setResponse(data);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Decision-maker search failed.");
      setResponse(null);
    } finally {
      setLoading(false);
    }
  }

  function exportCsv() {
    if (!response) return;
    const headers = [
      "targetCompany",
      "targetDomains",
      "personName",
      "currentCompany",
      "currentTitle",
      "location",
      "linkedinUrl",
      "revealedEmails",
      "revealedPhones",
      "decisionMakerScore",
      "championFit",
      "senioritySignals",
      "roleSignals",
      "matchedKeywords",
      "exactKeywordMatch",
      "suggestedAction",
      "suggestedMessage",
      "checkedAt"
    ];
    const rows = response.results.map((record) => [
      companyDomains.length > 1 ? `${companyDomains.length} target companies` : companyName,
      companyDomains.join("; "),
      record.personName,
      record.currentCompany,
      record.currentTitle,
      record.location,
      record.linkedinUrl,
      record.lushaContactId ? revealedContactDetails[record.lushaContactId]?.emails.join("; ") ?? "" : "",
      record.lushaContactId ? revealedContactDetails[record.lushaContactId]?.phones.join("; ") ?? "" : "",
      record.decisionMakerScore,
      record.championFit,
      record.senioritySignals.join("; "),
      record.roleSignals.join("; "),
      (record.matchedKeywords ?? []).join("; "),
      record.exactKeywordMatch ? "yes" : "no",
      record.suggestedAction,
      record.suggestedMessage,
      record.checkedAt
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `decision-makers-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const handleRevealedContactDetailsChange = useCallback((details: RevealedContactDetails) => {
    if (onSharedRevealedContactDetailsChange) {
      onSharedRevealedContactDetailsChange(details);
      return;
    }

    setLocalRevealedContactDetails((current) => ({
      ...current,
      [details.contactId]: details
    }));
  }, [onSharedRevealedContactDetailsChange]);
  const companyDomains = parseDomains(companyDomainsText);
  const titleKeywordCount = parseKeywords(customTitleKeywords).length;
  const summaryCards: Array<{ label: string; value: string | number }> = response
    ? [
      { label: "Contacts checked", value: response.summary.contactsChecked },
      response.summary.keywordMatches
        ? { label: "Keyword matches", value: response.summary.keywordMatches }
        : { label: "Decision makers found", value: response.summary.decisionMakersFound },
      { label: "High-fit contacts", value: response.summary.highConfidence },
      { label: "Medium-fit contacts", value: response.summary.mediumConfidence },
      { label: "Credits/API calls", value: `${response.summary.creditsUsed ?? 0} / ${response.summary.apiCallsUsed ?? 0}` }
    ]
    : [];

  return (
    <div className="grid gap-5">
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-slate-200/80 bg-white pb-5">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-primary/10 p-2 text-primary">
              <Target className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <CardTitle className="text-lg">Decision Maker Finder</CardTitle>
              <CardDescription className="mt-2">
                Find senior engineering contacts across one or more target companies who could influence or champion engineering software decisions.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <form className="grid gap-6" onSubmit={handleSubmit}>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Search up to 20 companies together and rank likely decision makers by seniority and engineering role. Keep the contact limit low while testing live Lusha searches.
            </div>

            <section className="grid gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">Target account</h3>
                <p className="mt-1 text-xs text-muted-foreground">Add up to 20 domains for one combined Decision Maker search.</p>
              </div>
            <div className="grid max-w-6xl gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="profileCompanyDomains">Target company domains</Label>
                  <span className={`text-xs font-medium ${companyDomains.length > 20 ? "text-red-600" : "text-muted-foreground"}`}>
                    {companyDomains.length}/20 added
                  </span>
                </div>
                <Textarea
                  id="profileCompanyDomains"
                  value={companyDomainsText}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    const nextDomains = parseDomains(nextValue);
                    setCompanyDomainsText(nextValue);
                    updateDraft({
                      companyDomain: nextDomains[0] ?? "",
                      companyDomains: nextDomains
                    });
                  }}
                  placeholder={"fairhurst.co.uk\nwsp.com\narcadis.com"}
                  className="min-h-28 resize-y text-base font-medium"
                />
                {companyDomains.length ? (
                  <div className="flex flex-wrap gap-1.5" aria-label="Target company domains">
                    {companyDomains.slice(0, 20).map((domain) => (
                      <span key={domain} className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                        {domain}
                      </span>
                    ))}
                  </div>
                ) : null}
                <p className="text-xs text-muted-foreground">One per line or comma-separated. URLs and duplicate domains are cleaned automatically.</p>
                {companyDomains.length > 20 ? (
                  <p className="text-xs font-medium text-red-600" role="alert">
                    Remove {companyDomains.length - 20} {companyDomains.length - 20 === 1 ? "domain" : "domains"} to continue.
                  </p>
                ) : null}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="profileCompanyName">Target company name, optional fallback</Label>
                <Input id="profileCompanyName" value={companyName} onChange={(event) => {
                  setCompanyName(event.target.value);
                  updateDraft({ companyName: event.target.value });
                }} placeholder="WSP" className="h-12" />
              </div>
            </div>
            </section>

            <section className="grid gap-4 border-t border-slate-200/80 pt-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">Search parameters</h3>
                <p className="mt-1 text-xs text-muted-foreground">Control target geography, discipline, and contact volume.</p>
              </div>
            <div className="grid max-w-6xl gap-4 lg:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="profileLocation">Location / city or country</Label>
                <Input id="profileLocation" value={location} onChange={(event) => {
                  setLocation(event.target.value);
                  updateDraft({ location: event.target.value });
                }} placeholder="United Kingdom, Dublin, or Dublin, Ireland" className="h-11" />
                <p className="text-xs text-muted-foreground">
                  Use a country, a city, or City, Country for narrower searches.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="profileDiscipline">Discipline</Label>
                <select id="profileDiscipline" value={discipline} onChange={(event) => {
                  const nextValue = event.target.value as ProfileMentionDiscipline;
                  setDiscipline(nextValue);
                  updateDraft({ discipline: nextValue });
                }} className="select-control">
                  {profileMentionDisciplineOptions.map((option) => (
                    <option key={option} value={option}>{profileMentionDisciplineLabels[option]}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="profileMaxContacts">Max contacts to check</Label>
                <select id="profileMaxContacts" value={maxContactsToCheck} onChange={(event) => {
                  const nextValue = Number(event.target.value) as ProfileMentionContactLimit;
                  setMaxContactsToCheck(nextValue);
                  updateDraft({ maxContactsToCheck: nextValue });
                }} className="select-control">
                  {profileMentionContactLimitOptions.map((limit) => (
                    <option key={limit} value={limit}>Check max {limit}</option>
                  ))}
                </select>
              </div>
            </div>
            </section>

            <section className="grid gap-4 border-t border-slate-200/80 pt-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">Advanced filters</h3>
                <p className="mt-1 text-xs text-muted-foreground">Refine decision-maker matching while keeping contact checks controlled.</p>
              </div>

              <div className="grid max-w-6xl gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
              <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" aria-hidden="true" />
                    <Label>Seniority</Label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {seniorityOptions.map((option) => (
                      <label key={option} className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition hover:border-slate-300">
                        <input type="checkbox" checked={seniority.includes(option)} onChange={() => toggleSeniority(option)} className="h-4 w-4 accent-primary" />
                        {option}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="profileTitleKeywords">Job title keywords</Label>
                  <Textarea
                    id="profileTitleKeywords"
                    value={customTitleKeywords}
                    onChange={(event) => setCustomTitleKeywords(event.target.value)}
                    onBlur={() => updateDraft({ customTitleKeywords: parseKeywords(customTitleKeywords) })}
                    placeholder={"Temporary Works Designer\nBridge Design Manager"}
                    className="min-h-24 rounded-xl border-slate-200 bg-white"
                  />
                  <p className="text-xs text-muted-foreground">
                    One per line or comma separated, up to {MAX_TITLE_KEYWORDS}. Keywords are OR&apos;d: a contact is kept if their title matches any one of them. Seniority below is used only to rank those matches.
                  </p>
                  {titleKeywordCount > MAX_TITLE_KEYWORDS ? (
                    <p className="text-xs font-medium text-red-600" role="alert">
                      Remove {titleKeywordCount - MAX_TITLE_KEYWORDS} {titleKeywordCount - MAX_TITLE_KEYWORDS === 1 ? "keyword" : "keywords"} to continue — {titleKeywordCount} entered.
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="profileKeywordMode">Keyword matching</Label>
                  <select
                    id="profileKeywordMode"
                    value={keywordMode}
                    disabled={!parseKeywords(customTitleKeywords).length}
                    onChange={(event) => {
                      const nextValue = event.target.value as KeywordMode;
                      setKeywordMode(nextValue);
                      updateDraft({ keywordMode: nextValue });
                    }}
                    className="select-control disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {keywordModeOptions.map((option) => (
                      <option key={option} value={option}>{keywordModeLabels[option]}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {parseKeywords(customTitleKeywords).length
                      ? keywordModeDescriptions[keywordMode]
                      : "Add a job title keyword above to enable keyword matching. With no keyword, the search ranks senior engineering titles as before."}
                  </p>
                </div>
              </div>

              <aside className="grid content-start gap-3">
                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-primary" aria-hidden="true" />
                    <p className="text-sm font-medium">Lusha API key</p>
                  </div>
                  <Input type="password" autoComplete="off" value={localLushaApiKey} onChange={(event) => {
                    setLocalLushaApiKey(event.target.value);
                    updateDraft({ localLushaApiKey: event.target.value });
                  }} placeholder="Paste key for this browser session" />
                </div>
              </aside>
              </div>
            </section>

            <div className="-mx-6 -mb-6 flex justify-start border-t border-slate-200/80 bg-slate-50/70 px-6 py-4">
              <Button
                type="submit"
                disabled={loading || companyDomains.length > 20 || titleKeywordCount > MAX_TITLE_KEYWORDS}
                className="h-11 w-full px-5 sm:w-fit"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                {loading ? "Finding decision makers..." : "Find decision makers"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {response ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {summaryCards.map(({ label, value }) => (
            <Card key={label} className="bg-white transition hover:border-slate-300 hover:shadow-subtle">
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4" aria-hidden="true" />
            <div>
              <p className="font-semibold">Decision-maker search error</p>
              <p>{error}</p>
            </div>
          </div>
        </div>
      ) : null}

      {response?.warnings.length ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Search notes</p>
          <ul className="mt-1 list-inside list-disc space-y-1">
            {response.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </div>
      ) : null}

      {response?.storage?.status === "saved" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <p className="font-semibold">Saved to Supabase</p>
          <p>{response.storage.id ? `Search run ID: ${response.storage.id}` : "Decision-maker search saved."}</p>
        </div>
      ) : null}

      {response?.storage?.status === "failed" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Search completed, but was not saved</p>
          <p>{response.storage.message || "Check Supabase environment variables and the search_runs table."}</p>
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-60 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-subtle">
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold">Finding senior engineering decision makers</p>
            <p className="mt-1 text-xs text-muted-foreground">The app is checking current contacts and ranking role fit.</p>
          </div>
        </div>
      ) : null}

      {response ? (
        <ProfileMidasMentionsTable
          results={response.results}
          revealedContactDetails={revealedContactDetails}
          onRevealedContactDetailsChange={handleRevealedContactDetailsChange}
          onExportCsv={exportCsv}
        />
      ) : null}
    </div>
  );
}
