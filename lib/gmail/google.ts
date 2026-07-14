import "server-only";

import { OAuth2Client } from "google-auth-library";

export type GmailConnection = {
  user_id: string;
  profile_id: string;
  gmail_email: string;
  encrypted_refresh_token: string;
  last_history_id: string | null;
};

export async function getAccessToken(refreshToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Credenciais OAuth do Google não configuradas.");
  const oauth = new OAuth2Client(clientId, clientSecret);
  oauth.setCredentials({ refresh_token: refreshToken });
  const { token } = await oauth.getAccessToken();
  if (!token) throw new Error("O Google não retornou um access token.");
  return token;
}

export async function gmailFetch<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) throw new Error(`Gmail API ${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
}

export async function startGmailWatch(accessToken: string) {
  const topicName = process.env.GOOGLE_PUBSUB_TOPIC;
  if (!topicName) throw new Error("Tópico Pub/Sub não configurado.");
  return gmailFetch<{ historyId: string; expiration: string }>(accessToken, "/watch", {
    method: "POST",
    body: JSON.stringify({ topicName, labelIds: ["INBOX"], labelFilterBehavior: "include" }),
  });
}

