import { NextResponse } from "next/server";
import { isValidDomain, normalizeDomain } from "@/lib/domain";
import { findProfileMidasMentions, LushaApiError } from "@/lib/lusha";
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
        { error: "Invalid profile MIDAS mention request.", details: parsed.error.flatten().fieldErrors },
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

    const response = await findProfileMidasMentions({
      ...parsed.data,
      companyDomain,
      normalizedDomain: companyDomain
    });

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof LushaApiError) {
      return NextResponse.json({ error: error.friendlyMessage }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Unexpected server error while checking profile MIDAS mentions." },
      { status: 500 }
    );
  }
}
