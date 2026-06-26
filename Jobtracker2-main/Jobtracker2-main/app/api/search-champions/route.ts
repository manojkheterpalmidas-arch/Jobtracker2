import { NextResponse } from "next/server";
import { findMidasCompanyMatch } from "@/lib/companyMatching";
import { isValidDomain, normalizeDomain } from "@/lib/domain";
import { LushaApiError, searchJobChanges } from "@/lib/lusha";
import { listMidasAccounts } from "@/lib/midasAccounts";
import { scoreChampion } from "@/lib/championScoring";
import { storeSearchRun } from "@/lib/storage";
import { SearchRequestSchema, type ChampionContactJobChange } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeStrings<T>(value: T): T {
  if (typeof value === "string") {
    return value.replace(/[<>]/g, "").trim() as T;
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeStrings) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizeStrings(item)])
    ) as T;
  }

  return value;
}

export async function POST(request: Request) {
  try {
    const body = sanitizeStrings(await request.json());
    const parsed = SearchRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid champion search request.", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const companyDomain = parsed.data.companyDomain
      ? normalizeDomain(parsed.data.companyDomain)
      : "";

    if (companyDomain && !isValidDomain(companyDomain)) {
      return NextResponse.json(
        { error: "Invalid company domain. Enter a domain like wsp.com, without https:// or www." },
        { status: 400 }
      );
    }

    const searchRequest = {
      ...parsed.data,
      companyDomain,
      movementDirection: "joined" as const,
      normalizedDomain: companyDomain
    };
    const [jobChangeResponse, midasAccountsResponse] = await Promise.all([
      searchJobChanges(searchRequest),
      listMidasAccounts()
    ]);
    const accounts = midasAccountsResponse.accounts;
    const championResults = jobChangeResponse.results
      .map((record) => {
        const match = findMidasCompanyMatch(
          record.previousCompany,
          record.previousCompanyDomain,
          accounts
        );

        return scoreChampion(record, match);
      })
      .filter((record): record is ChampionContactJobChange => {
        if (parsed.data.onlyKnownMidasAccounts && !record.midasAccountMatched) {
          return Boolean(parsed.data.showUnknownPreviousCompanies);
        }

        if (!parsed.data.showUnknownPreviousCompanies && !record.midasAccountMatched) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (b.championLikelihoodScore !== a.championLikelihoodScore) {
          return b.championLikelihoodScore - a.championLikelihoodScore;
        }

        return b.signalDate.localeCompare(a.signalDate);
      });

    const response = {
      ...jobChangeResponse,
      results: championResults,
      summary: {
        ...jobChangeResponse.summary,
        jobChangesFound: championResults.length,
        highPriorityContacts: championResults.filter((record) => record.championPotential === "High").length,
        knownMidasAccounts: championResults.filter((record) => record.midasAccountMatched).length,
        highPotentialChampions: championResults.filter((record) => record.championPotential === "High").length,
        mediumPotentialChampions: championResults.filter((record) => record.championPotential === "Medium").length,
        unknownPreviousCompanies: championResults.filter((record) => !record.midasAccountMatched).length,
        midasDatabaseCompaniesCount: accounts.length
      },
      warnings: [
        ...jobChangeResponse.warnings,
        midasAccountsResponse.storage.status !== "supabase"
          ? "MIDAS account database is using in-memory seed data because Supabase is not configured or unavailable."
          : ""
      ].filter(Boolean)
    };
    const storage = await storeSearchRun(searchRequest, response);

    return NextResponse.json({
      ...response,
      storage
    });
  } catch (error) {
    if (error instanceof LushaApiError) {
      return NextResponse.json({ error: error.friendlyMessage }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Unexpected server error while searching MIDAS champion migrations." },
      { status: 500 }
    );
  }
}
