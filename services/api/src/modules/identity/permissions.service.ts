import type { PrismaClient } from '@agora/db';

/**
 * Permission resolver — role → permission mapping with an in-memory cache.
 * The matrix is seeded by packages/db (role_permissions); the cache is
 * refreshed when role assignments change (cache: invalidate()).
 */
export class PermissionService {
  private cache = new Map<string, string[]>();
  private loaded = false;

  constructor(private readonly prisma: PrismaClient) {}

  /** Load role→permissions into the cache (idempotent). */
  /**
   * Load role→permissions into the cache (idempotent). Lazy by design: the
   * API must boot without a reachable database (unit tests, health checks),
   * so loading only happens on the first authenticated request that needs
   * authorisation (#CI-fix: quality job runs without a Postgres service).
   */
  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    const rows = await this.prisma.rolePermission.findMany({
      include: { role: true, permission: true },
    });
    this.cache.clear();
    for (const row of rows) {
      const list = this.cache.get(row.role.name) ?? [];
      list.push(row.permission.key);
      this.cache.set(row.role.name, list);
    }
    this.loaded = true;
  }

  /** Loaded state (boot-time health check uses this instead of querying). */
  isLoaded(): boolean {
    return this.loaded;
  }

  async invalidate(): Promise<void> {
    this.loaded = false;
    this.cache.clear();
    await this.ensureLoaded();
  }

  /** Union of permissions for a set of role names. */
  async permissionsForRoles(roles: string[]): Promise<string[]> {
    await this.ensureLoaded();
    const result = new Set<string>();
    for (const role of roles) {
      for (const permission of this.cache.get(role) ?? []) {
        result.add(permission);
      }
    }
    return [...result];
  }
}
