"use client";

import { FormEvent, useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { relationshipStatusOptions, type MidasAccount, type MidasAccountInput } from "@/lib/types";

type MidasAccountFormProps = {
  account?: MidasAccount | null;
  loading?: boolean;
  onSubmit: (account: MidasAccountInput & { id?: string }) => void;
  onCancel?: () => void;
};

export function MidasAccountForm({ account, loading, onSubmit, onCancel }: MidasAccountFormProps) {
  const [companyName, setCompanyName] = useState("");
  const [companyDomain, setCompanyDomain] = useState("");
  const [country, setCountry] = useState("");
  const [relationshipStatus, setRelationshipStatus] = useState<MidasAccountInput["relationshipStatus"]>("Client");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setCompanyName(account?.companyName ?? "");
    setCompanyDomain(account?.companyDomain ?? "");
    setCountry(account?.country ?? "");
    setRelationshipStatus(account?.relationshipStatus ?? "Client");
    setNotes(account?.notes ?? "");
  }, [account]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({
      id: account?.id,
      companyName,
      companyDomain,
      country,
      relationshipStatus,
      notes
    });

    if (!account) {
      setCompanyName("");
      setCompanyDomain("");
      setCountry("");
      setRelationshipStatus("Client");
      setNotes("");
    }
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="midasCompanyName">Company name</Label>
          <Input
            id="midasCompanyName"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            placeholder="WSP"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="midasCompanyDomain">Company domain</Label>
          <Input
            id="midasCompanyDomain"
            value={companyDomain}
            onChange={(event) => setCompanyDomain(event.target.value)}
            placeholder="wsp.com"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="midasCountry">Country / location</Label>
          <Input
            id="midasCountry"
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            placeholder="UK"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="midasStatus">Relationship status</Label>
          <select
            id="midasStatus"
            value={relationshipStatus}
            onChange={(event) => setRelationshipStatus(event.target.value as MidasAccountInput["relationshipStatus"])}
            className="select-control h-10"
          >
            {relationshipStatusOptions.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="midasNotes">Notes</Label>
        <Textarea
          id="midasNotes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Optional internal note"
          className="min-h-20"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={loading}>
          <Save className="h-4 w-4" aria-hidden="true" />
          {account ? "Save changes" : "Add company"}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
