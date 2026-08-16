import { expect, test, type APIRequestContext } from '@playwright/test';

/**
 * Critical journey (M1 exit scenario, specs/001):
 * register → verify → login → shop → KYC → active.
 * Fresh random email per run; token obtained via the E2E hook
 * (E2E_TOKEN_HOOK=true in dev/staging/CI).
 */
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4000';
const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:3000';
const PASSWORD = 'e2e-valid-pass-123';

let request: APIRequestContext;

test.beforeAll(async ({ playwright }) => {
  request = await playwright.request.newContext({ baseURL: API_URL });
});

test.afterAll(async () => {
  await request.dispose();
});

test('onboarding journey: register → verify → login → shop → kyc → active', async ({ page }) => {
  const run = Date.now();
  const email = `e2e-${run}@example.com`;

  // 1) Landing page renders (web app up, a11y landmark present).
  await page.goto(WEB_URL);
  await expect(page.getByRole('heading', { name: /marketplace for boutiques/i })).toBeVisible();

  // 2) Register via the typed API contract.
  const register = await request.post('/v1/auth/register', {
    data: { email, password: PASSWORD },
  });
  expect(register.status()).toBe(201);

  // 3) Verify with the token from the E2E hook.
  const hook = await request.post('/v1/internal/e2e/verification-token', { data: { email } });
  expect(hook.status()).toBe(200);
  const verify = await request.post('/v1/auth/verify', { data: { token: (await hook.json()).token } });
  expect(verify.status()).toBe(200);

  // 4) Login → access token.
  const login = await request.post('/v1/auth/login', { data: { email, password: PASSWORD } });
  expect(login.status()).toBe(200);
  const { accessToken } = await login.json();
  const auth = { Authorization: `Bearer ${accessToken}` };

  // 5) Profile → shop → KYC → submit (AUTO_APPROVE_SHOPS=true in CI).
  expect((await request.post('/v1/onboarding/profile', { headers: auth, data: { fullName: 'E2E Seller', country: 'FR' } })).status()).toBe(200);

  const shopSlug = `e2e-shop-${run}`;
  const shop = await request.post('/v1/onboarding/shop', {
    headers: auth,
    data: { name: 'E2E Boutique', slug: shopSlug },
  });
  expect(shop.status()).toBe(201);

  expect((await request.post('/v1/onboarding/kyc', { headers: auth, data: { entityType: 'individual', docsRefs: ['e2e-doc'] } })).status()).toBe(200);

  const submit = await request.post('/v1/onboarding/submit', { headers: auth });
  expect(submit.status()).toBe(200);
  expect(['active', 'pending_review']).toContain((await submit.json()).status);

  // 6) Resumable state shows the journey complete.
  const status = await request.get('/v1/onboarding/status', { headers: auth });
  expect(status.status()).toBe(200);
  expect((await status.json()).step).toBe('done');
});
