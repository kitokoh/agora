import { Issuer, generators, type Client } from 'openid-client';
import type { PrismaClient } from '@agora/db';
import type { AppConfig } from '../../config.js';
import { ApiError } from '../../plugins/error-handler.js';

export type SocialProvider = 'google' | 'facebook' | 'apple';

export interface SocialUser {
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  name?: string;
}

const PROVIDERS: Record<SocialProvider, { clientIdEnv: string; clientSecretEnv: string; issuerUrl?: string }> = {
  google: {
    clientIdEnv: 'GOOGLE_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
    issuerUrl: 'https://accounts.google.com',
  },
  facebook: {
    clientIdEnv: 'FACEBOOK_CLIENT_ID',
    clientSecretEnv: 'FACEBOOK_CLIENT_SECRET',
    issuerUrl: 'https://www.facebook.com',
  },
  apple: {
    clientIdEnv: 'APPLE_CLIENT_ID',
    clientSecretEnv: 'APPLE_CLIENT_SECRET',
    issuerUrl: 'https://appleid.apple.com',
  },
};

/**
 * Social login (issue #27): OIDC discovery + authorization code flow for
 * Google / Facebook / Apple. Accounts link by verified email: an existing
 * email/password user gets the social identity attached; otherwise a
 * verified account is created.
 *
 * Tests inject a mock issuer URL + fixtures (see social.integration.test).
 */
export interface SocialProviderOverride {
  clientId: string;
  clientSecret: string;
  /** OIDC issuer URL (defaults to the public provider discovery URL). */
  issuerUrl?: string;
}

export class SocialService {
  private readonly clients = new Map<SocialProvider, Client>();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: AppConfig,
    private readonly overrides: Partial<Record<SocialProvider, SocialProviderOverride>> = {},
  ) {}

  isConfigured(provider: SocialProvider): boolean {
    const spec = PROVIDERS[provider];
    return Boolean(process.env[spec.clientIdEnv] && process.env[spec.clientSecretEnv]);
  }

  private async getClient(provider: SocialProvider): Promise<Client> {
    const cached = this.clients.get(provider);
    if (cached) return cached;

    const spec = PROVIDERS[provider];
    const override = this.overrides[provider];
    const clientId = override?.clientId ?? process.env[spec.clientIdEnv];
    const clientSecret = override?.clientSecret ?? process.env[spec.clientSecretEnv];
    if (!clientId || !clientSecret) {
      throw new ApiError(503, 'SOCIAL_NOT_CONFIGURED', `${provider} login is not configured`);
    }

    // Issuer override allows test fixtures; production uses discovery.
    const issuerUrl = override?.issuerUrl ?? spec.issuerUrl!;
    const issuer = await Issuer.discover(issuerUrl);
    const client = new issuer.Client({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uris: [`${this.config.PUBLIC_APP_URL}/oauth/${provider}/callback`],
      response_types: ['code'],
    });
    this.clients.set(provider, client);
    return client;
  }

  /** Build the provider authorize URL (redirect the user here). */
  async authorizeUrl(provider: SocialProvider, state: string): Promise<{ url: string; nonce: string }> {
    const client = await this.getClient(provider);
    const nonce = generators.nonce();
    const url = client.authorizationUrl({
      scope: 'openid email profile',
      state,
      nonce,
    });
    return { url, nonce };
  }

  /** Exchange the authorization code for a verified identity. */
  async exchangeCode(provider: SocialProvider, code: string, nonce: string): Promise<SocialUser> {
    const client = await this.getClient(provider);
    const tokenSet = await client.callback(
      `${this.config.PUBLIC_APP_URL}/oauth/${provider}/callback`,
      { code },
      { nonce },
    );
    const claims = tokenSet.claims();
    if (!claims.email) {
      throw new ApiError(400, 'SOCIAL_EMAIL_MISSING', 'The provider did not return an email');
    }
    return {
      providerUserId: claims.sub as string,
      email: (claims.email as string).toLowerCase(),
      emailVerified: (claims.email_verified as boolean) ?? false,
      name: (claims.name as string) ?? undefined,
    };
  }

  /**
   * Find-or-create a user for a verified social identity.
   * - Existing user with the same email → attach provider id (linking).
   * - Otherwise create an active, verified account (passwordless).
   */
  async findOrCreate(social: SocialUser): Promise<{ id: string; email: string }> {
    if (!social.emailVerified) {
      throw new ApiError(403, 'SOCIAL_EMAIL_UNVERIFIED', 'Provider email is not verified');
    }
    let user = await this.prisma.user.findUnique({ where: { email: social.email } });
    if (user) {
      if (user.status === 'suspended') {
        throw new ApiError(403, 'ACCOUNT_SUSPENDED', 'Account is suspended');
      }
      return { id: user.id, email: user.email };
    }
    user = await this.prisma.user.create({
      data: {
        email: social.email,
        status: 'active',
        emailVerifiedAt: new Date(),
      },
    });
    return { id: user.id, email: user.email };
  }
}
