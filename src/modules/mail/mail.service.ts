import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as templates from './templates';

type SendPayload = { to: string; subject: string; text: string; html: string };

/**
 * Two-driver mail service.
 *
 *   MAIL_DRIVER=log  → writes the (redacted) subject to the logger and the
 *                     full payload to a per-session file under
 *                     STORAGE_ROOT/mail-outbox/ so E2E tests can read the
 *                     plaintext link without leaking it to stdout. Refuses
 *                     to run when NODE_ENV=production.
 *   MAIL_DRIVER=smtp → nodemailer with SMTP_HOST/PORT/USER/PASS/SECURE/FROM.
 *                     Fails fast at boot if any required var is missing.
 *
 * In production, tokens/URLs never appear in stdout — the log driver is
 * refused and SMTP redacts URL query strings from any error line.
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private driver: 'log' | 'smtp' = 'log';
  private outboxDir: string | null = null;

  onModuleInit() {
    this.driver = (process.env.MAIL_DRIVER || 'log') as 'log' | 'smtp';
    if (process.env.NODE_ENV === 'production' && this.driver !== 'smtp') {
      throw new Error('MAIL_DRIVER must be "smtp" in production');
    }
    if (this.driver === 'smtp') {
      const host = process.env.SMTP_HOST;
      const port = parseInt(process.env.SMTP_PORT || '587', 10);
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;
      const secure = process.env.SMTP_SECURE === 'true';
      if (!host || !user || !pass) {
        throw new Error('SMTP_HOST/USER/PASS are required when MAIL_DRIVER=smtp');
      }
      this.transporter = nodemailer.createTransport({
        host, port, secure, auth: { user, pass },
      });
      this.logger.log(`SMTP transport ready (${user}@${host}:${port})`);
    } else {
      const path = require('path');
      const fs = require('fs');
      this.outboxDir = path.join(
        process.env.STORAGE_ROOT || path.join(process.cwd(), 'storage'),
        'mail-outbox',
      );
      fs.mkdirSync(this.outboxDir, { recursive: true, mode: 0o700 });
      this.logger.warn(`MAIL_DRIVER=log — writing payloads to ${this.outboxDir}`);
    }
  }

  private redactUrl(u: string): string {
    // Never let a token/query string reach a log line — replace ?… with ?…redacted.
    return u.replace(/\?[^\s"'<>]+/g, '?<redacted>');
  }

  private async send(payload: SendPayload): Promise<void> {
    const from = process.env.MAIL_FROM || 'no-reply@example.com';
    if (this.driver === 'smtp' && this.transporter) {
      try {
        const info = await this.transporter.sendMail({ ...payload, from });
        this.logger.log(`SMTP sent to ${payload.to} (${payload.subject}); messageId=${info.messageId}`);
      } catch (err) {
        this.logger.error(`SMTP send failed to ${payload.to}: ${this.redactUrl((err as Error).message)}`);
        throw err;
      }
      return;
    }
    // log driver: never print the URL to stdout; write the payload to disk
    // so tests can read it under STORAGE_ROOT/mail-outbox/.
    const path = require('path');
    const fs = require('fs');
    const filename = path.join(
      this.outboxDir!,
      `${Date.now()}-${Buffer.from(payload.to).toString('hex').slice(0, 12)}.txt`,
    );
    fs.writeFileSync(
      filename,
      `To: ${payload.to}\nSubject: ${payload.subject}\n\n${payload.text}\n`,
      { mode: 0o600 },
    );
    this.logger.log(
      `[mail:log] queued to=${payload.to} subject="${payload.subject}" file=${filename}`,
    );
  }

  async sendVerificationEmail(p: { to: string; fullName: string; token: string }): Promise<void> {
    const base = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
    const link = `${base}/api/v1/auth/verify?token=${encodeURIComponent(p.token)}`;
    const t = templates.verifyEmail(link, p.fullName);
    await this.send({ to: p.to, subject: t.subject, text: t.text, html: t.html });
  }

  async sendPasswordResetEmail(p: { to: string; fullName: string; token: string }): Promise<void> {
    const base = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
    const link = `${base}/api/v1/auth/reset-password?token=${encodeURIComponent(p.token)}`;
    const t = templates.passwordReset(link, p.fullName);
    await this.send({ to: p.to, subject: t.subject, text: t.text, html: t.html });
  }

  async sendOrderApprovedEmail(p: {
    to: string;
    fullName: string;
    orderNumber: string;
  }): Promise<void> {
    const base = process.env.PUBLIC_BASE_URL || '';
    // We deliberately do NOT include a signed link in the email; the buyer
    // mints one from the dashboard so a leaked mail cannot be replayed.
    const t = templates.orderApproved(p.orderNumber, base, p.fullName);
    await this.send({ to: p.to, subject: t.subject, text: t.text, html: t.html });
  }
}
