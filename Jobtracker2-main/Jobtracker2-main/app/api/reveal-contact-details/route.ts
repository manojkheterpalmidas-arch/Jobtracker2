import { NextResponse } from "next/server";
import { z } from "zod";
import { LushaApiError, revealContactDetails } from "@/lib/lusha";
import { getStoredRevealedContactDetails, storeRevealedContactDetails } from "@/lib/storage";
import type { ContactRevealField, RevealedContactDetails } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RevealContactDetailsSchema = z.object({
  contactId: z.string().trim().min(1).max(160),
  reveal: z.array(z.enum(["emails", "phones"])).min(1).max(2),
  localLushaApiKey: z.string().trim().max(300).optional().or(z.literal(""))
});

const ContactIdSchema = z.string().trim().min(1).max(160);

function hasStoredField(details: RevealedContactDetails | undefined, field: ContactRevealField) {
  if (!details) return false;
  if (details.revealedFields?.includes(field)) return true;
  if (field === "emails" && details.emails.length > 0) return true;
  if (field === "phones" && details.phones.length > 0) return true;
  return false;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = ContactIdSchema.safeParse(url.searchParams.get("contactId") ?? "");

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid contact ID." },
      { status: 400 }
    );
  }

  const details = await getStoredRevealedContactDetails(parsed.data);

  return NextResponse.json({ details: details ?? null });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = RevealContactDetailsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid reveal request.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const storedDetails = await getStoredRevealedContactDetails(parsed.data.contactId);
    const missingFields = parsed.data.reveal.filter((field) => !hasStoredField(storedDetails, field));

    if (!missingFields.length && storedDetails) {
      return NextResponse.json({ details: storedDetails, cached: true });
    }

    const revealed = await revealContactDetails({
      ...parsed.data,
      reveal: missingFields
    });
    const details = await storeRevealedContactDetails({
      ...revealed,
      revealedFields: missingFields
    });

    return NextResponse.json({ details, cached: false });
  } catch (error) {
    if (error instanceof LushaApiError) {
      return NextResponse.json(
        { error: error.friendlyMessage },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Could not reveal contact details." },
      { status: 500 }
    );
  }
}
