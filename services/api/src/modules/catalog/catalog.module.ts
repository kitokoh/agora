import type { FastifyInstance, FastifyRequest } from 'fastify';
import { type Prisma, type PrismaClient, ProductStatus } from '@agora/db';
import { ApiError } from '../../plugins/error-handler.js';
import { parseBody } from '../identity/routes/validate.js';
import { AuditService } from '../identity/audit.service.js';
import type { AppConfig } from '../../config.js';
import { productCreateRequest, productListQuery } from '@agora/contracts';

/**
 * Catalog module (M2 — issues #64/#65): product CRUD + publish for
 * sellers, public category tree + product list/detail + search for buyers.
 *
 * Money rule (schema-integrity enforced): every price is BigInt minor units
 * (e.g. cents). JSON transports BigInt as a decimal string.
 */
const productUpdateSchema = productCreateRequest.partial();

export interface CatalogModuleDeps {
  prisma: PrismaClient;
  config: AppConfig;
  audit: AuditService;
}

type ShopRow = { id: string; slug: string; name: string; status: string };

export const catalogModule = {
  name: 'catalog',
  register: async (app: FastifyInstance): Promise<void> => {
    const audit = new AuditService(app.prisma);
    const deps: CatalogModuleDeps = { prisma: app.prisma, config: app.config, audit };

    await publicRoutes(app, deps);
    await sellerRoutes(app, deps);
  },
};

// ---------------------------------------------------------------------------
// Public read side (no auth — catalog:read is open to everyone)
// ---------------------------------------------------------------------------

async function publicRoutes(app: FastifyInstance, deps: CatalogModuleDeps): Promise<void> {
  const { prisma } = deps;

  app.get('/v1/categories', async () => {
    const rows = await prisma.category.findMany({ orderBy: { name: 'asc' } });
    return rows.map((c) => ({ id: c.id, slug: c.slug, name: c.name, parentId: c.parentId }));
  });

  app.get('/v1/products', async (request) => {
    const q = productListQuery.parse(request.query);
    const where: Prisma.ProductWhereInput = { status: ProductStatus.published, deletedAt: null };

    if (q.category) {
      where.productCategories = { some: { category: { slug: q.category } } };
    }
    if (q.shop) {
      const shop = await prisma.shop.findUnique({ where: { slug: q.shop } });
      where.shopId = shop?.id ?? '__none__';
    }
    if (q.min !== undefined || q.max !== undefined) {
      where.basePriceMinor = { gte: q.min, lte: q.max };
    }
    if (q.q) {
      where.OR = [
        { title: { contains: q.q, mode: 'insensitive' } },
        { description: { contains: q.q, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput[] =
      q.sort === 'price_asc'
        ? [{ basePriceMinor: 'asc' }]
        : q.sort === 'price_desc'
          ? [{ basePriceMinor: 'desc' }]
          : [{ createdAt: 'desc' }];

    const [total, rows] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { productCategories: { include: { category: true } } },
      }),
    ]);
    const shops = await loadShops(prisma, rows.map((p) => p.shopId));

    return {
      items: rows.map((p) => toSummary(p, shops.get(p.shopId))),
      total,
      page: q.page,
      limit: q.limit,
    };
  });

  app.get('/v1/products/:slug', async (request) => {
    const { slug } = request.params as { slug: string };
    const row = await prisma.product.findFirst({
      where: { slug, status: ProductStatus.published, deletedAt: null },
      include: {
        productCategories: { include: { category: true } },
        variants: true,
      },
    });
    if (!row) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
    const shop = await prisma.shop.findUnique({ where: { id: row.shopId } });
    return toDetail(row, shop);
  });
}

// ---------------------------------------------------------------------------
// Seller write side (catalog:write — scoped to the actor's shops)
// ---------------------------------------------------------------------------

