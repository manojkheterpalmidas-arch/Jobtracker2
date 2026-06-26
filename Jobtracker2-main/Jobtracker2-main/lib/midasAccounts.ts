import { normalizeDomain } from "@/lib/domain";
import { accountDuplicateKey } from "@/lib/companyMatching";
import { supabaseAdminFetch } from "@/lib/supabaseClient";
import type {
  MidasAccount,
  MidasAccountInput,
  MidasAccountListResponse,
  MidasDuplicateStrategy,
  MidasImportRow,
  MidasRelationshipStatus
} from "@/lib/types";

declare global {
  var midasAccountsMemory: MidasAccount[] | undefined;
}

const seedAccounts: MidasAccount[] = [
  ["WSP", "wsp.com", "UK", "Client"],
  ["Arcadis", "arcadis.com", "UK", "Client"],
  ["Mott MacDonald", "mottmac.com", "UK", "Client"],
  ["AtkinsRéalis", "atkinsrealis.com", "UK", "Client"],
  ["Egis", "egis-group.com", "Hungary", "Client"],
  ["Ramboll", "ramboll.com", "Ireland", "Client"],
  ["COWI", "cowi.com", "Denmark", "Prospect"]
].map(([companyName, companyDomain, country, relationshipStatus]) => ({
  id: crypto.randomUUID(),
  companyName,
  companyDomain,
  country,
  relationshipStatus: relationshipStatus as MidasRelationshipStatus,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}));

function memoryStore() {
  if (!globalThis.midasAccountsMemory) {
    globalThis.midasAccountsMemory = [...seedAccounts];
  }

  return globalThis.midasAccountsMemory;
}

function sanitize(input: MidasAccountInput): MidasAccountInput {
  return {
    ...input,
    companyName: input.companyName.trim(),
    companyDomain: normalizeDomain(input.companyDomain || ""),
    country: input.country.trim(),
    notes: input.notes?.trim() || "",
    createdBy: input.createdBy?.trim() || "",
    updatedBy: input.updatedBy?.trim() || ""
  };
}

function mapRow(row: Record<string, unknown>): MidasAccount {
  return {
    id: String(row.id),
    companyName: String(row.company_name),
    companyDomain: typeof row.company_domain === "string" ? row.company_domain : undefined,
    country: String(row.country),
    relationshipStatus: String(row.relationship_status) as MidasRelationshipStatus,
    notes: typeof row.notes === "string" ? row.notes : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    createdBy: typeof row.created_by === "string" ? row.created_by : undefined,
    updatedBy: typeof row.updated_by === "string" ? row.updated_by : undefined
  };
}

function toPayload(input: MidasAccountInput) {
  const safe = sanitize(input);

  return {
    company_name: safe.companyName,
    company_domain: safe.companyDomain || null,
    country: safe.country,
    relationship_status: safe.relationshipStatus,
    notes: safe.notes || null,
    created_by: safe.createdBy || null,
    updated_by: safe.updatedBy || null
  };
}

function stats(accounts: MidasAccountListResponse["accounts"]): MidasAccountListResponse["stats"] {
  return {
    total: accounts.length,
    clients: accounts.filter((item) => item.relationshipStatus === "Client").length,
    formerClients: accounts.filter((item) => item.relationshipStatus === "Former Client").length,
    prospects: accounts.filter((item) => item.relationshipStatus === "Prospect").length,
    partners: accounts.filter((item) => item.relationshipStatus === "Partner").length,
    countriesCovered: new Set(accounts.map((item) => item.country.trim().toLowerCase()).filter(Boolean)).size
  };
}

function filterAccounts(accounts: MidasAccount[], query?: string, country?: string, status?: string) {
  const q = query?.trim().toLowerCase();
  const c = country?.trim().toLowerCase();
  const s = status?.trim();

  return accounts.filter((account) => {
    const matchesQuery = !q || [account.companyName, account.companyDomain, account.country]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q);
    const matchesCountry = !c || account.country.toLowerCase().includes(c);
    const matchesStatus = !s || account.relationshipStatus === s;

    return matchesQuery && matchesCountry && matchesStatus;
  });
}

