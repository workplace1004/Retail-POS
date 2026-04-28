const DEFAULT_PORT = "4000";

/** Session token for webpanel API (set after login). */
export const WEBPANEL_TOKEN_KEY = "retail_webpanel_token";

function trimSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function getWebpanelToken(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage.getItem(WEBPANEL_TOKEN_KEY);
}

export function setWebpanelToken(token: string | null): void {
  if (typeof sessionStorage === "undefined") return;
  if (token) sessionStorage.setItem(WEBPANEL_TOKEN_KEY, token);
  else sessionStorage.removeItem(WEBPANEL_TOKEN_KEY);
}

export function getApiBaseUrl() {
  const envBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (envBase) return trimSlash(envBase);
  if (typeof window === "undefined") return `http://127.0.0.1:${DEFAULT_PORT}`;
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:${DEFAULT_PORT}`;
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getWebpanelToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    headers,
    ...init,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Request failed (${response.status})`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
