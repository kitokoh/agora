import type { PrismaClient, NotificationChannel, NotificationStatus } from '@agora/db';

export interface EmailMessage {
  userId: string;
  to: string;
  event: string; // e.g. auth.email_verification
  subject?: string;
  text?: string;
  /** Template variables ({{var}} placeholders rendered from templates). */
  vars?: Record<string, string | number>;
  /** Idempotency anchor — (user, event, reference) unique in DB. */
  referenceId?: string;
}

/** Render {{var}} placeholders from a template string. */
export function renderTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
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
    // Resolve the versioned template (en) when subject/body not provided.
    let subject = message.subject;
    let text = message.text;
    if (!subject || !text) {
      const template = await this.prisma.notificationTemplate.findFirst({
        where: { channel: 'email', event: message.event, locale: 'en' },
        orderBy: { version: 'desc' },
      });
      if (template) {
        subject = subject ?? renderTemplate(template.subject, message.vars ?? {});
        text = text ?? renderTemplate(template.body, message.vars ?? {});
      } else {
        subject = subject ?? message.event;
        text = text ?? message.event;
      }
    }

    // Persist for tracking + idempotency (unique userId+event+reference).
    await this.prisma.notification.create({
      data: {
        userId: message.userId,
        channel: 'email' as NotificationChannel,
        event: message.event,
        payload: { to: message.to, subject },
        status: 'queued' as NotificationStatus,
        referenceId: message.referenceId,
      },
    });
    await this.transport.send({ ...message, subject, text });
  }
}
