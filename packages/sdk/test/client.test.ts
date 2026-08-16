import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgoraClient, ApiError } from '../src/index.js';

function mockFetch(status: number, body: unknown): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('AgoraClient (SDK stub)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('GETs /healthz and returns the typed payload', async () => {
    const fetchMock = mockFetch(200, {
      status: 'ok',
      service: 'agora-api',
      uptimeSeconds: 3,
      timestamp: '2026-08-16T12:00:00.000Z',
    });
    const client = new AgoraClient({ baseUrl: 'http://localhost:4000' });

    const health = await client.healthz();
    expect(health.status).toBe('ok');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/healthz',
      expect.objectContaining({ headers: expect.objectContaining({ 'content-type': 'application/json' }) }),
    );
  });

  it('POSTs /v1/auth/register with a JSON body', async () => {
    const fetchMock = mockFetch(201, { userId: '01961e78-4d99-7c20-8000-000000000000', email: 'a@b.co', status: 'unverified' });
    const client = new AgoraClient({ baseUrl: 'http://localhost:4000/' });

    const res = await client.register({ email: 'a@b.co', password: 'long-enough' });
    expect(res.status).toBe('unverified');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:4000/v1/auth/register');
    expect(JSON.parse(String(init.body))).toEqual({ email: 'a@b.co', password: 'long-enough' });
  });

  it('sends the bearer token when set', async () => {
    const fetchMock = mockFetch(200, { status: 'ok', service: 'x', uptimeSeconds: 1, timestamp: 't' });
    const client = new AgoraClient({ baseUrl: 'http://x', accessToken: 'tok-123' });
    await client.healthz();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok-123');
  });

  it('throws ApiError with code and message on 409', async () => {
    mockFetch(409, { error: { code: 'EMAIL_TAKEN', message: 'Email is already registered' } });
    const client = new AgoraClient({ baseUrl: 'http://x' });

    await expect(client.register({ email: 'a@b.co', password: 'long-enough' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 409,
      code: 'EMAIL_TAKEN',
      message: 'Email is already registered',
    });
  });

  it('invokes onUnauthorized on 401', async () => {
    mockFetch(401, { error: { code: 'UNAUTHORIZED', message: 'nope' } });
    const onUnauthorized = vi.fn();
    const client = new AgoraClient({ baseUrl: 'http://x', onUnauthorized });

    await expect(client.healthz()).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
});
