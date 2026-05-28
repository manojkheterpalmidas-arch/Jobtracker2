import { NextResponse } from "next/server";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { markDuplicates, importMidasAccounts, listMidasAccounts } from "@/lib/midasAccounts";
import { isAdminPasscodeValid } from "@/lib/supabaseClient";
import {
  MidasAccountSchema,
  type MidasDuplicateStrategy,
  type MidasImportRow,
  relationshipStatusOptions
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RawRow = Record<string, unknown>;

const columnMap: Record<string, keyof Omit<MidasImportRow, "rowNumber" | "duplicate" | "duplicateOf" | "error">> = {
  company: "companyName",
  companyname: "companyName",
  name: "companyName",
  company_name: "companyName",
  domain: "companyDomain",
  website: "companyDomain",
  company_domain: "companyDomain",
  country: "country",
  location: "country",
  region: "country",
  status: "relationshipStatus",
  relationship: "relationshipStatus",
  relationship_status: "relationshipStatus",
  notes: "notes"
};

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_]+/g, "").trim();
}

function normalizeStatus(value: string) {
  const match = relationshipStatusOptions.find(
    (status) => status.toLowerCase() === value.trim().toLowerCase()
  );

  return match ?? "Unknown";
}

function coerceRows(rows: RawRow[]) {
  return rows.map((raw, index): MidasImportRow => {
    const mapped: Partial<MidasImportRow> = { rowNumber: index + 2 };

    for (const [key, value] of Object.entries(raw)) {
      const mappedKey = columnMap[normalizeHeader(key)];
      if (!mappedKey) continue;
      mapped[mappedKey] = String(value ?? "").trim() as never;
    }

    if (mapped.relationshipStatus) {
      mapped.relationshipStatus = normalizeStatus(String(mapped.relationshipStatus));
    }

    const parsed = MidasAccountSchema.safeParse(mapped);

    if (!parsed.success) {
      return {
        rowNumber: index + 2,
        companyName: mapped.companyName || "",
        companyDomain: mapped.companyDomain || "",
        country: mapped.country || "",
        relationshipStatus: mapped.relationshipStatus || "Unknown",
        notes: mapped.notes || "",
        error: "Missing or invalid company name, country, or relationship status."
      };
    }

    return {
      rowNumber: index + 2,
      ...parsed.data
    };
  });
}

async function parseFile(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".csv")) {
    const parsed = Papa.parse<RawRow>(buffer.toString("utf8"), {
      header: true,
      skipEmptyLines: true
    });

    return parsed.data;
  }

  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<RawRow>(firstSheet, { defval: "" });
}

export async function POST(request: Request) {
  if (!isAdminPasscodeValid(request.headers.get("x-admin-passcode"))) {
    return NextResponse.json({ error: "Invalid admin passcode." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const mode = String(formData.get("mode") || "preview");
  const duplicateStrategy = String(formData.get("duplicateStrategy") || "skip_duplicates") as MidasDuplicateStrategy;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload a CSV, XLS, or XLSX file." }, { status: 400 });
  }

  const rawRows = await parseFile(file);
  const existing = (await listMidasAccounts()).accounts;
  const rows = markDuplicates(coerceRows(rawRows), existing);
  const validRows = rows.filter((row) => !row.error).length;
  const duplicateRows = rows.filter((row) => row.duplicate).length;
  const errorRows = rows.filter((row) => row.error).length;

  if (mode !== "commit") {
    return NextResponse.json({
      rows,
      validRows,
      duplicateRows,
      errorRows
    });
  }

  const summary = await importMidasAccounts(rows, duplicateStrategy);
  return NextResponse.json({
    rows,
    validRows,
    duplicateRows,
    errorRows,
    summary
  });
}
