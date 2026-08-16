import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCHEMA_PATH = resolve(import.meta.dirname, '../prisma/schema.prisma');
const schema = readFileSync(SCHEMA_PATH, 'utf8');

describe('schema integrity (AGENTS.md §7 — money rules)', () => {
  it('never uses Float or Decimal for money fields', () => {
    // Money fields must be BigInt minor units. Float is forbidden by the
    // constitution; Decimal is permitted only for non-money quantities.
    const moneyDecls = [...schema.matchAll(/^\s*(\w+)\s+(Float|Decimal)\s+/gm)].map((m) => m[0].trim());
    // commission percent is stored as basis points Int; Decimal is not used at all.
    expect(moneyDecls).toEqual([]);
  });

  it('has no Float columns anywhere in the schema', () => {
    expect(schema).not.toMatch(/Float/);
  });

  it('declares all eight bounded-context schemas', () => {
    expect(schema).toMatch(/schemas\s*=\s*\["identity", "marketplace", "catalog", "orders", "payments", "finance", "notification", "audit"\]/);
  });

  it('annotates every model with a context schema', () => {
    const models = [...schema.matchAll(/^model (\w+) \{/gm)].map((m) => m[1]);
    expect(models.length).toBeGreaterThanOrEqual(30);
    for (const model of models) {
      const block = schema.slice(schema.indexOf(`model ${model} {`));
      const end = block.indexOf('\n}');
      const body = block.slice(0, end);
      expect(body, `model ${model} missing @@schema`).toMatch(/@@schema\("/);
    }
  });

  it('uses uuid(7) ids and timestamptz timestamps', () => {
    expect(schema).toMatch(/@default\(uuid\(7\)\)/);
    expect(schema).toMatch(/@db\.Timestamptz/);
  });

  it('has no cross-context foreign keys (relations stay within a context)', () => {
    // Relations exist only between models in the same @@schema block.
    const blocks = schema.split(/\n(?=model )/);
    for (const block of blocks) {
      const schemaName = block.match(/@@schema\("(\w+)"\)/)?.[1];
      if (!schemaName) continue;
      const relations = [...block.matchAll(/@relation\(fields: \[(\w+)\], references: \[(\w+)\]/g)];
      for (const [, field, ref] of relations) {
        // Cross-context references are named `<context>.<table>` in comments;
        // verify no @relation targets a differently-schema'd model by
        // checking every relation target exists within this block.
        expect(block, `relation in ${schemaName} references model not in same block: ${ref}`).toMatch(
          new RegExp(`model ${ref} \\{`),
        );
      }
    }
  });
});
