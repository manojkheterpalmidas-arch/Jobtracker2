import { NextResponse } from "next/server";
import {
  createMidasAccount,
  deleteMidasAccount,
  listMidasAccounts,
  updateMidasAccount
} from "@/lib/midasAccounts";
import { isAdminPasscodeValid } from "@/lib/supabaseClient";
import { MidasAccountSchema } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function passcode(request: Request) {
  return request.headers.get("x-admin-passcode");
}

function requireAdmin(request: Request) {
  return isAdminPasscodeValid(passcode(request));
}

export async function GET(request: Request) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: "Invalid admin passcode." }, { status: 401 });
  }

  const url = new URL(request.url);
  const response = await listMidasAccounts({
    query: url.searchParams.get("query") || undefined,
    country: url.searchParams.get("country") || undefined,
    relationshipStatus: url.searchParams.get("relationshipStatus") || undefined
  });

  return NextResponse.json(response);
}

export async function POST(request: Request) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: "Invalid admin passcode." }, { status: 401 });
  }

  const parsed = MidasAccountSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid MIDAS account.", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const account = await createMidasAccount(parsed.data);
  return NextResponse.json({ account });
}

export async function PUT(request: Request) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: "Invalid admin passcode." }, { status: 401 });
  }

  const parsed = MidasAccountSchema.required({ id: true }).safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid MIDAS account update.", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const account = await updateMidasAccount(parsed.data);
  return NextResponse.json({ account });
}

export async function DELETE(request: Request) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: "Invalid admin passcode." }, { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing account id." }, { status: 400 });
  }

  await deleteMidasAccount(id);
  return NextResponse.json({ ok: true });
}
