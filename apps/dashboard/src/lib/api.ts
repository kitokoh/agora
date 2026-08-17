/** API base URL for the seller dashboard (NEXT_PUBLIC_API_URL from env). */
export function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}
