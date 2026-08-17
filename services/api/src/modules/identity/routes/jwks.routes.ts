import type { FastifyInstance } from 'fastify';
import type { KeyPair } from '../sessions.service.js';

/**
 * GET /.well-known/jwks.json — public key set for verifying Agora access
 * tokens (RS256). Consumed by the frontend edge middleware (#55) and any
 * third-party verifier.
 */
export async function jwksRoutes(app: FastifyInstance, keyPair: KeyPair): Promise<void> {
  const jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);

  app.get('/.well-known/jwks.json', async () => ({
    keys: [
      {
        ...jwk,
        use: 'sig',
        alg: 'RS256',
        kid: 'agora-access-v1',
      },
    ],
  }));
}
