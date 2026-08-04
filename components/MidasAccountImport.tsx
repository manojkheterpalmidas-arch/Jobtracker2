"use client";

import { ChangeEvent, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { MidasDuplicateStrategy, MidasImportPreviewResponse } from "@/lib/types";

type MidasAccountImportProps = {
  adminPasscode: string;
  onImported: () => void;
};

export function MidasAccountImport({ adminPasscode, onImported }: MidasAccountImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<MidasImportPreviewResponse | null>(null);
  const [duplicateStrategy, setDuplicateStrategy] = useState<MidasDuplicateStrategy>("skip_duplicates");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setPreview(null);
    setMessage("");
  }

  async function upload(mode: "preview" | "commit") {
    if (!file) return;
    setLoading(true);
    setMessage("");

    const formData = new FormData();
    formData.set("file", file);
    formData.set("mode", mode);
    formData.set("duplicateStrategy", duplicateStrategy);

    try {
      const response = await fetch("/api/midas-accounts/import", {
        method: "POST",
        headers: {
          "x-admin-passcode": adminPasscode
        },
        body: formData
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Import failed.");
      }

      if (mode === "preview") {
        setPreview(data);
      } else {
        setPreview(null);
        setFile(null);
        setMessage(`Import complete. Inserted ${data.summary.inserted}, updated ${data.summary.updated}, skipped ${data.summary.skipped}.`);
        onImported();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="midasImport">Import CSV / Excel</Label>
        <input
          id="midasImport"
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFile}
          className="file-control"
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <select
          value={duplicateStrategy}
          onChange={(event) => setDuplicateStrategy(event.target.value as MidasDuplicateStrategy)}
          className="select-control h-10"
        >
          <option value="skip_duplicates">Skip duplicates</option>
          <option value="update_duplicates">Update duplicates</option>
          <option value="insert_new_only">Insert new only</option>
        </select>
        <Button type="button" variant="outline" disabled={!file || loading} onClick={() => upload("preview")}>
          Preview
        </Button>
        <Button type="button" disabled={!file || loading || !preview} onClick={() => upload("commit")}>
          <Upload className="h-4 w-4" aria-hidden="true" />
          Save import
        </Button>
      </div>
      {preview ? (
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="font-medium">
            Preview: {preview.validRows} valid, {preview.duplicateRows} duplicates, {preview.errorRows} errors
          </p>
          <div className="mt-3 max-h-48 overflow-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">Row</th>
                  <th className="py-2 pr-3">Company</th>
                  <th className="py-2 pr-3">Country</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Import note</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 50).map((row) => (
                  <tr key={row.rowNumber} className="border-t">
                    <td className="py-2 pr-3">{row.rowNumber}</td>
                    <td className="py-2 pr-3">{row.companyName}</td>
                    <td className="py-2 pr-3">{row.country}</td>
                    <td className="py-2 pr-3">{row.relationshipStatus}</td>
                    <td className="py-2 pr-3">{row.error || (row.duplicate ? "Duplicate" : "New")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
