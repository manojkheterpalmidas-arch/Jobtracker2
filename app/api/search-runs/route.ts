import { NextResponse } from "next/server";
import { deleteSearchRun, getSearchRun, listSearchRuns } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (id) {
    const response = await getSearchRun(id);
    return NextResponse.json(response, { status: response.run ? 200 : 404 });
  }

  const limitParam = url.searchParams.get("limit");
  const parsedLimit = limitParam ? Number(limitParam) : undefined;
  const response = await listSearchRuns(Number.isFinite(parsedLimit) ? parsedLimit : undefined);

  return NextResponse.json(response);
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing saved search id." }, { status: 400 });
  }

  const storage = await deleteSearchRun(id);

  return NextResponse.json({ storage }, { status: storage.status === "failed" ? 500 : 200 });
}