export async function listMidasAccounts(filters: { query?: string; country?: string; relationshipStatus?: string } = {}): Promise<MidasAccountListResponse> {
  try {
    const params = new URLSearchParams({
      select: "*",
      order: "company_name.asc"
    });
    const response = await supabaseAdminFetch(`midas_accounts?${params.toString()}`, { method: "GET" });

    if (!response.ok) throw new Error("Supabase list failed.");

    const rows = (await response.json()) as Array<Record<string, unknown>>;
    const accounts = filterAccounts(rows.map(mapRow), filters.query, filters.country, filters.relationshipStatus);

    return {
      accounts,
      stats: stats(accounts),
      storage: { status: "supabase" }
    };
  } catch {
    const accounts = filterAccounts(memoryStore(), filters.query, filters.country, filters.relationshipStatus);

    return {
      accounts,
      stats: stats(accounts),
      storage: {
        status: "memory",
        message: "Supabase is not configured or unavailable; using in-memory seed MIDAS accounts."
      }
    };
  }
}

export async function createMidasAccount(input: MidasAccountInput) {
  try {
    const response = await supabaseAdminFetch("midas_accounts", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(toPayload(input))
    });

    if (!response.ok) throw new Error(await response.text());

    const rows = (await response.json()) as Array<Record<string, unknown>>;
    return mapRow(rows[0]);
  } catch {
    const account: MidasAccount = {
      ...sanitize(input),
      id: crypto.randomUUID(),
      companyDomain: sanitize(input).companyDomain || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    memoryStore().push(account);
    return account;
  }
}

export async function updateMidasAccount(input: MidasAccountInput & { id: string }) {
  try {
    const params = new URLSearchParams({ id: `eq.${input.id}` });
    const response = await supabaseAdminFetch(`midas_accounts?${params.toString()}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        ...toPayload(input),
        updated_at: new Date().toISOString()
      })
    });

    if (!response.ok) throw new Error(await response.text());

    const rows = (await response.json()) as Array<Record<string, unknown>>;
    return mapRow(rows[0]);
  } catch {
    const store = memoryStore();
    const index = store.findIndex((item) => item.id === input.id);
    const updated: MidasAccount = {
      ...store[index],
      ...sanitize(input),
      id: input.id,
      companyDomain: sanitize(input).companyDomain || undefined,
      updatedAt: new Date().toISOString()
    };

    if (index >= 0) store[index] = updated;
    return updated;
  }
}

export async function deleteMidasAccount(id: string) {
  try {
    const params = new URLSearchParams({ id: `eq.${id}` });
    const response = await supabaseAdminFetch(`midas_accounts?${params.toString()}`, {
      method: "DELETE"
    });

    if (!response.ok) throw new Error(await response.text());
  } catch {
    const store = memoryStore();
    const index = store.findIndex((item) => item.id === id);
    if (index >= 0) store.splice(index, 1);
  }
}

export function markDuplicates(rows: MidasImportRow[], existing: MidasAccount[]) {
  const existingKeys = new Map(existing.map((account) => [accountDuplicateKey(account), account.id]));

  return rows.map((row) => {
    const duplicateOf = existingKeys.get(accountDuplicateKey(row));

    return {
      ...row,
      duplicate: Boolean(duplicateOf),
      duplicateOf
    };
  });
}

export async function importMidasAccounts(rows: MidasImportRow[], strategy: MidasDuplicateStrategy) {
  const existing = (await listMidasAccounts()).accounts;
  const existingByKey = new Map(existing.map((account) => [accountDuplicateKey(account), account]));
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    if (row.error) {
      errors.push(`Row ${row.rowNumber}: ${row.error}`);
      continue;
    }

    const existingAccount = existingByKey.get(accountDuplicateKey(row));

    if (existingAccount && strategy !== "update_duplicates") {
      skipped += 1;
      continue;
    }

    try {
      if (existingAccount) {
        await updateMidasAccount({ ...row, id: existingAccount.id });
        updated += 1;
      } else {
        await createMidasAccount(row);
        inserted += 1;
      }
    } catch {
      errors.push(`Row ${row.rowNumber}: could not save account.`);
    }
  }

  return { inserted, updated, skipped, errors };
}
