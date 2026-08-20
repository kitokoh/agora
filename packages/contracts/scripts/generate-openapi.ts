/**
 * Generate the OpenAPI 3.1 document from the zod contracts.
 *
 * Run: pnpm --filter @agora/contracts generate:openapi
 * Output: packages/contracts/openapi.json (committed — CI validates it).
 */
import { writeFileSync } from 'node:fs';
import { z } from 'zod';
import { resolve } from 'node:path';
import { createDocument } from 'zod-openapi';
import {
  authLoginRequest,
  authLoginResponse,
  authRegisterRequest,
  authRegisterResponse,
  authVerifyRequest,
  authVerifyResponse,
  authVerifyResendRequest,
  authRefreshRequest,
  authLogoutRequest,
  passwordResetRequest,
  passwordResetConfirmRequest,
  mfaChallengeResponse,
  errorEnvelope,
  healthResponse,
  readyResponse,
  productCreateRequest,
  productDetail,
  productListResponse,
  categoriesResponse,
} from '../src/index.js';

const document = createDocument({
  openapi: '3.1.0',
  info: {
    title: 'Agora API',
    version: '0.1.0',
    description: 'Industrial-grade marketplace SaaS — API contracts (ADR-0011).',
  },
  servers: [{ url: 'http://localhost:4000', description: 'Local development' }],
  components: {
    schemas: {
      ErrorResponse: errorEnvelope,
    },
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
  paths: {
    '/healthz': {
      get: {
        operationId: 'getHealthz',
        summary: 'Liveness probe',
        tags: ['ops'],
        responses: {
          '200': { description: 'Service is up', content: { 'application/json': { schema: healthResponse } } },
          '404': { description: 'Unknown route', content: { 'application/json': { schema: errorEnvelope } } },
          '405': { description: 'Method not allowed', content: { 'application/json': { schema: errorEnvelope } } },
        },
      },
    },
    '/readyz': {
      get: {
        operationId: 'getReadyz',
        summary: 'Readiness probe',
        tags: ['ops'],
        responses: {
          '200': { description: 'Ready to serve traffic', content: { 'application/json': { schema: readyResponse } } },
          '503': { description: 'A dependency is down', content: { 'application/json': { schema: readyResponse } } },
        },
      },
    },
    '/v1/auth/register': {
      post: {
        operationId: 'authRegister',
        summary: 'Register with email + password (M1)',
        tags: ['auth'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: authRegisterRequest } },
        },
        responses: {
          '201': { description: 'Account created (unverified)', content: { 'application/json': { schema: authRegisterResponse } } },
          '409': { description: 'Email already registered', content: { 'application/json': { schema: errorEnvelope } } },
          '429': { description: 'Rate limited', content: { 'application/json': { schema: errorEnvelope } } },
        },
      },
    },
    '/v1/auth/verify': {
      post: {
        operationId: 'authVerify',
        summary: 'Verify email with one-time token (M1)',
        tags: ['auth'],
        requestBody: { required: true, content: { 'application/json': { schema: authVerifyRequest } } },
        responses: {
          '200': { description: 'Email verified', content: { 'application/json': { schema: authVerifyResponse } } },
          '400': { description: 'Invalid token', content: { 'application/json': { schema: errorEnvelope } } },
          '410': { description: 'Expired or reused token', content: { 'application/json': { schema: errorEnvelope } } },
        },
      },
    },
    '/v1/auth/verify/resend': {
      post: {
        operationId: 'authVerifyResend',
        summary: 'Re-send verification email (rate limited, non-enumerating)',
        tags: ['auth'],
        requestBody: { required: true, content: { 'application/json': { schema: authVerifyResendRequest } } },
        responses: {
          '200': { description: 'Accepted (never reveals account existence)', content: { 'application/json': { schema: authVerifyResponse } } },
          '429': { description: 'Rate limited', content: { 'application/json': { schema: errorEnvelope } } },
        },
      },
    },
    '/v1/auth/refresh': {
      post: {
        operationId: 'authRefresh',
        summary: 'Rotate refresh token (session family rotation)',
        tags: ['auth'],
        requestBody: { required: true, content: { 'application/json': { schema: authRefreshRequest } } },
        responses: {
          '200': { description: 'New token pair', content: { 'application/json': { schema: authLoginResponse } } },
          '401': { description: 'Invalid/reused token', content: { 'application/json': { schema: errorEnvelope } } },
        },
      },
    },
    '/v1/auth/logout': {
      post: {
        operationId: 'authLogout',
        summary: 'Revoke a session',
        tags: ['auth'],
        requestBody: { required: true, content: { 'application/json': { schema: authLogoutRequest } } },
        responses: { '204': { description: 'Revoked' } },
      },
    },
    '/v1/auth/reset/request': {
      post: {
        operationId: 'passwordResetRequest',
        summary: 'Request password reset (non-enumerating)',
        tags: ['auth'],
        requestBody: { required: true, content: { 'application/json': { schema: passwordResetRequest } } },
        responses: { '200': { description: 'Accepted' }, '429': { description: 'Rate limited', content: { 'application/json': { schema: errorEnvelope } } } },
      },
    },
    '/v1/auth/me': {
      get: {
        operationId: 'authMe',
        summary: 'Current session info (roles, permissions, shopIds)',
        tags: ['auth'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Actor info' },
          '401': { description: 'Missing/invalid token', content: { 'application/json': { schema: errorEnvelope } } },
        },
      },
    },
    '/v1/onboarding/status': {
      get: {
        operationId: 'onboardingStatus',
        summary: 'Resumable onboarding wizard state',
        tags: ['onboarding'],
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Current step' }, '401': { description: 'Unauthenticated', content: { 'application/json': { schema: errorEnvelope } } } },
      },
    },
    '/v1/onboarding/profile': {
      post: {
        operationId: 'onboardingProfile',
        summary: 'Save seller profile (step 1)',
        tags: ['onboarding'],
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Saved' }, '422': { description: 'Validation', content: { 'application/json': { schema: errorEnvelope } } } },
      },
    },
    '/v1/onboarding/shop': {
      post: {
        operationId: 'onboardingShop',
        summary: 'Create shop (draft, step 2)',
        tags: ['onboarding'],
        security: [{ bearerAuth: [] }],
        responses: {
          '201': { description: 'Shop created (draft)' },
          '409': { description: 'Shop exists or slug taken', content: { 'application/json': { schema: errorEnvelope } } },
        },
      },
    },
    '/v1/onboarding/kyc': {
      post: {
        operationId: 'onboardingKyc',
        summary: 'Save KYC draft (step 3)',
        tags: ['onboarding'],
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Saved' }, '409': { description: 'Shop required', content: { 'application/json': { schema: errorEnvelope } } } },
      },
    },
    '/v1/onboarding/submit': {
      post: {
        operationId: 'onboardingSubmit',
        summary: 'Submit for review / auto-approve in dev',
        tags: ['onboarding'],
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'pending_review or active' }, '409': { description: 'Incomplete', content: { 'application/json': { schema: errorEnvelope } } } },
      },
    },
    '/v1/admin/shops/{id}/approve': {
      post: {
        operationId: 'adminShopApprove',
        summary: 'Approve a shop (staff)',
        tags: ['admin'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Activated' },
          '403': { description: 'Missing permission', content: { 'application/json': { schema: errorEnvelope } } },
        },
      },
    },
    '/v1/admin/shops/{id}/suspend': {
      post: {
        operationId: 'adminShopSuspend',
        summary: 'Suspend a shop (staff)',
        tags: ['admin'],
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Suspended' }, '403': { description: 'Missing permission', content: { 'application/json': { schema: errorEnvelope } } } },
      },
    },
    '/v1/auth/mfa/setup': {
      post: {
        operationId: 'mfaSetup',
        summary: 'Start MFA enrollment (TOTP) — returns secret + otpauth URI',
        tags: ['auth', 'mfa'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Secret + otpauth URI' },
          '409': { description: 'Already enabled', content: { 'application/json': { schema: errorEnvelope } } },
        },
      },
    },
    '/v1/auth/mfa/enable': {
      post: {
        operationId: 'mfaEnable',
        summary: 'Confirm enrollment (password + code); issues recovery codes once',
        tags: ['auth', 'mfa'],
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Enabled + recovery codes' } },
      },
    },
    '/v1/auth/mfa/verify': {
      post: {
        operationId: 'mfaVerify',
        summary: 'Complete login with TOTP code or recovery code',
        tags: ['auth', 'mfa'],
        responses: {
          '200': { description: 'Token pair', content: { 'application/json': { schema: authLoginResponse } } },
          '401': { description: 'Bad code', content: { 'application/json': { schema: errorEnvelope } } },
        },
      },
    },
    '/v1/auth/mfa/disable': {
      post: {
        operationId: 'mfaDisable',
        summary: 'Disable MFA (password + code); revokes session family',
        tags: ['auth', 'mfa'],
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Disabled' } },
      },
    },
    '/v1/auth/mfa/recovery': {
      post: {
        operationId: 'mfaRecovery',
        summary: 'Regenerate recovery codes (password + code)',
        tags: ['auth', 'mfa'],
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'New recovery codes' } },
      },
    },
    '/v1/auth/reset/confirm': {
      post: {
        operationId: 'passwordResetConfirm',
        summary: 'Confirm password reset with one-time token',
        tags: ['auth'],
        requestBody: { required: true, content: { 'application/json': { schema: passwordResetConfirmRequest } } },
        responses: {
          '200': { description: 'Password updated; all sessions revoked' },
          '400': { description: 'Invalid token', content: { 'application/json': { schema: errorEnvelope } } },
        },
      },
    },
    '/v1/auth/login': {
      post: {
        operationId: 'authLogin',
        summary: 'Login — access + refresh tokens (M1)',
        tags: ['auth'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: authLoginRequest } },
        },
        responses: {
          '200': {
            description: 'Session established (or MFA challenge when required)',
            content: { 'application/json': { schema: z.union([authLoginResponse, mfaChallengeResponse]) } },
          },
          '401': { description: 'Invalid credentials', content: { 'application/json': { schema: errorEnvelope } } },
          '423': { description: 'Account locked', content: { 'application/json': { schema: errorEnvelope } } },
        },
      },
    },
    '/v1/categories': {
      get: {
        operationId: 'listCategories',
        summary: 'Category tree (flat; clients nest by parentId)',
        tags: ['catalog'],
        responses: {
          '200': { description: 'All categories', content: { 'application/json': { schema: categoriesResponse } } },
        },
      },
    },
    '/v1/products': {
      get: {
        operationId: 'listProducts',
        summary: 'Public product listing with search + filters',
        tags: ['catalog'],
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Free-text search' },
          { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Category slug' },
          { name: 'shop', in: 'query', schema: { type: 'string' }, description: 'Shop slug' },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['newest', 'price_asc', 'price_desc'] } },
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
        ],
        responses: {
          '200': { description: 'Paginated products', content: { 'application/json': { schema: productListResponse } } },
        },
      },
    },
    '/v1/products/{slug}': {
      get: {
        operationId: 'getProduct',
        summary: 'Public product detail by slug',
        tags: ['catalog'],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Product detail', content: { 'application/json': { schema: productDetail } } },
          '404': { description: 'Not found or not published', content: { 'application/json': { schema: errorEnvelope } } },
        },
      },
    },
    '/v1/seller/products': {
      post: {
        operationId: 'createProduct',
        summary: "Create a product in the seller's shop (catalog:write)",
        tags: ['catalog'],
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: productCreateRequest } } },
        responses: {
          '201': { description: 'Created', content: { 'application/json': { schema: productDetail } } },
          '409': { description: 'Slug taken / shop missing', content: { 'application/json': { schema: errorEnvelope } } },
        },
      },
    },
  },
});

const out = resolve(import.meta.dirname, '../openapi.json');
writeFileSync(out, JSON.stringify(document, null, 2) + '\n');
// eslint-disable-next-line no-console -- CLI script output
console.log(`openapi.json written (${document.paths ? Object.keys(document.paths).length : 0} paths)`);
