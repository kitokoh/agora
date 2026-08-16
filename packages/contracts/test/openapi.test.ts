import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const openapiPath = resolve(import.meta.dirname, '../openapi.json');

describe('OpenAPI 3.1 document', () => {
  const doc = JSON.parse(readFileSync(openapiPath, 'utf8'));

  it('is OpenAPI 3.1', () => {
    expect(doc.openapi).toBe('3.1.0');
  });

  it('describes the ops endpoints and auth contract', () => {
    const paths = Object.keys(doc.paths);
    expect(paths).toContain('/healthz');
    expect(paths).toContain('/readyz');
    expect(paths).toContain('/v1/auth/register');
    expect(paths).toContain('/v1/auth/login');
  });

  it('declares every operation with responses', () => {
    for (const [path, item] of Object.entries(doc.paths) as [string, Record<string, unknown>][]) {
      for (const method of Object.keys(item)) {
        const op = item[method] as { operationId?: string; responses?: unknown };
        expect(op.operationId, `${method.toUpperCase()} ${path} missing operationId`).toBeTruthy();
        expect(op.responses, `${method.toUpperCase()} ${path} missing responses`).toBeTruthy();
      }
    }
  });

  it('registers the bearer security scheme', () => {
    expect(doc.components.securitySchemes.bearerAuth.type).toBe('http');
  });

  it('includes typed schemas for request/response bodies', () => {
    const schemas = Object.keys(doc.components.schemas ?? {});
    expect(schemas).toContain('ErrorResponse');
  });
});
