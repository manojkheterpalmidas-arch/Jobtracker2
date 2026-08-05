import { NextResponse } from "next/server";
import { LushaApiError, revealContactDetailsBulk } from "@/lib/lusha";
import { getStoredRevealedContactDetails, storeRevealedContactDetails } from "@/lib/storage";
import { BulkRevealRequestSchema } from "@/lib/types";
import type {
  BulkRevealContactResult,
  BulkRevealResponse,
  ContactRevealField,
  RevealedContactDetails
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Keeps Supabase reads/writes from fanning out to a hundred parallel requests. */
const STORAGE_CONCURRENCY = 8;

function hasStoredField(details: RevealedContactDetails | undefined, field: ContactRevealField) {
  if (!details) return false;
  if (details.revealedFields?.includes(field)) return true;
  if (field === "emails" && details.emails.length > 0) return true;
  if (field === "phones" && details.phones.length > 0) return true;
  return false;
}

async function mapWithConcurrency<Input, Output>(
  items: Input[],
  limit: number,
  handler: (item: Input) => Promise<Output>
): Promise<Output[]> {
  const results = new Array<Output>(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await handler(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));

  return results;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = BulkRevealRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid bulk reveal request.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const contactIds = Array.from(new Set(parsed.data.contactIds.map((id) => id.trim()).filter(Boolean)));
    const reveal = parsed.data.reveal;
    const warnings: string[] = [];

    const stored = await mapWithConcurrency(contactIds, STORAGE_CONCURRENCY, async (contactId) => ({
      contactId,
      details: await getStoredRevealedContactDetails(contactId)
    }));

    const cachedById = new Map<string, RevealedContactDetails>();
    const idsToReveal: string[] = [];

    stored.forEach((entry) => {
      const missingFields = reveal.filter((field) => !hasStoredField(entry.details, field));

      if (!missingFields.length && entry.details) {
        cachedById.set(entry.contactId, entry.details);
        return;
      }

      idsToReveal.push(entry.contactId);
    });

    const resultsById = new Map<string, BulkRevealContactResult>();

    cachedById.forEach((details, contactId) => {
      resultsById.set(contactId, { contactId, status: "cached", details });
    });

    let creditsUsed = 0;
    let apiCallsUsed = 0;
    let notPersisted = 0;

    function buildResponse(): BulkRevealResponse {
      const results = contactIds.map((contactId) =>
        resultsById.get(contactId) ?? {
          contactId,
          status: "failed" as const,
          error: "No response was returned for this contact."
        }
      );

      return {
        results,
        summary: {
          requested: contactIds.length,
          revealed: results.filter((result) => result.status === "revealed").length,
          cached: results.filter((result) => result.status === "cached").length,
          empty: results.filter((result) => result.status === "empty").length,
          failed: results.filter((result) => result.status === "failed").length,
          notPersisted,
          creditsUsed,
          apiCallsUsed
        },
        warnings
      };
    }

    if (idsToReveal.length) {
      let outcome;

      try {
        outcome = await revealContactDetailsBulk({
          contactIds: idsToReveal,
          reveal,
          localLushaApiKey: parsed.data.localLushaApiKey || undefined
        });
      } catch (revealError) {
        // Contacts already held in storage cost nothing and are still useful, so
        // a Lusha failure is reported per contact instead of failing everything.
        if (!(revealError instanceof LushaApiError) || !cachedById.size) {
          throw revealError;
        }

        idsToReveal.forEach((contactId) => {
          resultsById.set(contactId, { contactId, status: "failed", error: revealError.friendlyMessage });
        });
        warnings.push(revealError.friendlyMessage);
        outcome = undefined;
      }

      if (!outcome) {
        return NextResponse.json(buildResponse());
      }

      creditsUsed = outcome.creditsUsed;
      apiCallsUsed = outcome.apiCallsUsed;

      outcome.failures.forEach((failure) => {
        resultsById.set(failure.contactId, {
          contactId: failure.contactId,
          status: "failed",
          error: failure.error
        });
      });

      const persisted = await mapWithConcurrency(outcome.details, STORAGE_CONCURRENCY, (details) =>
        storeRevealedContactDetails({ ...details, revealedFields: reveal })
      );

      persisted.forEach((entry) => {
        if (!entry.persisted) {
          notPersisted += 1;
        }

        const hasAnything = entry.details.emails.length > 0 || entry.details.phones.length > 0;

        resultsById.set(entry.details.contactId, {
          contactId: entry.details.contactId,
          status: hasAnything ? "revealed" : "empty",
          details: entry.details
        });
      });

      if (notPersisted) {
        const firstStorageError = persisted.find((entry) => !entry.persisted)?.storageError;
        warnings.push(
          `${notPersisted} ${notPersisted === 1 ? "contact was" : "contacts were"} revealed but not saved to the database. ` +
            (firstStorageError ?? "Check the Supabase configuration.")
        );
      }
    }

    return NextResponse.json(buildResponse());
  } catch (error) {
    if (error instanceof LushaApiError) {
      return NextResponse.json({ error: error.friendlyMessage }, { status: error.status });
    }

    return NextResponse.json({ error: "Could not reveal contact details in bulk." }, { status: 500 });
  }
}
