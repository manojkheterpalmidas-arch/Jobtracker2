"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Database, Download, Lock, Pencil, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MidasAccountForm } from "@/components/MidasAccountForm";
import { MidasAccountImport } from "@/components/MidasAccountImport";
import { relationshipStatusOptions, type MidasAccount, type MidasAccountInput, type MidasAccountListResponse } from "@/lib/types";

function csvValue(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function relationshipVariant(status: MidasAccount["relationshipStatus"]) {
  if (status === "Client") return "success";
  if (status === "Former Client") return "info";
  if (status === "Prospect") return "warning";
  if (status === "Partner") return "purple";
  return "muted";
}

export function MidasAccountDatabase() {
  const [adminPasscode, setAdminPasscode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [relationshipStatus, setRelationshipStatus] = useState("");
  const [data, setData] = useState<MidasAccountListResponse | null>(null);
  const [editing, setEditing] = useState<MidasAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const stored = window.sessionStorage.getItem("midasAdminPasscode") ?? "";
    setAdminPasscode(stored);
    setUnlocked(Boolean(stored) || !process.env.NEXT_PUBLIC_SUPABASE_URL);
  }, []);

  const params = useMemo(() => {
    const search = new URLSearchParams();
    if (query) search.set("query", query);
    if (country) search.set("country", country);
    if (relationshipStatus) search.set("relationshipStatus", relationshipStatus);
    return search.toString();
  }, [country, query, relationshipStatus]);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/midas-accounts${params ? `?${params}` : ""}`, {
        cache: "no-store",
        headers: {
          "x-admin-passcode": adminPasscode
        }
      });
      setData(await response.json());
    } finally {
      setLoading(false);
    }
  }, [params, adminPasscode]);

  useEffect(() => {
    if (unlocked) {
      void loadAccounts();
    }
  }, [loadAccounts, unlocked]);

  function unlock() {
    window.sessionStorage.setItem("midasAdminPasscode", adminPasscode);
    setUnlocked(true);
  }

  async function saveAccount(account: MidasAccountInput & { id?: string }) {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/midas-accounts", {
        method: account.id ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-passcode": adminPasscode
        },
        body: JSON.stringify(account)
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Could not save MIDAS account.");

      setEditing(null);
      setMessage("MIDAS account saved.");
      await loadAccounts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save MIDAS account.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteAccount(id: string) {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/midas-accounts?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: {
          "x-admin-passcode": adminPasscode
        }
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Could not delete MIDAS account.");

      setMessage("MIDAS account deleted.");
      await loadAccounts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete MIDAS account.");
    } finally {
      setLoading(false);
    }
  }

  function exportCsv() {
    const headers = ["company_name", "company_domain", "country", "relationship_status", "notes"];
    const rows = data?.accounts.map((account) => [
      account.companyName,
      account.companyDomain,
      account.country,
      account.relationshipStatus,
      account.notes
    ]) ?? [];
    const csv = [headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `midas-accounts-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (!unlocked) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-slate-200/80 bg-white">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" aria-hidden="true" />
            <CardTitle>MIDAS Account Database</CardTitle>
          </div>
          <CardDescription>Admin-protected internal database for champion matching.</CardDescription>
        </CardHeader>
        <CardContent className="max-w-md">
          <div className="grid gap-3">
            <Label htmlFor="adminPasscode">Admin passcode</Label>
            <Input
              id="adminPasscode"
              type="password"
              value={adminPasscode}
              onChange={(event) => setAdminPasscode(event.target.value)}
              placeholder="Enter admin passcode"
            />
            <Button type="button" onClick={unlock}>Unlock database</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const stats = data?.stats;

  return (
    <div className="grid gap-5">
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-slate-200/80 bg-white">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" aria-hidden="true" />
                <CardTitle>MIDAS Account Database</CardTitle>
              </div>
              <CardDescription>Known MIDAS-related companies used to flag possible champions.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant={data?.storage.status === "supabase" ? "success" : "warning"}>
                {data?.storage.status ?? "loading"}
              </Badge>
              <Button type="button" variant="outline" onClick={exportCsv} disabled={!data?.accounts.length}>
                <Download className="h-4 w-4" aria-hidden="true" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["Total", stats?.total ?? 0],
              ["Clients", stats?.clients ?? 0],
              ["Former", stats?.formerClients ?? 0],
              ["Prospects", stats?.prospects ?? 0],
              ["Partners", stats?.partners ?? 0],
              ["Countries", stats?.countriesCovered ?? 0]
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                <p className="text-xs uppercase text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-semibold">{value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_180px_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search company, domain, country" className="pl-9" />
            </div>
            <Input value={country} onChange={(event) => setCountry(event.target.value)} placeholder="Country" />
            <select
              value={relationshipStatus}
              onChange={(event) => setRelationshipStatus(event.target.value)}
              className="select-control h-10"
            >
              <option value="">All statuses</option>
              {relationshipStatusOptions.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>

          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-slate-200/80 bg-white">
            <CardTitle>Companies</CardTitle>
            <CardDescription>{loading ? "Loading..." : `${data?.accounts.length ?? 0} records shown`}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-[840px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Company</th>
                    <th className="px-4 py-3">Domain</th>
                    <th className="px-4 py-3">Country</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Notes</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data?.accounts.map((account) => (
                    <tr key={account.id} className="align-top transition hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-medium">{account.companyName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{account.companyDomain || "-"}</td>
                      <td className="px-4 py-3">{account.country}</td>
                      <td className="px-4 py-3">
                        <Badge variant={relationshipVariant(account.relationshipStatus)}>{account.relationshipStatus}</Badge>
                      </td>
                      <td className="px-4 py-3 max-w-xs">{account.notes || "-"}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" size="icon" onClick={() => setEditing(account)} title="Edit">
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          <Button type="button" variant="outline" size="icon" onClick={() => deleteAccount(account.id)} title="Delete">
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="grid content-start gap-5">
          <Card>
            <CardHeader>
              <CardTitle>{editing ? "Edit company" : "Add company"}</CardTitle>
            </CardHeader>
            <CardContent>
              <MidasAccountForm
                account={editing}
                loading={loading}
                onSubmit={saveAccount}
                onCancel={editing ? () => setEditing(null) : undefined}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Import companies</CardTitle>
              <CardDescription>Supports CSV, XLS, and XLSX with flexible column names.</CardDescription>
            </CardHeader>
            <CardContent>
              <MidasAccountImport adminPasscode={adminPasscode} onImported={loadAccounts} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
