"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AlertTriangle, KeyRound, Loader2, Search, Target, Users } from "lucide-react";
import {
  profileMentionContactLimitOptions,
  profileMentionDisciplineLabels,
  profileMentionDisciplineOptions,
  type ProfileMentionContactLimit,
  type ProfileMentionDiscipline,
  type ProfileMidasMentionRequest,
  type ProfileMidasMentionResponse,
  type RevealedContactDetails,
  type SearchRequest
} from "@/lib/types";
import { ProfileMidasMentionsTable } from "@/components/ProfileMidasMentionsTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const seniorityOptions = ["Engineer", "Senior", "Principal", "Associate", "Director", "Technical Director", "Head"];

function parseKeywords(value: string) {
  return value
    .split(/[\n,]/)
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

function csvValue(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

type ProfileMidasMentionsPageProps = {
  initialResponse?: ProfileMidasMentionResponse | null;
  initialRequest?: DecisionMakerDraft | null;
  onDraftChange?: (request: DecisionMakerDraft) => void;
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

export function ProfileMidasMentionsPage({ initialResponse, initialRequest, onDraftChange }: ProfileMidasMentionsPageProps) {
  const [companyDomain, setCompanyDomain] = useState("wsp.com");
  const [companyName, setCompanyName] = useState("WSP");
  const [location, setLocation] = useState("United Kingdom");
  const [discipline, setDiscipline] = useState<ProfileMentionDiscipline>("structural_bridge");
  const [seniority, setSeniority] = useState<string[]>(["Principal", "Associate", "Director", "Technical Director", "Head"]);
  const [maxContactsToCheck, setMaxContactsToCheck] = useState<ProfileMentionContactLimit>(25);
  const [customTitleKeywords, setCustomTitleKeywords] = useState("");
  const [localLushaApiKey, setLocalLushaApiKey] = useState("");
  const [response, setResponse] = useState<ProfileMidasMentionResponse | null>(null);
  const [revealedContactDetails, setRevealedContactDetails] = useState<Record<string, RevealedContactDetails>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLocalLushaApiKey(window.sessionStorage.getItem("localLushaApiKey") ?? "");
  }, []);

  useEffect(() => {
    if (initialResponse) {
      setResponse(initialResponse);
      setRevealedContactDetails({});
    }
  }, [initialResponse]);

  useEffect(() => {
    if (!initialRequest) return;

    setCompanyDomain(initialRequest.companyDomain ?? companyDomain);
    setCompanyName(initialRequest.companyName ?? companyName);
    setLocation(initialRequest.location ?? location);
    setDiscipline(toProfileDiscipline(initialRequest.discipline));
    setSeniority(initialRequest.seniority ?? seniority);
    setMaxContactsToCheck(initialRequest.maxContactsToCheck ?? maxContactsToCheck);
    setCustomTitleKeywords((initialRequest.customTitleKeywords ?? []).join("\n"));
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
    setRevealedContactDetails({});
    window.sessionStorage.setItem("localLushaApiKey", localLushaApiKey);

    const payload: ProfileMidasMentionRequest = {
      companyDomain,
      companyName,
      location,
      discipline,
      customTitleKeywords: parseKeywords(customTitleKeywords),
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
      "targetDomain",
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
      "suggestedAction",
      "suggestedMessage",
      "checkedAt"
    ];
    const rows = response.results.map((record) => [
      companyName,
      companyDomain,
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
    setRevealedContactDetails((current) => ({
      ...current,
      [details.contactId]: details
    }));
  }, []);

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
                Find senior engineering contacts at the target company who could influence or champion engineering software decisions.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <form className="grid gap-6" onSubmit={handleSubmit}>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              This searches current contacts at the target company and ranks likely decision makers by seniority and engineering role. Keep the contact limit low while testing live Lusha searches.
            </div>

            <section className="grid gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">Target account</h3>
                <p className="mt-1 text-xs text-muted-foreground">Company domain is preferred; name is used as display/fallback context.</p>
              </div>
            <div className="grid max-w-6xl gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="grid gap-2">
                <Label htmlFor="profileCompanyDomain">Target company domain</Label>
                <Input id="profileCompanyDomain" value={companyDomain} onChange={(event) => {
                  setCompanyDomain(event.target.value);
                  updateDraft({ companyDomain: event.target.value });
                }} placeholder="wsp.com" className="h-12 text-base font-medium" />
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
                  <Label htmlFor="profileTitleKeywords">Additional title keywords</Label>
                  <Textarea id="profileTitleKeywords" value={customTitleKeywords} onChange={(event) => {
                    setCustomTitleKeywords(event.target.value);
                    updateDraft({ customTitleKeywords: parseKeywords(event.target.value) });
                  }} placeholder="One per line or comma separated" className="min-h-24 rounded-xl border-slate-200 bg-white" />
                  <p className="text-xs text-muted-foreground">
                    Add titles like Managing Director, Founder, Owner, Partner, Discipline Lead, or Regional Director if needed.
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
              <Button type="submit" disabled={loading} className="h-11 w-full px-5 sm:w-fit">
                <Search className="h-4 w-4" aria-hidden="true" />
                {loading ? "Finding decision makers..." : "Find decision makers"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {response ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["Contacts checked", response.summary.contactsChecked],
            ["Decision makers found", response.summary.decisionMakersFound],
            ["High-fit contacts", response.summary.highConfidence],
            ["Medium-fit contacts", response.summary.mediumConfidence],
            ["Credits/API calls", `${response.summary.creditsUsed ?? 0} / ${response.summary.apiCallsUsed ?? 0}`]
          ].map(([label, value]) => (
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
