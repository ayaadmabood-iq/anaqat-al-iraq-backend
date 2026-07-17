import { Injectable, Logger } from '@nestjs/common';

/**
 * MVP mailer: only prints the verification link to the log so the developer
 * can complete signup during acceptance testing. Swap the driver for real
 * SMTP by implementing `send()` against nodemailer without touching callers.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async sendVerificationEmail(params: {
    to: string;
    fullName: string;
    token: string;
  }): Promise<void> {
    const base = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
    const link = `${base}/api/v1/auth/verify?token=${encodeURIComponent(params.token)}`;
    const from = process.env.MAIL_FROM || 'no-reply@example.com';
    const driver = process.env.MAIL_DRIVER || 'log';

    if (driver === 'log') {
      this.logger.log(
        `[mail:log] to=${params.to} from=${from} — أهلاً ${params.fullName}، ` +
          `رابط تأكيد البريد: ${link}`,
      );
      return;
    }

    // Placeholder for real SMTP integration.
    this.logger.warn(`Unknown MAIL_DRIVER "${driver}", link would be: ${link}`);
  }

  async sendPasswordResetEmail(params: {
    to: string;
    fullName: string;
    token: string;
  }): Promise<void> {
    const base = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
    const link = `${base}/api/v1/auth/reset-password?token=${encodeURIComponent(params.token)}`;
    const from = process.env.MAIL_FROM || 'no-reply@example.com';
    const driver = process.env.MAIL_DRIVER || 'log';

    if (driver === 'log') {
      this.logger.log(
        `[mail:log] to=${params.to} from=${from} — ${params.fullName}، ` +
          `طلبتَ استعادة كلمة المرور. الرابط (صالح ساعة): ${link}`,
      );
      return;
    }
    this.logger.warn(`Unknown MAIL_DRIVER "${driver}", reset link: ${link}`);
  }
}
