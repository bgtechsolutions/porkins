import { after, NextResponse, type NextRequest } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueGmailSync, processQueuedGmailSync } from "@/lib/gmail/sync";

export const maxDuration = 60;

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
    const envelope = await request.json() as { message?: { data?: string; messageId?: string } };
    const event = JSON.parse(Buffer.from(envelope.message?.data ?? "", "base64").toString("utf8")) as { emailAddress?: string; historyId?: string };
    const messageId = envelope.message?.messageId;
    if (!event.emailAddress || !event.historyId || !messageId) return new NextResponse(null, { status: 204 });

    const admin = createAdminClient();
    const { data } = await admin.from("gmail_connections").select("user_id").eq("gmail_email", event.emailAddress.toLowerCase()).maybeSingle();
    if (data) {
      const shouldStart = await enqueueGmailSync(data.user_id, event.historyId, messageId);
      if (shouldStart) after(() => processQueuedGmailSync(data.user_id));
    }
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Evento inválido" }, { status: 401 });
  }
}
