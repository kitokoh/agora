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

export const authRefreshRequest = z
  .object({ refreshToken: z.string().min(32).max(256) })
  .openapi({ ref: 'AuthRefreshRequest' });

export type AuthRefreshRequest = z.infer<typeof authRefreshRequest>;

export const authLogoutRequest = z
  .object({ refreshToken: z.string().min(32).max(256).optional() })
  .openapi({ ref: 'AuthLogoutRequest' });

export type AuthLogoutRequest = z.infer<typeof authLogoutRequest>;

export const passwordResetRequest = z
  .object({ email: z.string().trim().email().max(320) })
  .openapi({ ref: 'PasswordResetRequest' });

export type PasswordResetRequest = z.infer<typeof passwordResetRequest>;

export const passwordResetConfirmRequest = z
  .object({
    token: z.string().min(32).max(256),
    newPassword: z.string().min(8).max(128),
  })
  .openapi({ ref: 'PasswordResetConfirmRequest' });

export type PasswordResetConfirmRequest = z.infer<typeof passwordResetConfirmRequest>;

export const mfaChallengeResponse = z
  .object({
    mfaRequired: z.literal(true),
    challenge: z.string().openapi({ description: 'Short-lived MFA challenge token (2 min)' }),
    userId: uuid,
  })
  .openapi({ ref: 'MfaChallengeResponse' });

export type MfaChallengeResponse = z.infer<typeof mfaChallengeResponse>;

// ---------------------------------------------------------------------------
// Catalog (M2 — issues #64/#65)
// ---------------------------------------------------------------------------

/** Money in minor units (BigInt; JSON transports it as a decimal string). */
export const moneyMinor = z.coerce.bigint().openapi({
  description: 'Amount in minor currency units (e.g. cents), JSON string',
});

export const productVariantInput = z
  .object({
    sku: z.string().min(1).max(64),
    optionValues: z.record(z.string(), z.string()).default({}),
    priceMinor: moneyMinor,
    compareAtMinor: moneyMinor.optional(),
    stock: z.number().int().min(0).default(0),
  })
  .openapi({ ref: 'ProductVariantInput' });

export const productCreateRequest = z
  .object({
    shopId: uuid.optional().openapi({ description: 'Shop to own the product; defaults to the actor\'s first shop' }),
    title: z.string().min(2).max(160),
    slug: z
      .string()
      .min(3)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters, digits, hyphens'),
    description: z.string().max(5000).optional(),
    currency: z.string().length(3).default('USD'),
    basePriceMinor: moneyMinor,
    media: z.array(z.object({ url: z.string().url(), alt: z.string().max(200).default('') })).max(12).default([]),
    attributes: z.record(z.string(), z.string()).default({}),
    variants: z.array(productVariantInput).min(1).max(100),
    categoryIds: z.array(uuid).max(20).default([]),
  })
  .openapi({ ref: 'ProductCreateRequest' });
export type ProductCreateRequest = z.infer<typeof productCreateRequest>;

export const productUpdateRequest = productCreateRequest
  .partial()
  .extend({ id: uuid.openapi({ description: 'Product id' }) })
  .openapi({ ref: 'ProductUpdateRequest' });
export type ProductUpdateRequest = z.infer<typeof productUpdateRequest>;

export const productCategoryRef = z
  .object({ id: uuid, slug: z.string(), name: z.string() })
  .openapi({ ref: 'ProductCategoryRef' });

export const productSummary = z
  .object({
    id: uuid,
    slug: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    status: z.enum(['draft', 'published', 'archived']),
    currency: z.string(),
    basePriceMinor: moneyMinor,
    media: z.array(z.object({ url: z.string(), alt: z.string() })).default([]),
    shop: z.object({ id: uuid, slug: z.string(), name: z.string() }).openapi({ description: 'Shop snapshot' }),
    categories: z.array(productCategoryRef).default([]),
    createdAt: iso8601,
  })
  .openapi({ ref: 'ProductSummary' });

export const productDetail = productSummary
  .extend({
    description: z.string().nullable(),
    attributes: z.record(z.string(), z.string()).default({}),
    variants: z
      .array(
        z.object({
          id: uuid,
          sku: z.string(),
          optionValues: z.record(z.string(), z.string()).default({}),
          priceMinor: moneyMinor,
          compareAtMinor: moneyMinor.nullable(),
          stock: z.number().int(),
        }),
      )
      .default([]),
  })
  .openapi({ ref: 'ProductDetail' });

export const productListQuery = z
  .object({
    q: z.string().max(200).optional().openapi({ description: 'Free-text search (title/description)' }),
    category: z.string().max(120).optional().openapi({ description: 'Category slug filter' }),
    shop: z.string().max(120).optional().openapi({ description: 'Shop slug filter' }),
    min: moneyMinor.optional().openapi({ description: 'Minimum base price (minor units)' }),
    max: moneyMinor.optional().openapi({ description: 'Maximum base price (minor units)' }),
    sort: z.enum(['newest', 'price_asc', 'price_desc']).default('newest'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .openapi({ ref: 'ProductListQuery' });
export type ProductListQuery = z.infer<typeof productListQuery>;

export const productListResponse = z
  .object({
    items: z.array(productSummary),
    total: z.number().int().nonnegative(),
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
  })
  .openapi({ ref: 'ProductListResponse' });

/** Flat category node — clients assemble the tree from parentId. */
export const categoryNode = z
  .object({
    id: uuid,
    slug: z.string(),
    name: z.string(),
    parentId: uuid.nullable(),
  })
  .openapi({ ref: 'CategoryNode' });

export const categoriesResponse = z.array(categoryNode).openapi({ ref: 'CategoriesResponse' });
