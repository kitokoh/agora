import type { PrismaClient, NotificationChannel, NotificationStatus } from '@agora/db';

export interface EmailMessage {
  userId: string;
  to: string;
  event: string; // e.g. auth.email_verification
  subject: string;
  text: string;
  /** Idempotency anchor — (user, event, reference) unique in DB. */
  referenceId?: string;
}

export interface EmailTransport {
  send(message: EmailMessage): Promise<void>;
}

/** Log-only transport — the local default (no external calls). */
export class ConsoleEmailTransport implements EmailTransport {
  async send(message: EmailMessage): Promise<void> {
    // Structured log only; NEVER include tokens or password material.
    // eslint-disable-next-line no-console -- deliberate log-only transport
    console.info(
      JSON.stringify({
        transport: 'console',
        event: message.event,
        to: message.to,
        subject: message.subject,
      }),
    );
  }
}

/** Resend transport — used when RESEND_API_KEY is configured. */
export class ResendEmailTransport implements EmailTransport {
  constructor(private readonly apiKey: string, private readonly from: string) {}

  async send(message: EmailMessage): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
    });
    if (!res.ok) {
      throw new Error(`email send failed: ${res.status} ${await res.text()}`);
    }
  }
}

/**
 * Notification module facade (M1 scaffold — full templates land in #30).
 * Persists a Notification row for delivery tracking/idempotency, then
 * hands off to the configured transport.
 */
export class NotificationService {
  private readonly transport: EmailTransport;

  constructor(
    private readonly prisma: PrismaClient,
    transport?: EmailTransport,
  ) {
    this.transport = transport ?? new ConsoleEmailTransport();
  }

  async sendEmail(message: EmailMessage): Promise<void> {
    // Persist for tracking + idempotency (unique userId+event+reference).
    await this.prisma.notification.create({
      data: {
        userId: message.userId,
        channel: 'email' as NotificationChannel,
        event: message.event,
        payload: { to: message.to, subject: message.subject },
        status: 'queued' as NotificationStatus,
        referenceId: message.referenceId,
      },
    });
    await this.transport.send(message);
  }
}
