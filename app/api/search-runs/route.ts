import { NextResponse } from "next/server";
import { getSearchRun, listSearchRuns } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (id) {
    const response = await getSearchRun(id);
    return NextResponse.json(response, { status: response.run ? 200 : 404 });
  }

  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 50);
  const response = await listSearchRuns(Number.isFinite(limit) ? limit : 20);

  return NextResponse.json(response);
}
