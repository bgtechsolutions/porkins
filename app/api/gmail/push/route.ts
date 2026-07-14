import { NextResponse, type NextRequest } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncGmailConnection } from "@/lib/gmail/sync";
import type { GmailConnection } from "@/lib/gmail/google";

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  const audience = process.env.GOOGLE_PUBSUB_AUDIENCE;
  const serviceAccount = process.env.GOOGLE_PUBSUB_SERVICE_ACCOUNT;
  if (!token || !audience || !serviceAccount) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const ticket = await new OAuth2Client().verifyIdToken({ idToken: token, audience });
    if (ticket.getPayload()?.email !== serviceAccount || !ticket.getPayload()?.email_verified) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const envelope = await request.json() as { message?: { data?: string } };
    const event = JSON.parse(Buffer.from(envelope.message?.data ?? "", "base64").toString("utf8")) as { emailAddress?: string; historyId?: string };
    if (!event.emailAddress) return NextResponse.json({ ok: true });

    const admin = createAdminClient();
    const { data } = await admin.from("gmail_connections").select("*").eq("gmail_email", event.emailAddress.toLowerCase()).maybeSingle();
    if (data) {
      await admin.from("gmail_connections").update({ last_history_id: event.historyId ?? null }).eq("user_id", data.user_id);
      await syncGmailConnection(data as GmailConnection);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Evento inválido" }, { status: 401 });
  }
}

