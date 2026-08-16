import { extendZodWithOpenApi } from 'zod-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export { z };

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export const iso8601 = z.string().openapi({
  description: 'ISO-8601 UTC timestamp',
  example: '2026-08-16T12:00:00.000Z',
});

export const uuid = z.string().uuid().openapi({
  description: 'UUID v7 identifier',
  example: '01961e78-4d99-7c20-8000-000000000000',
});

/** Standard API error envelope (all error responses share this shape). */
export const errorEnvelope = z
  .object({
    error: z.object({
      code: z.string().openapi({
        description: 'Machine-readable error code, e.g. EMAIL_TAKEN, INVALID_CREDENTIALS',
        example: 'EMAIL_TAKEN',
      }),
      message: z.string().openapi({ description: 'Human-readable message', example: 'Email is already registered' }),
      requestId: z.string().optional().openapi({ description: 'Correlation id (x-request-id)' }),
      details: z.record(z.string(), z.unknown()).optional().openapi({ description: 'Optional field-level details' }),
    }),
  })
  .openapi({ ref: "ErrorResponse" });

export type ErrorResponse = z.infer<typeof errorEnvelope>;

// ---------------------------------------------------------------------------
// Health (issue #10)
// ---------------------------------------------------------------------------

export const healthResponse = z
  .object({
    status: z.literal('ok'),
    service: z.string(),
    uptimeSeconds: z.number().int().nonnegative(),
    timestamp: iso8601,
  })
  .openapi({ ref: "HealthResponse" });

export type HealthResponse = z.infer<typeof healthResponse>;

export const readyCheck = z
  .object({
    name: z.string(),
    ok: z.boolean(),
    detail: z.string().optional(),
  })
  .openapi({ ref: "ReadyCheck" });

export const readyResponse = z
  .object({
    status: z.union([z.literal('ready'), z.literal('not_ready')]),
    checks: z.array(readyCheck),
  })
  .openapi({ ref: "ReadyResponse" });

export type ReadyResponse = z.infer<typeof readyResponse>;

// ---------------------------------------------------------------------------
// Auth (M1 — issues #21, #23; documented now, implemented with the module)
// ---------------------------------------------------------------------------

export const authRegisterRequest = z
  .object({
    email: z.string().trim().email().max(320).openapi({
      description: 'Email address (stored lowercased)',
      example: 'seller@example.com',
    }),
    password: z.string().min(8).max(128).openapi({
      description: 'Password — Argon2id-hashed server-side; min 8 chars',
      example: '••••••••••',
    }),
    locale: z.string().max(8).optional().openapi({ description: 'BCP-47 locale', example: 'en' }),
  })
  .openapi({ ref: "AuthRegisterRequest" });

export type AuthRegisterRequest = z.infer<typeof authRegisterRequest>;

export const authRegisterResponse = z
  .object({
    userId: uuid,
    email: z.string().email(),
    status: z.enum(['unverified']),
  })
  .openapi({ ref: "AuthRegisterResponse" });

export type AuthRegisterResponse = z.infer<typeof authRegisterResponse>;

export const authLoginRequest = z
  .object({
    email: z.string().trim().email().max(320),
    password: z.string().min(1).max(128),
    mfaCode: z.string().length(6).optional().openapi({ description: 'TOTP code when MFA is enabled' }),
  })
  .openapi({ ref: "AuthLoginRequest" });

export type AuthLoginRequest = z.infer<typeof authLoginRequest>;

export const authLoginResponse = z
  .object({
    accessToken: z.string().openapi({ description: 'RS256 JWT, 15 min TTL' }),
    refreshToken: z.string().openapi({ description: 'Opaque refresh token, 30 d TTL, rotated on use' }),
    expiresIn: z.number().int().positive().openapi({ description: 'Access token TTL in seconds', example: 900 }),
    tokenType: z.literal('Bearer'),
    user: z.object({
      id: uuid,
      email: z.string().email(),
      mfaRequired: z.boolean(),
      roles: z.array(z.string()),
    }),
  })
  .openapi({ ref: "AuthLoginResponse" });

export type AuthLoginResponse = z.infer<typeof authLoginResponse>;

export const authVerifyRequest = z
  .object({
    token: z.string().min(32).max(256).openapi({
      description: 'One-time verification token from the email link',
      example: 'a1b2c3…',
    }),
  })
  .openapi({ ref: 'AuthVerifyRequest' });

export type AuthVerifyRequest = z.infer<typeof authVerifyRequest>;

export const authVerifyResponse = z
  .object({
    status: z.literal('verified'),
    userId: uuid,
  })
  .openapi({ ref: 'AuthVerifyResponse' });

export type AuthVerifyResponse = z.infer<typeof authVerifyResponse>;

export const authVerifyResendRequest = z
  .object({
    email: z.string().trim().email().max(320),
  })
  .openapi({ ref: 'AuthVerifyResendRequest' });

export type AuthVerifyResendRequest = z.infer<typeof authVerifyResendRequest>;
