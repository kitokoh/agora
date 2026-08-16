import type { ZodType } from 'zod';
import { ApiError } from '../../../plugins/error-handler.js';

/** Parse a request body with a contract schema; 422 on mismatch. */
export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const details = Object.fromEntries(
      parsed.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
    );
    throw new ApiError(422, 'VALIDATION_ERROR', 'Request body failed validation', details);
  }
  return parsed.data;
}
