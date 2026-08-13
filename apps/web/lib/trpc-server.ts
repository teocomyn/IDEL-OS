import { headers } from "next/headers";

const serverApiBaseUrl = process.env.API_INTERNAL_URL
  ?? process.env.NEXT_PUBLIC_API_URL
  ?? "http://localhost:3001";

type TrpcEnvelope<T> = { result?: { data?: { json?: T } | T }; error?: { json?: { message?: string }; message?: string } };

export async function trpcQuery<T>(procedure: string, input?: unknown): Promise<T> {
  const requestHeaders = await forwardedHeaders();
  const query = input === undefined ? "" : `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
  const response = await fetch(`${serverApiBaseUrl}/trpc/${procedure}${query}`, {
    headers: requestHeaders,
    cache: "no-store",
  });
  return parseResponse<T>(response);
}

export async function trpcMutation<T>(procedure: string, input: unknown): Promise<T> {
  const requestHeaders = await forwardedHeaders();
  requestHeaders.set("content-type", "application/json");
  const response = await fetch(`${serverApiBaseUrl}/trpc/${procedure}`, {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify({ json: input }),
    cache: "no-store",
  });
  return parseResponse<T>(response);
}

async function forwardedHeaders(): Promise<Headers> {
  const source = await headers();
  const result = new Headers();
  const cookie = source.get("cookie");
  const authorization = source.get("authorization");
  if (cookie !== null) result.set("cookie", cookie);
  if (authorization !== null) result.set("authorization", authorization);
  return result;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const envelope = await response.json().catch(() => null) as TrpcEnvelope<T> | null;
  if (!response.ok || envelope?.error !== undefined) {
    throw new Error(envelope?.error?.json?.message ?? envelope?.error?.message ?? "Le service IDEL OS est momentanément indisponible.");
  }
  const data = envelope?.result?.data;
  if (data !== null && typeof data === "object" && "json" in data) return data.json;
  if (data !== undefined) return data as T;
  throw new Error("Réponse API incomplète.");
}
