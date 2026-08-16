/**
 * Generate the OpenAPI 3.1 document from the zod contracts.
 *
 * Run: pnpm --filter @agora/contracts generate:openapi
 * Output: packages/contracts/openapi.json (committed — CI validates it).
 */
import { writeFileSync } from 'node:fs';
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
  errorEnvelope,
  healthResponse,
  readyResponse,
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
          '200': { description: 'Session established', content: { 'application/json': { schema: authLoginResponse } } },
          '401': { description: 'Invalid credentials', content: { 'application/json': { schema: errorEnvelope } } },
          '423': { description: 'Account locked', content: { 'application/json': { schema: errorEnvelope } } },
        },
      },
    },
  },
});

const out = resolve(import.meta.dirname, '../openapi.json');
writeFileSync(out, JSON.stringify(document, null, 2) + '\n');
console.log(`openapi.json written (${document.paths ? Object.keys(document.paths).length : 0} paths)`);
