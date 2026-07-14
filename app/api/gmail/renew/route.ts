import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { renewGmailWatch, syncGmailConnection } from "@/lib/gmail/sync";
import type { GmailConnection } from "@/lib/gmail/google";

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data, error } = await admin.from("gmail_connections").select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = await Promise.allSettled((data as GmailConnection[]).map(async (connection) => {
    await renewGmailWatch(connection);
    await syncGmailConnection(connection);
    return connection.gmail_email;
  }));
  return NextResponse.json({ ok: true, renewed: results.filter((item) => item.status === "fulfilled").length, failed: results.filter((item) => item.status === "rejected").length });
}
