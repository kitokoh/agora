import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCHEMA_PATH = resolve(import.meta.dirname, '../prisma/schema.prisma');
const schema = readFileSync(SCHEMA_PATH, 'utf8');

/** Split the schema into per-model blocks with their context + map. */
function modelBlocks(): { name: string; schema: string; map: string; body: string }[] {
  const blocks = schema.split(/\n(?=model )/).filter((b) => b.startsWith('model '));
  return blocks.map((b) => {
    const name = b.match(/^model (\w+) \{/)?.[1] ?? '';
    const sch = b.match(/@@schema\("(\w+)"\)/)?.[1] ?? '';
    const map = b.match(/@@map\("(\w+)"\)/)?.[1] ?? name;
    const body = b.slice(b.indexOf('{') + 1);
    return { name, schema: sch, map, body };
  });
}

describe('schema integrity (AGENTS.md §7 — money rules)', () => {
  it('never uses Float or Decimal for money fields', () => {
    // Money fields must be BigInt minor units (integer cents). Float is
    // forbidden by the constitution; Decimal is not used anywhere.
    expect(schema).not.toMatch(/Float/);
    expect(schema).not.toMatch(/Decimal/);
  });

  it('declares all eight bounded-context schemas', () => {
    expect(schema).toMatch(
      /schemas\s*=\s*\["identity", "marketplace", "catalog", "orders", "payments", "finance", "notification", "audit"\]/,
    );
  });

  it('annotates every model with a context schema and a pluralized table map', () => {
    const blocks = modelBlocks();
    expect(blocks.length).toBeGreaterThanOrEqual(30);
    for (const b of blocks) {
      expect(b.schema, `model ${b.name} missing @@schema`).not.toBe('');
      expect(b.map, `model ${b.name} missing @@map`).not.toBe(b.name);
      // pluralization sanity: mapped table name is a different (plural) identifier
      expect(b.map).not.toEqual(b.name);
    }
  });

  it('uses uuid(7) ids and timestamptz timestamps', () => {
    expect(schema).toMatch(/@default\(uuid\(7\)\)/);
    expect(schema).toMatch(/@db\.Timestamptz/);
  });

  it('keeps relations inside their bounded context (no cross-schema FKs)', () => {
    const blocks = modelBlocks();
    const byName = new Map(blocks.map((b) => [b.name, b]));

    for (const b of blocks) {
      // Relation declarations look like: `user User @relation(fields: [userId], references: [id])`
      for (const match of b.body.matchAll(/\n\s+(\w+)\s+(\w+)\s+@relation\(/g)) {
        const targetModel = match[2];
        const target = byName.get(targetModel);
        expect(target, `relation target '${targetModel}' not found (in ${b.name})`).toBeDefined();
        expect(
          target!.schema,
          `relation ${b.name} -> ${targetModel} crosses contexts (${b.schema} -> ${target!.schema})`,
        ).toBe(b.schema);
      }
    }
  });

  it('stores money fields as BigInt with _minor naming convention', () => {
    // All money columns follow <name>Minor BigInt (e.g. priceMinor, amountMinor).
    const moneyFields = [...schema.matchAll(/^\s+(\w+)\s+BigInt/gm)].map((m) => m[1]);
    expect(moneyFields.length).toBeGreaterThanOrEqual(10);
    for (const field of moneyFields) {
      expect(field, `money field '${field}' must end with Minor`).toMatch(/Minor$/);
    }
  });
});
