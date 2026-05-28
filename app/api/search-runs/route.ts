import { NextResponse } from "next/server";
import { listSearchRuns } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 50);
  const response = await listSearchRuns(Number.isFinite(limit) ? limit : 20);

  return NextResponse.json(response);
}
