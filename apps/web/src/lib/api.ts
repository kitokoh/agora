/** API base URL for the buyer app (NEXT_PUBLIC_API_URL from env). */
export function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}
