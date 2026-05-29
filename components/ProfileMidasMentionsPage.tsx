"use client";

import { FormEvent, useEffect, useState } from "react";
import { AlertTriangle, KeyRound, Search } from "lucide-react";
import { defaultMidasKeywords } from "@/lib/midasKeywords";
import {
  midasKeywordModeOptions,
  profileMentionContactLimitOptions,
  profileMentionDisciplineLabels,
  profileMentionDisciplineOptions,
  type MidasKeywordMode,
  type ProfileMentionContactLimit,
  type ProfileMentionDiscipline,
  type ProfileMidasMentionRequest,
  type ProfileMidasMentionResponse
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
};

export function ProfileMidasMentionsPage({ initialResponse }: ProfileMidasMentionsPageProps) {
  const [companyDomain, setCompanyDomain] = useState("wsp.com");
  const [companyName, setCompanyName] = useState("WSP");
  const [location, setLocation] = useState("United Kingdom");
  const [discipline, setDiscipline] = useState<ProfileMentionDiscipline>("structural_bridge");
  const [seniority, setSeniority] = useState<string[]>([]);
  const [maxContactsToCheck, setMaxContactsToCheck] = useState<ProfileMentionContactLimit>(25);
  const [keywordMode, setKeywordMode] = useState<MidasKeywordMode>("default");
  const [customTitleKeywords, setCustomTitleKeywords] = useState("");
  const [customMidasKeywords, setCustomMidasKeywords] = useState("");
  const [localLushaApiKey, setLocalLushaApiKey] = useState("");
  const [response, setResponse] = useState<ProfileMidasMentionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLocalLushaApiKey(window.sessionStorage.getItem("localLushaApiKey") ?? "");
  }, []);

  useEffect(() => {
    if (initialResponse) {
      setResponse(initialResponse);
    }
  }, [initialResponse]);

  function toggleSeniority(value: string) {
    setSeniority((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    window.sessionStorage.setItem("localLushaApiKey", localLushaApiKey);

    const payload: ProfileMidasMentionRequest = {
      companyDomain,
      companyName,
      location,
      discipline,
      customTitleKeywords: parseKeywords(customTitleKeywords),
      seniority,
      maxContactsToCheck,
      keywordMode,
      customMidasKeywords: parseKeywords(customMidasKeywords),
      localLushaApiKey
    };

    try {
      const result = await fetch("/api/profile-midas-mentions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await result.json();

      if (!result.ok) throw new Error(data.error || "Profile MIDAS mention search failed.");

      setResponse(data);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Profile MIDAS mention search failed.");
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
      "hasMidasMention",
      "matchedKeywords",
      "evidenceFields",
      "evidenceSnippets",
      "midasMentionScore",
      "confidence",
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
      record.hasMidasMention,
      record.matchedKeywords.join("; "),
      record.evidenceFields.join("; "),
      record.evidenceSnippets.join("; "),
      record.midasMentionScore,
      record.confidence,
      record.suggestedAction,
      record.suggestedMessage,
      record.checkedAt
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `profile-midas-mentions-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Profile MIDAS Mentions</CardTitle>
          <CardDescription>
            Find current target-company contacts whose available Lusha profile fields directly mention MIDAS products or MIDAS skills.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-5" onSubmit={handleSubmit}>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Checking profile mentions may require enrichment and can consume more Lusha credits. LinkedIn Skills are not always returned by Lusha.
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="grid gap-2">
                <Label htmlFor="profileCompanyDomain">Target company domain</Label>
                <Input id="profileCompanyDomain" value={companyDomain} onChange={(event) => setCompanyDomain(event.target.value)} placeholder="wsp.com" className="h-12 text-base font-medium" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="profileCompanyName">Target company name, optional fallback</Label>
                <Input id="profileCompanyName" value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="WSP" className="h-12" />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="profileLocation">Location / country</Label>
                <Input id="profileLocation" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="United Kingdom" className="h-11" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="profileDiscipline">Discipline</Label>
                <select id="profileDiscipline" value={discipline} onChange={(event) => setDiscipline(event.target.value as ProfileMentionDiscipline)} className="h-11 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {profileMentionDisciplineOptions.map((option) => (
                    <option key={option} value={option}>{profileMentionDisciplineLabels[option]}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="profileMaxContacts">Max contacts to check</Label>
                <select id="profileMaxContacts" value={maxContactsToCheck} onChange={(event) => setMaxContactsToCheck(Number(event.target.value) as ProfileMentionContactLimit)} className="h-11 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {profileMentionContactLimitOptions.map((limit) => (
                    <option key={limit} value={limit}>Check max {limit}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Seniority</Label>
                  <div className="flex flex-wrap gap-2">
                    {seniorityOptions.map((option) => (
                      <label key={option} className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                        <input type="checkbox" checked={seniority.includes(option)} onChange={() => toggleSeniority(option)} className="h-4 w-4 accent-primary" />
                        {option}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="profileTitleKeywords">Custom title keywords</Label>
                  <Textarea id="profileTitleKeywords" value={customTitleKeywords} onChange={(event) => setCustomTitleKeywords(event.target.value)} placeholder="One per line or comma separated" className="min-h-24" />
                  <p className="text-xs text-muted-foreground">
                    For small companies, add titles like Managing Director, Founder, Owner, or Partner if needed.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="profileMidasKeywords">Custom MIDAS keywords</Label>
                  <Textarea id="profileMidasKeywords" value={customMidasKeywords} onChange={(event) => setCustomMidasKeywords(event.target.value)} placeholder="One per line or comma separated" className="min-h-24" />
                </div>
              </div>

              <aside className="grid content-start gap-4">
                <div className="grid gap-2 rounded-lg border bg-background p-4">
                  <Label htmlFor="keywordMode">MIDAS keyword set</Label>
                  <select id="keywordMode" value={keywordMode} onChange={(event) => setKeywordMode(event.target.value as MidasKeywordMode)} className="h-11 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {midasKeywordModeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option === "default" ? "Default MIDAS keywords" : option === "custom" ? "Custom keywords" : "Default + custom keywords"}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">{defaultMidasKeywords.length} direct MIDAS keywords in the default set.</p>
                </div>
                <div className="grid gap-3 rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-primary" aria-hidden="true" />
                    <p className="text-sm font-medium">Lusha API key</p>
                  </div>
                  <Input type="password" autoComplete="off" value={localLushaApiKey} onChange={(event) => setLocalLushaApiKey(event.target.value)} placeholder="Paste key for this browser session" />
                </div>
              </aside>
            </div>

            <div className="flex justify-start border-t pt-5">
              <Button type="submit" disabled={loading} className="w-full sm:w-fit">
                <Search className="h-4 w-4" aria-hidden="true" />
                {loading ? "Checking profile mentions..." : "Detect MIDAS mentions"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Contacts checked", response?.summary.contactsChecked ?? 0],
          ["MIDAS mentions found", response?.summary.mentionsFound ?? 0],
          ["High-confidence contacts", response?.summary.highConfidence ?? 0],
          ["Medium-confidence contacts", response?.summary.mediumConfidence ?? 0],
          ["Credits/API calls", `${response?.summary.creditsUsed ?? 0} / ${response?.summary.apiCallsUsed ?? 0}`]
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-2 text-2xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4" aria-hidden="true" />
            <div>
              <p className="font-semibold">Profile mention search error</p>
              <p>{error}</p>
            </div>
          </div>
        </div>
      ) : null}

      {response?.warnings.length ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Search notes</p>
          <ul className="mt-1 list-inside list-disc space-y-1">
            {response.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </div>
      ) : null}

      {response?.storage?.status === "saved" ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <p className="font-semibold">Saved to Supabase</p>
          <p>{response.storage.id ? `Search run ID: ${response.storage.id}` : "Profile mention run saved."}</p>
        </div>
      ) : null}

      {response?.storage?.status === "failed" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Search completed, but was not saved</p>
          <p>{response.storage.message || "Check Supabase environment variables and the search_runs table."}</p>
        </div>
      ) : null}

      {response ? (
        <ProfileMidasMentionsTable results={response.results} onExportCsv={exportCsv} />
      ) : null}
    </div>
  );
}
