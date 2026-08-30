/**
 * PHANTOM ROOM: Production API & Gateway URL Resolver
 * Supports both standalone Netlify frontend deployments and unified local development.
 */

export function getApiUrl(endpoint: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
  const cleanBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${cleanBase}${cleanEndpoint}`;
}

export function getWsUrl(): string | undefined {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL || undefined;
  if (!wsUrl) return undefined;
  return wsUrl.endsWith("/") ? wsUrl.slice(0, -1) : wsUrl;
}
