import { NextResponse } from "next/server";
import { isValidDomain, parseDomains } from "@/lib/domain";
import { LushaApiError, searchJobChanges } from "@/lib/lusha";
import { storeSearchRun } from "@/lib/storage";
import { SearchRequestSchema } from "@/lib/types";

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
        {
          error: "Invalid search request.",
          details: parsed.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }

    const companyDomains = parseDomains([
      ...(parsed.data.companyDomains ?? []),
      parsed.data.companyDomain ?? ""
    ]);
    const invalidDomains = companyDomains.filter((domain) => !isValidDomain(domain));

    if (invalidDomains.length) {
      return NextResponse.json(
        {
          error: `Invalid company ${invalidDomains.length === 1 ? "domain" : "domains"}: ${invalidDomains.join(", ")}. Enter domains like wsp.com.`
        },
        { status: 400 }
      );
    }

    // Rate limiting placeholder: add a Vercel KV/Upstash counter keyed by user,
    // workspace, or IP before exposing this route broadly.
    const searchRequest = {
      ...parsed.data,
      companyDomain: companyDomains[0] ?? "",
      companyDomains,
      normalizedDomain: companyDomains[0] ?? "",
      normalizedDomains: companyDomains
    };
    const response = await searchJobChanges(searchRequest);
    const storage = await storeSearchRun(searchRequest, response);

    return NextResponse.json({
      ...response,
      storage
    });
  } catch (error) {
    if (error instanceof LushaApiError) {
      return NextResponse.json(
        {
          error: error.friendlyMessage
        },
        { status: error.status }
      );
    }

    return NextResponse.json(
      {
        error: "Unexpected server error while searching job-change signals."
      },
      { status: 500 }
    );
  }
}
