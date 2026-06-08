import { NextResponse } from "next/server";
import { z } from "zod";
import { LushaApiError, revealContactDetails } from "@/lib/lusha";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RevealContactDetailsSchema = z.object({
  contactId: z.string().trim().min(1).max(160),
  reveal: z.array(z.enum(["emails", "phones"])).min(1).max(2),
  localLushaApiKey: z.string().trim().max(300).optional().or(z.literal(""))
});

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

    const details = await revealContactDetails(parsed.data);

    return NextResponse.json({ details });
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