async function sellerRoutes(app: FastifyInstance, deps: CatalogModuleDeps): Promise<void> {
  const { prisma, audit } = deps;
  const auth = { preHandler: app.requirePerm('catalog:write') };

  app.get('/v1/seller/products', auth, async (request) => {
    const actor = request.actor!;
    const rows = await prisma.product.findMany({
      where: { shopId: { in: actor.shopIds }, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { productCategories: { include: { category: true } } },
    });
    const shops = await loadShops(prisma, actor.shopIds);
    return { items: rows.map((p) => toSummary(p, shops.get(p.shopId))), total: rows.length };
  });

  app.get('/v1/seller/products/:id', auth, async (request) => {
    const { id } = request.params as { id: string };
    await findOwned(prisma, actorOf(request), id);
    const full = await prisma.product.findFirstOrThrow({
      where: { id },
      include: { productCategories: { include: { category: true } }, variants: true },
    });
    const shop = await prisma.shop.findUnique({ where: { id: full.shopId } });
    return toDetail(full, shop);
  });

  app.post('/v1/seller/products', auth, async (request, reply) => {
    const actor = request.actor!;
    const data = parseBody(productCreateRequest, request.body);
    const shop = await resolveShop(prisma, actor, data);
    const existing = await prisma.product.findUnique({ where: { shopId_slug: { shopId: shop.id, slug: data.slug } } });
    if (existing) throw new ApiError(409, 'SLUG_TAKEN', 'A product with this slug already exists in your shop');

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          shopId: shop.id,
          title: data.title,
          slug: data.slug,
          description: data.description ?? null,
          currency: data.currency ?? 'USD',
          basePriceMinor: data.basePriceMinor,
          media: data.media as unknown as Prisma.InputJsonValue,
          attributes: data.attributes as unknown as Prisma.InputJsonValue,
          meta: {} as unknown as Prisma.InputJsonValue,
          variants: {
            create: data.variants.map((v) => ({
              shopId: shop.id,
              sku: v.sku,
              optionValues: v.optionValues as unknown as Prisma.InputJsonValue,
              priceMinor: v.priceMinor,
              compareAtMinor: v.compareAtMinor ?? null,
              stock: v.stock ?? 0,
            })),
          },
        },
      });
      if ((data.categoryIds ?? []).length > 0) {
        await tx.productCategory.createMany({
          data: (data.categoryIds ?? []).map((categoryId) => ({ productId: created.id, categoryId })),
        });
      }
      return created;
    });

    await audit.record(
      { actorType: 'user', actorId: actor.userId },
      'catalog.product_created',
      'product',
      product.id,
    );
    return reply.code(201).send({ id: product.id, slug: product.slug });
  });

  app.patch('/v1/seller/products/:id', auth, async (request, reply) => {
    const actor = request.actor!;
    const { id } = request.params as { id: string };
    const data = parseBody(productUpdateSchema, request.body);
    await findOwned(prisma, actor, id);

    if (data.slug) {
      const clash = await prisma.product.findUnique({ where: { shopId_slug: { shopId: actor.shopIds[0]!, slug: data.slug } } });
      if (clash && clash.id !== id) throw new ApiError(409, 'SLUG_TAKEN', 'Slug already used in your shop');
    }

    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.slug !== undefined && { slug: data.slug }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.currency !== undefined && { currency: data.currency }),
          ...(data.basePriceMinor !== undefined && { basePriceMinor: data.basePriceMinor }),
          ...(data.media !== undefined && { media: data.media as unknown as Prisma.InputJsonValue }),
          ...(data.attributes !== undefined && { attributes: data.attributes as unknown as Prisma.InputJsonValue }),
        },
      });
      if (data.variants !== undefined) {
        await tx.variant.deleteMany({ where: { productId: id } });
        await tx.variant.createMany({
          data: data.variants.map((v) => ({
            productId: id,
            shopId: actor.shopIds[0]!,
            sku: v.sku,
            optionValues: v.optionValues as unknown as Prisma.InputJsonValue,
            priceMinor: v.priceMinor,
            compareAtMinor: v.compareAtMinor ?? null,
            stock: v.stock ?? 0,
          })),
        });
      }
      if (data.categoryIds !== undefined) {
        await tx.productCategory.deleteMany({ where: { productId: id } });
        if (data.categoryIds.length > 0) {
          await tx.productCategory.createMany({
            data: data.categoryIds.map((categoryId) => ({ productId: id, categoryId })),
          });
        }
      }
    });

    await audit.record(
      { actorType: 'user', actorId: actor.userId },
      'catalog.product_updated',
      'product',
      id,
    );
    return reply.code(204).send();
  });

  app.post('/v1/seller/products/:id/publish', auth, async (request, reply) => {
    const actor = request.actor!;
    const { id } = request.params as { id: string };
    await findOwned(prisma, actor, id);

    const product = await prisma.product.findUniqueOrThrow({
      where: { id },
      include: { variants: true },
    });
    const shop = await prisma.shop.findUnique({ where: { id: product.shopId } });
    if (!shop || shop.status !== 'active') {
      throw new ApiError(409, 'SHOP_NOT_ACTIVE', 'Publish requires an active shop');
    }
    if (product.variants.length === 0) {
      throw new ApiError(409, 'NO_VARIANTS', 'Add at least one variant before publishing');
    }

    const updated = await prisma.product.update({ where: { id }, data: { status: ProductStatus.published } });
    await audit.record(
      { actorType: 'user', actorId: actor.userId },
      'catalog.product_published',
      'product',
      id,
    );
    return reply.code(200).send({ id: updated.id, status: updated.status });
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function actorOf(request: FastifyRequest): { userId: string; shopIds: string[] } {
  return request.actor!;
}

async function resolveShop(
  prisma: PrismaClient,
  actor: { shopIds: string[] },
  data: { shopId?: string | undefined },
): Promise<ShopRow> {
  const targetId = data.shopId ?? actor.shopIds[0];
  if (!targetId) throw new ApiError(409, 'SHOP_REQUIRED', 'Create and activate a shop first');
  if (!actor.shopIds.includes(targetId)) {
    throw new ApiError(403, 'FORBIDDEN', 'Not your shop');
  }
  const shop = await prisma.shop.findUnique({ where: { id: targetId } });
  if (!shop) throw new ApiError(404, 'SHOP_NOT_FOUND', 'Shop not found');
  return { id: shop.id, slug: shop.slug, name: shop.name, status: shop.status };
}

async function findOwned(
  prisma: PrismaClient,
  actor: { shopIds: string[] },
  productId: string,
): Promise<{ id: string }> {
  const row = await prisma.product.findFirst({
    where: { id: productId, shopId: { in: actor.shopIds }, deletedAt: null },
  });
  if (!row) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
  return row;
}

// --- DTO mapping (BigInt → string) ---

interface SummaryRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  currency: string;
  basePriceMinor: bigint;
  media: Prisma.JsonValue;
  createdAt: Date;
  productCategories: { category: { id: string; slug: string; name: string } }[];
}

type ShopSnapshot = { id: string; slug: string; name: string } | null;

async function loadShops(
  prisma: PrismaClient,
  ids: string[],
): Promise<Map<string, ShopSnapshot>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  const rows = uniq.length > 0 ? await prisma.shop.findMany({ where: { id: { in: uniq } } }) : [];
  return new Map(rows.map((r) => [r.id, { id: r.id, slug: r.slug, name: r.name }]));
}

function toSummary(row: SummaryRow, shop: ShopSnapshot | undefined): Record<string, unknown> {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    status: row.status,
    currency: row.currency,
    basePriceMinor: String(row.basePriceMinor),
    media: Array.isArray(row.media) ? row.media : [],
    shop,
    categories: row.productCategories.map((pc) => pc.category),
    createdAt: row.createdAt.toISOString(),
  };
}

function toDetail(
  row: SummaryRow & {
    attributes: Prisma.JsonValue;
    variants: {
      id: string;
      sku: string;
      optionValues: Prisma.JsonValue;
      priceMinor: bigint;
      compareAtMinor: bigint | null;
      stock: number;
    }[];
  },
  shop: ShopSnapshot | undefined,
): Record<string, unknown> {
  return {
    ...toSummary(row, shop),
    attributes: (row.attributes as Record<string, string>) ?? {},
    variants: row.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      optionValues: (v.optionValues as Record<string, string>) ?? {},
      priceMinor: String(v.priceMinor),
      compareAtMinor: v.compareAtMinor === null ? null : String(v.compareAtMinor),
      stock: v.stock,
    })),
  };
}
