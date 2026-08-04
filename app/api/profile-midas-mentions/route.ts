import { NextResponse } from "next/server";
import { isValidDomain, parseDomains } from "@/lib/domain";
import { findProfileMidasMentions, LushaApiError } from "@/lib/lusha";
import { storeGenericSearchRun } from "@/lib/storage";
import { ProfileMidasMentionRequestSchema } from "@/lib/types";

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
    const parsed = ProfileMidasMentionRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid decision-maker search request.", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const companyDomains = parseDomains([
      ...(parsed.data.companyDomains ?? []),
      ...(parsed.data.companyDomain ? [parsed.data.companyDomain] : [])
    ]);
    const invalidDomains = companyDomains.filter((domain) => !isValidDomain(domain));

    if (invalidDomains.length) {
      return NextResponse.json(
        { error: `Invalid company ${invalidDomains.length === 1 ? "domain" : "domains"}: ${invalidDomains.join(", ")}.` },
        { status: 400 }
      );
    }

    const searchRequest = {
      ...parsed.data,
      companyDomain: companyDomains[0] ?? "",
      companyDomains,
      normalizedDomain: companyDomains[0] ?? "",
      normalizedDomains: companyDomains
    };
    const response = await findProfileMidasMentions(searchRequest);
    const storage = await storeGenericSearchRun({
      searchType: "profile_midas_mentions",
      request: searchRequest,
      summary: response.summary,
      warnings: response.warnings,
      results: response.results,
      companyDomain: companyDomains[0] ?? "",
      companyName: parsed.data.companyName || undefined,
      location: parsed.data.location || undefined,
      discipline: parsed.data.discipline,
      maxSignalLookups: parsed.data.maxContactsToCheck,
      mockMode: response.summary.mockMode,
      totalContactsFound: response.summary.contactsChecked,
      jobChangesFound: response.summary.decisionMakersFound,
      highPriorityContacts: response.summary.highConfidence,
      creditsUsed: response.summary.creditsUsed,
      apiCallsUsed: response.summary.apiCallsUsed,
      signalLookupsRequested: response.summary.contactsChecked
    });

    return NextResponse.json({
      ...response,
      storage
    });
  } catch (error) {
    if (error instanceof LushaApiError) {
      return NextResponse.json({ error: error.friendlyMessage }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Unexpected server error while finding decision makers." },
      { status: 500 }
    );
  }
}
