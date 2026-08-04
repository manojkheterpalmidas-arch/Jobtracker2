import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { storeWebhookEvent } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeCompare(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

function verifySignature(payload: unknown, signatureHeader: string | null, timestamp: string | null) {
  const secret = process.env.LUSHA_WEBHOOK_SECRET?.trim();

  if (!secret) {
    return true;
  }

  if (!signatureHeader || !timestamp) {
    return false;
  }

  const signature = signatureHeader.replace(/^sha256=/i, "");
  const signedPayload = `${timestamp}.${JSON.stringify(payload)}`;
  const expected = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");

  return safeCompare(signature, expected);
}

export async function GET(request: NextRequest) {
  const challenge = request.nextUrl.searchParams.get("challenge");

  if (challenge) {
    return NextResponse.json({ challenge });
  }

  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const signature = request.headers.get("x-lusha-signature");
  const timestamp = request.headers.get("x-lusha-timestamp");

  if (!verifySignature(payload, signature, timestamp)) {
    return NextResponse.json({ error: "Invalid Lusha webhook signature." }, { status: 401 });
  }

  const event = payload as {
    id?: string;
    type?: string;
    entityType?: string;
    data?: Record<string, unknown>;
  };

  if (event.type === "companyChange" && event.entityType === "contact") {
    await storeWebhookEvent({
      id: event.id ?? crypto.randomUUID(),
      receivedAt: new Date().toISOString(),
      eventType: event.type,
      entityType: event.entityType,
      payload: event
    });
  }

  // Keep processing light and acknowledge quickly. Store only minimal B2B
  // professional context; add deletion/export workflows before retaining data.
  return NextResponse.json(
    {
      received: true,
      timestamp: new Date().toISOString(),
      webhookId: event.id ?? "unknown"
    },
    { status: 201 }
  );
}
