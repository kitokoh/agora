import type {
  AuthLoginRequest,
  AuthLoginResponse,
  AuthRegisterRequest,
  AuthRegisterResponse,
  HealthResponse,
  ReadyResponse,
} from '@agora/contracts';

export interface AgoraClientOptions {
  baseUrl: string;
  /** Access token attached as `Authorization: Bearer` when present. */
  accessToken?: string;
  /** Called when the API returns 401 — hook for token refresh. */
  onUnauthorized?: () => void | Promise<void>;
  fetchImpl?: typeof fetch;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly requestId?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Typed API client generated from `@agora/contracts` (single source of
 * truth — ADR-0011). Methods are added as the contract grows; every method
 * is fully typed from the zod schemas.
 *
 * Stub status (M0): health + auth contract methods only.
 */
export class AgoraClient {
  private readonly baseUrl: string;
  private accessToken?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly onUnauthorized?: () => void | Promise<void>;

  constructor(options: AgoraClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.accessToken = options.accessToken;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.onUnauthorized = options.onUnauthorized;
  }

  setAccessToken(token: string | undefined): void {
    this.accessToken = token;
  }

  // -- ops -----------------------------------------------------------------

  async healthz(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/healthz');
  }

  async readyz(): Promise<ReadyResponse> {
    return this.request<ReadyResponse>('/readyz');
  }

  // -- auth (M1) -----------------------------------------------------------

  async register(input: AuthRegisterRequest): Promise<AuthRegisterResponse> {
    return this.request<AuthRegisterResponse>('/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async login(input: AuthLoginRequest): Promise<AuthLoginResponse> {
    return this.request<AuthLoginResponse>('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  // -- internals -----------------------------------------------------------

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    };
    if (this.accessToken) {
      headers.authorization = `Bearer ${this.accessToken}`;
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });

    if (response.status === 401) {
      await this.onUnauthorized?.();
    }

    const body = (await response.json().catch(() => null)) as
      | { error?: { code?: string; message?: string; requestId?: string; details?: Record<string, unknown> } }
      | null;

    if (!response.ok) {
      throw new ApiError(
        response.status,
        body?.error?.code ?? 'UNKNOWN_ERROR',
        body?.error?.message ?? `Request failed with status ${response.status}`,
        body?.error?.requestId,
        body?.error?.details,
      );
    }

    return body as T;
  }
}
