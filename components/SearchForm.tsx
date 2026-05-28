"use client";

import { FormEvent, useEffect, useState } from "react";
import { KeyRound, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  disciplineLabels,
  disciplineOptions,
  durationOptions,
  signalLookupLimitOptions,
  titleFilterModeLabels,
  titleFilterModeOptions,
  type Discipline,
  type DurationDays,
  type SearchRequest,
  type SignalLookupLimit,
  type TitleFilterMode
} from "@/lib/types";

type SearchFormProps = {
  loading: boolean;
  onSearch: (request: SearchRequest) => void;
  mode?: "champion" | "tracker";
  initialRequest?: Partial<SearchRequest> | null;
};

function parseKeywords(value: string) {
  return value
    .split(/[\n,]/)
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

const showManualApiKeyInput = true;

export function SearchForm({ loading, onSearch, mode = "tracker", initialRequest }: SearchFormProps) {
  const [companyDomain, setCompanyDomain] = useState("wsp.com");
  const [companyName, setCompanyName] = useState("WSP");
  const [location, setLocation] = useState("United Kingdom");
  const [durationDays, setDurationDays] = useState<DurationDays>(90);
  const [discipline, setDiscipline] = useState<Discipline>("structural_bridge");
  const [maxSignalLookups, setMaxSignalLookups] = useState<SignalLookupLimit>(25);
  const [titleFilterMode, setTitleFilterMode] = useState<TitleFilterMode>("defaults_plus_custom");
  const [boostMidasMentions, setBoostMidasMentions] = useState(true);
  const [onlyKnownMidasAccounts, setOnlyKnownMidasAccounts] = useState(true);
  const [showUnknownPreviousCompanies, setShowUnknownPreviousCompanies] = useState(false);
  const [customTitleKeywords, setCustomTitleKeywords] = useState("");
  const [localLushaApiKey, setLocalLushaApiKey] = useState("");

  useEffect(() => {
    if (showManualApiKeyInput) {
      setLocalLushaApiKey(window.sessionStorage.getItem("localLushaApiKey") ?? "");
    }
  }, []);

  useEffect(() => {
    if (!initialRequest) return;

    setCompanyDomain(initialRequest.companyDomain ?? "");
    setCompanyName(initialRequest.companyName ?? "");
    setLocation(initialRequest.location ?? "");
    setDurationDays(initialRequest.durationDays ?? 90);
    setDiscipline(initialRequest.discipline ?? "structural_bridge");
    setMaxSignalLookups(initialRequest.maxSignalLookups ?? 25);
    setTitleFilterMode(initialRequest.titleFilterMode ?? "defaults_plus_custom");
    setBoostMidasMentions(initialRequest.boostMidasMentions ?? true);
    setOnlyKnownMidasAccounts(initialRequest.onlyKnownMidasAccounts ?? true);
    setShowUnknownPreviousCompanies(initialRequest.showUnknownPreviousCompanies ?? false);
    setCustomTitleKeywords((initialRequest.customTitleKeywords ?? []).join("\n"));
  }, [initialRequest]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (showManualApiKeyInput) {
      window.sessionStorage.setItem("localLushaApiKey", localLushaApiKey);
    }

    onSearch({
      companyDomain,
      companyName,
      location,
      durationDays,
      discipline,
      movementDirection: "joined",
      maxSignalLookups,
      titleFilterMode,
      boostMidasMentions,
      onlyKnownMidasAccounts,
      showUnknownPreviousCompanies,
      customTitleKeywords: parseKeywords(customTitleKeywords),
      seniority: [],
      localLushaApiKey: showManualApiKeyInput ? localLushaApiKey : ""
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-5 w-5 text-primary" aria-hidden="true" />
          <CardTitle>Search criteria</CardTitle>
        </div>
        <CardDescription>
          Domain matching is used first. Company name is only a fallback or label.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="grid gap-2">
              <Label htmlFor="companyDomain">Company domain</Label>
              <Input
                id="companyDomain"
                placeholder="wsp.com"
                value={companyDomain}
                onChange={(event) => setCompanyDomain(event.target.value)}
                className="h-12 text-base font-medium"
              />
              <p className="text-xs text-muted-foreground">
                Recommended: use company domain for better matching, e.g. wsp.com
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="companyName">Company name, optional fallback</Label>
              <Input
                id="companyName"
                placeholder="WSP"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                className="h-12"
              />
              <p className="text-xs text-muted-foreground">
                Used as a display label or fallback if no domain is provided.
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="location">Location / country</Label>
              <Input
                id="location"
                placeholder="United Kingdom"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                className="h-11"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="durationDays">Past duration</Label>
              <select
                id="durationDays"
                value={durationDays}
                onChange={(event) => setDurationDays(Number(event.target.value) as DurationDays)}
                className="h-11 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {durationOptions.map((days) => (
                  <option key={days} value={days}>
                    {days === 365 ? "1 year" : days === 730 ? "2 years" : `${days} days`}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="discipline">Discipline</Label>
              <select
                id="discipline"
                value={discipline}
                onChange={(event) => setDiscipline(event.target.value as Discipline)}
                className="h-11 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {disciplineOptions.map((option) => (
                  <option key={option} value={option}>
                    {disciplineLabels[option]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {mode === "champion" ? (
            <div className="grid gap-3 rounded-lg border bg-emerald-50/50 p-4">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={onlyKnownMidasAccounts}
                  onChange={(event) => setOnlyKnownMidasAccounts(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-primary"
                />
                <span>
                  <span className="block font-medium">Only show people from known MIDAS accounts</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    Default on. Results are filtered to people whose previous company matches the MIDAS Account Database.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={showUnknownPreviousCompanies}
                  onChange={(event) => setShowUnknownPreviousCompanies(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-primary"
                />
                <span>
                  <span className="block font-medium">Show unknown previous companies too</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    Useful for audit checks, but it can add low-confidence rows to the table.
                  </span>
                </span>
              </label>
            </div>
          ) : null}

          <div className="grid items-start gap-5 border-t pt-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="grid gap-3 self-start">
              <div className="grid gap-3 sm:grid-cols-[1fr_260px] sm:items-start">
                <div>
                  <Label htmlFor="customTitleKeywords">Custom title keywords</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Leave blank for defaults. Use no title filter if Lusha stores titles differently.
                  </p>
                </div>
                <select
                  id="titleFilterMode"
                  value={titleFilterMode}
                  onChange={(event) => setTitleFilterMode(event.target.value as TitleFilterMode)}
                  className="h-11 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:mt-0"
                >
                  {titleFilterModeOptions.map((option) => (
                    <option key={option} value={option}>
                      {titleFilterModeLabels[option]}
                    </option>
                  ))}
                </select>
              </div>
              <Textarea
                id="customTitleKeywords"
                placeholder="One per line or comma separated"
                value={customTitleKeywords}
                onChange={(event) => setCustomTitleKeywords(event.target.value)}
                className="min-h-32"
              />
            </div>

            <aside className="grid gap-4">
              <div className="grid gap-3 rounded-lg border bg-background p-4">
                <label className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={boostMidasMentions}
                    onChange={(event) => setBoostMidasMentions(event.target.checked)}
                    className="mt-1 h-4 w-4 accent-primary"
                  />
                  <span>
                    <span className="block font-medium">Boost MIDAS mentions</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      Adds relevance points when Lusha profile fields mention MIDAS skills or tools.
                    </span>
                  </span>
                </label>
              </div>

              <div className="grid gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div>
                  <Label htmlFor="maxSignalLookups">Credit guard</Label>
                  <p className="mt-1 text-xs leading-5 text-amber-900">
                    Keep this low while testing live Lusha searches.
                  </p>
                </div>
                <select
                  id="maxSignalLookups"
                  value={maxSignalLookups}
                  onChange={(event) => setMaxSignalLookups(Number(event.target.value) as SignalLookupLimit)}
                  className="h-11 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {signalLookupLimitOptions.map((limit) => (
                    <option key={limit} value={limit}>
                      Check max {limit}
                    </option>
                  ))}
                </select>
              </div>

              {showManualApiKeyInput ? (
                <div className="grid gap-3 rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-primary" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-medium">Lusha API key</p>
                      <p className="text-xs text-muted-foreground">
                        Used for this browser session only. Not stored by the app.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="localLushaApiKey">Lusha API key</Label>
                    <Input
                      id="localLushaApiKey"
                      type="password"
                      autoComplete="off"
                      placeholder="Paste key for local testing"
                      value={localLushaApiKey}
                      onChange={(event) => setLocalLushaApiKey(event.target.value)}
                    />
                  </div>
                </div>
              ) : null}
            </aside>
          </div>

          <div className="flex justify-start border-t pt-5">
            <Button type="submit" disabled={loading} className="w-full sm:w-fit">
              <Search className="h-4 w-4" aria-hidden="true" />
              {loading ? "Searching Lusha signals..." : mode === "champion" ? "Find MIDAS champions" : "Find job changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
