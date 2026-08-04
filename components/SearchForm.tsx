"use client";

import { FormEvent, useEffect, useState } from "react";
import { Building2, Filter, Gauge, KeyRound, MapPinned, Search, ShieldCheck, SlidersHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseDomains } from "@/lib/domain";
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
  initialRequest?: SearchFormDraft | null;
  onDraftChange?: (request: SearchFormDraft) => void;
};

type SearchFormDraft = Omit<Partial<SearchRequest>, "discipline"> & { discipline?: string };

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

const showManualApiKeyInput = true;

function toSearchDiscipline(value?: string): Discipline {
  if (value === "geotechnical" || value === "transport_highways" || value === "rail_structures" || value === "custom" || value === "structural_bridge") {
    return value;
  }
  if (value === "civil_engineering" || value === "all_engineering") {
    return "structural_bridge";
  }
  return "structural_bridge";
}

export function SearchForm({ loading, onSearch, initialRequest, onDraftChange }: SearchFormProps) {
  const [companyDomainsText, setCompanyDomainsText] = useState("wsp.com");
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

    const incomingDomains = initialRequest.companyDomains?.length
      ? initialRequest.companyDomains
      : initialRequest.companyDomain
        ? [initialRequest.companyDomain]
        : [];
    setCompanyDomainsText(incomingDomains.join("\n"));
    setCompanyName(initialRequest.companyName ?? companyName);
    setLocation(initialRequest.location ?? location);
    setDurationDays(initialRequest.durationDays ?? 90);
    setDiscipline(toSearchDiscipline(initialRequest.discipline));
    setMaxSignalLookups(initialRequest.maxSignalLookups ?? 25);
    setTitleFilterMode(initialRequest.titleFilterMode ?? "defaults_plus_custom");
    setBoostMidasMentions(initialRequest.boostMidasMentions ?? true);
    setOnlyKnownMidasAccounts(initialRequest.onlyKnownMidasAccounts ?? true);
    setShowUnknownPreviousCompanies(initialRequest.showUnknownPreviousCompanies ?? false);
    const incomingTitleKeywords = initialRequest.customTitleKeywords ?? [];
    setCustomTitleKeywords((current) => (
      hasSameKeywords(current, incomingTitleKeywords) ? current : incomingTitleKeywords.join("\n")
    ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRequest]);

  function updateDraft(patch: Partial<SearchRequest>) {
    onDraftChange?.(patch);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (showManualApiKeyInput) {
      window.sessionStorage.setItem("localLushaApiKey", localLushaApiKey);
    }

    const companyDomains = parseDomains(companyDomainsText);

    onSearch({
      companyDomain: companyDomains[0] ?? "",
      companyDomains,
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

  const companyDomains = parseDomains(companyDomainsText);

  return (
    <Card className="overflow-hidden border-slate-200/90 bg-white shadow-panel">
      <CardHeader className="border-b border-slate-200/80 bg-white px-5 py-5 sm:px-6">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-primary">
              <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Champion search</p>
              <CardTitle className="mt-1 text-lg">Search criteria</CardTitle>
              <CardDescription className="mt-2">
                Search one company or several at once. Domain matching is used first.
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">Domain-first</span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">Lusha signals</span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">MIDAS matching</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <form onSubmit={handleSubmit}>
          <div className="grid min-w-0 gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_390px]">
            <div className="grid min-w-0 content-start gap-5">
              <section className="grid min-w-0 gap-4 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="rounded-lg bg-white p-2 text-primary shadow-sm">
                    <Building2 className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-950">Target account</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Add up to 20 company domains for one combined search.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="companyDomains">Company domains</Label>
                      <span className={`text-xs font-medium ${companyDomains.length > 20 ? "text-red-600" : "text-muted-foreground"}`}>
                        {companyDomains.length}/20 added
                      </span>
                    </div>
                    <Textarea
                      id="companyDomains"
                      placeholder={"wsp.com\narcadis.com\nmottmac.com"}
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
                      className="min-h-28 resize-y text-base font-semibold"
                    />
                    {companyDomains.length ? (
                      <div className="flex flex-wrap gap-1.5" aria-label="Target company domains">
                        {companyDomains.slice(0, 20).map((domain) => (
                          <span
                            key={domain}
                            className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800"
                          >
                            {domain}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      One per line or comma-separated. URLs and duplicate domains are cleaned automatically.
                    </p>
                    {companyDomains.length > 20 ? (
                      <p className="text-xs font-medium text-red-600" role="alert">
                        Remove {companyDomains.length - 20} {companyDomains.length - 20 === 1 ? "domain" : "domains"} to continue.
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="companyName">Company name, optional fallback</Label>
                    <Input
                      id="companyName"
                      placeholder="WSP"
                      value={companyName}
                      onChange={(event) => {
                        setCompanyName(event.target.value);
                        updateDraft({ companyName: event.target.value });
                      }}
                      className="h-12"
                    />
                    <p className="text-xs text-muted-foreground">
                      Used only when no domain is entered, or as a display label for a single company.
                    </p>
                  </div>
                </div>
              </section>

              <section className="grid min-w-0 gap-4 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="rounded-lg bg-slate-100 p-2 text-primary">
                    <MapPinned className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-950">Search parameters</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Control the geography, time window, and engineering discipline.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="grid gap-2">
                    <Label htmlFor="location">Location / city / country</Label>
                    <Input
                      id="location"
                      placeholder="United Kingdom, Dublin, or Dublin, Ireland"
                      value={location}
                      onChange={(event) => {
                        setLocation(event.target.value);
                        updateDraft({ location: event.target.value });
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Use a country, city, or City, Country.
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="durationDays">Past duration</Label>
                    <select
                      id="durationDays"
                      value={durationDays}
                      onChange={(event) => {
                        const nextValue = Number(event.target.value) as DurationDays;
                        setDurationDays(nextValue);
                        updateDraft({ durationDays: nextValue });
                      }}
                      className="select-control"
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
                      onChange={(event) => {
                        const nextValue = event.target.value as Discipline;
                        setDiscipline(nextValue);
                        updateDraft({ discipline: nextValue });
                      }}
                      className="select-control"
                    >
                      {disciplineOptions.map((option) => (
                        <option key={option} value={option}>
                          {disciplineLabels[option]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              <section className="grid min-w-0 gap-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-950">Search scope</h3>
                    <p className="mt-1 text-xs leading-5 text-emerald-900/80">
                      Choose how tightly results should map to known MIDAS accounts.
                    </p>
                  </div>
                </div>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-emerald-200/80 bg-white p-3 text-sm shadow-sm transition hover:border-emerald-300 hover:shadow-subtle">
                  <input
                    type="checkbox"
                    checked={onlyKnownMidasAccounts}
                    onChange={(event) => {
                      setOnlyKnownMidasAccounts(event.target.checked);
                      updateDraft({ onlyKnownMidasAccounts: event.target.checked });
                    }}
                    className="mt-1 h-4 w-4 accent-primary"
                  />
                  <span>
                    <span className="block font-semibold text-slate-900">Only show people from known MIDAS accounts</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      Default on. Turn this off and enable unknown companies below to use this as a broader job-change tracker.
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-emerald-200/80 bg-white p-3 text-sm shadow-sm transition hover:border-emerald-300 hover:shadow-subtle">
                  <input
                    type="checkbox"
                    checked={showUnknownPreviousCompanies}
                    onChange={(event) => {
                      setShowUnknownPreviousCompanies(event.target.checked);
                      updateDraft({ showUnknownPreviousCompanies: event.target.checked });
                    }}
                    className="mt-1 h-4 w-4 accent-primary"
                  />
                  <span>
                    <span className="block font-semibold text-slate-900">Show all job changes, including unknown previous companies</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      Useful for a general job-change search. MIDAS matches will still be highlighted where found.
                    </span>
                  </span>
                </label>
              </section>
            </div>

            <aside className="grid min-w-0 content-start gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="rounded-lg bg-white p-2 text-primary shadow-sm">
                  <Filter className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-950">Advanced filters</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Refine title matching, MIDAS boost, and credit controls without changing the account search logic.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid gap-2">
                  <Label htmlFor="customTitleKeywords">Custom title keywords</Label>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Leave blank for defaults. Use no title filter if Lusha stores titles differently.
                  </p>
                  <Textarea
                    id="customTitleKeywords"
                    placeholder="One per line or comma separated"
                    value={customTitleKeywords}
                    onChange={(event) => setCustomTitleKeywords(event.target.value)}
                    onBlur={() => updateDraft({ customTitleKeywords: parseKeywords(customTitleKeywords) })}
                    className="min-h-28"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="titleFilterMode">Keyword mode</Label>
                  <select
                    id="titleFilterMode"
                    value={titleFilterMode}
                    onChange={(event) => {
                      const nextValue = event.target.value as TitleFilterMode;
                      setTitleFilterMode(nextValue);
                      updateDraft({ titleFilterMode: nextValue });
                    }}
                    className="select-control"
                  >
                    {titleFilterModeOptions.map((option) => (
                      <option key={option} value={option}>
                        {titleFilterModeLabels[option]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm transition hover:border-emerald-200 hover:shadow-subtle">
                <input
                  type="checkbox"
                  checked={boostMidasMentions}
                  onChange={(event) => {
                    setBoostMidasMentions(event.target.checked);
                    updateDraft({ boostMidasMentions: event.target.checked });
                  }}
                  className="mt-1 h-4 w-4 accent-primary"
                />
                <span>
                  <span className="flex items-center gap-2 font-semibold text-slate-900">
                    <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
                    Boost MIDAS mentions
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    Adds relevance points when Lusha profile fields mention MIDAS skills or tools.
                  </span>
                </span>
              </label>

              <div className="grid gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Gauge className="h-4 w-4 text-amber-800" aria-hidden="true" />
                      <Label htmlFor="maxSignalLookups">Credit guard</Label>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-amber-900">
                      Keep this low while testing live Lusha searches.
                    </p>
                  </div>
                  <select
                    id="maxSignalLookups"
                    value={maxSignalLookups}
                    onChange={(event) => {
                      const nextValue = Number(event.target.value) as SignalLookupLimit;
                      setMaxSignalLookups(nextValue);
                      updateDraft({ maxSignalLookups: nextValue });
                    }}
                    className="h-10 min-w-32 rounded-xl border border-amber-200 bg-white px-3 text-sm font-medium outline-none transition-all hover:border-amber-300 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/20"
                  >
                    {signalLookupLimitOptions.map((limit) => (
                      <option key={limit} value={limit}>
                        Check max {limit}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {showManualApiKeyInput ? (
                <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-primary" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Lusha API key</p>
                      <p className="text-xs leading-5 text-muted-foreground">
                        Used for this browser session only. Not stored by the app.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="localLushaApiKey">Testing key</Label>
                    <Input
                      id="localLushaApiKey"
                      type="password"
                      autoComplete="off"
                      placeholder="Paste key for local testing"
                      value={localLushaApiKey}
                      onChange={(event) => {
                        setLocalLushaApiKey(event.target.value);
                        updateDraft({ localLushaApiKey: event.target.value });
                      }}
                    />
                  </div>
                </div>
              ) : null}
            </aside>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200/80 bg-slate-50/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-xs font-medium text-muted-foreground">
              {companyDomains.length > 1
                ? `Searching ${companyDomains.length} companies together with domain-first matching.`
                : "Uses domain-first search, Lusha signals, and MIDAS account matching."}
            </p>
            <Button type="submit" disabled={loading || companyDomains.length > 20} className="h-11 w-full px-5 sm:w-fit">
              <Search className="h-4 w-4" aria-hidden="true" />
              {loading ? "Searching Lusha signals..." : "Find job changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
