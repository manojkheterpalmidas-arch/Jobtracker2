"use client";

import { Mail, Phone, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ContactRevealField, RevealedContactDetails } from "@/lib/types";

type RevealContactDetailsProps = {
  contactId?: string;
  initialDetails?: RevealedContactDetails;
  onDetailsChange?: (details: RevealedContactDetails) => void;
};

type RevealResponse = {
  details?: RevealedContactDetails;
  error?: string;
};

function mergeUnique(first: string[], second: string[]) {
  return Array.from(new Set([...first, ...second].filter(Boolean)));
}

export function RevealContactDetails({ contactId, initialDetails, onDetailsChange }: RevealContactDetailsProps) {
  const [details, setDetails] = useState<RevealedContactDetails | null>(initialDetails ?? null);
  const [loadingField, setLoadingField] = useState<ContactRevealField | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setDetails(initialDetails ?? null);
  }, [initialDetails]);

  useEffect(() => {
    if (!contactId) return;

    let cancelled = false;
    const currentContactId = contactId;

    async function loadStoredDetails() {
      try {
        const response = await fetch(`/api/reveal-contact-details?contactId=${encodeURIComponent(currentContactId)}`, {
          method: "GET",
          cache: "no-store"
        });
        const data = await response.json() as RevealResponse;

        if (!cancelled && response.ok && data.details) {
          setDetails(data.details);
          onDetailsChange?.(data.details);
        }
      } catch {
        // Stored details are an enhancement; reveal buttons still work if loading fails.
      }
    }

    void loadStoredDetails();

    return () => {
      cancelled = true;
    };
  }, [contactId, onDetailsChange]);

  async function reveal(field: ContactRevealField) {
    if (!contactId) return;

    const label = field === "emails" ? "email address" : "phone number";
    const confirmed = window.confirm(`Reveal ${label} from Lusha? This may consume Lusha credits.`);

    if (!confirmed) return;

    setLoadingField(field);
    setError("");

    try {
      const result = await fetch("/api/reveal-contact-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId,
          reveal: [field],
          localLushaApiKey: window.sessionStorage.getItem("localLushaApiKey") ?? ""
        })
      });
      const data = await result.json() as RevealResponse;

      if (!result.ok) {
        throw new Error(data.error || "Could not reveal contact details.");
      }

      const revealed = data.details;

      if (revealed) {
        setDetails((current) => {
          const nextDetails = {
            contactId: revealed.contactId,
            source: revealed.source,
            emails: mergeUnique(current?.emails ?? [], revealed.emails),
            phones: mergeUnique(current?.phones ?? [], revealed.phones),
            creditsUsed: (current?.creditsUsed ?? 0) + (revealed.creditsUsed ?? 0),
            apiCallsUsed: (current?.apiCallsUsed ?? 0) + revealed.apiCallsUsed
          };

          onDetailsChange?.(nextDetails);
          return nextDetails;
        });
      }
    } catch (revealError) {
      setError(revealError instanceof Error ? revealError.message : "Could not reveal contact details.");
    } finally {
      setLoadingField(null);
    }
  }

  if (!contactId) {
    return <span className="text-xs text-muted-foreground">No Lusha ID</span>;
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => reveal("emails")} disabled={loadingField !== null}>
          <Mail className="h-3.5 w-3.5" aria-hidden="true" />
          {loadingField === "emails" ? "Revealing..." : "Email"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => reveal("phones")} disabled={loadingField !== null}>
          <Phone className="h-3.5 w-3.5" aria-hidden="true" />
          {loadingField === "phones" ? "Revealing..." : "Phone"}
        </Button>
      </div>

      {details?.emails.length ? (
        <div className="grid gap-1 text-xs">
          {details.emails.map((email) => (
            <a key={email} href={`mailto:${email}`} className="text-primary underline-offset-4 hover:underline">
              {email}
            </a>
          ))}
        </div>
      ) : null}

      {details?.phones.length ? (
        <div className="grid gap-1 text-xs">
          {details.phones.map((phone) => (
            <a key={phone} href={`tel:${phone}`} className="text-primary underline-offset-4 hover:underline">
              {phone}
            </a>
          ))}
        </div>
      ) : null}

      {details && !details.emails.length && !details.phones.length ? (
        <p className="text-xs text-muted-foreground">No details returned.</p>
      ) : null}

      {error ? (
        <p className="inline-flex items-start gap-1 text-xs text-red-700">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
