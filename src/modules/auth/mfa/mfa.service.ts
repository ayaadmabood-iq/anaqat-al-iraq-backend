import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  generateSecret as otplibGenerateSecret,
  generateURI,
  verifySync,
} from 'otplib';
import * as qrcode from 'qrcode';
import { createHash, randomBytes } from 'crypto';
import { User } from '@/database';
import { AuditService } from '@/modules/audit/audit.service';

const TOTP_OPTS = { algorithm: 'sha1' as const, digits: 6, period: 30, window: 1 };

function hashCode(plain: string): string {
  return createHash('sha256').update(plain.toUpperCase(), 'utf8').digest('hex');
}

@Injectable()
export class MfaService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly audit: AuditService,
  ) {}

  isRequired(user: User): boolean {
    return user.role === 'super_admin';
  }

  /**
   * Step 1 — start enrolment. Generates a TOTP secret and returns it as a
   * base32 string and as an otpauth URL for QR display. Nothing is persisted
   * until the user proves the app is configured (step 2).
   */
  async beginEnrolment(user: User): Promise<{ secret: string; otpauthUrl: string; qrDataUrl: string }> {
    const secret = otplibGenerateSecret({ length: 20 });
    const issuer = 'Purposive Reading Platform';
    const otpauthUrl = generateURI({ ...TOTP_OPTS, label: user.email, issuer, secret });
    const qrDataUrl = await qrcode.toDataURL(otpauthUrl);
    // Stage the secret on the row but keep mfaEnabled false.
    user.mfaSecret = secret;
    user.mfaEnabled = false;
    await this.users.save(user);
    return { secret, otpauthUrl, qrDataUrl };
  }

  /**
   * Step 2 — enable MFA after the user submits a code from their app. On
   * success we also mint 8 recovery codes (returned once, hashed on disk).
   */
  async enable(user: User, code: string, ip?: string): Promise<{ recoveryCodes: string[] }> {
    if (!user.mfaSecret) throw new BadRequestException('MFA not started');
    if (!verifySync({ ...TOTP_OPTS, token: code, secret: user.mfaSecret })) {
      throw new BadRequestException('invalid code');
    }
    const recoveryCodes = Array.from({ length: 8 }, () =>
      randomBytes(5).toString('hex').toUpperCase().match(/.{1,5}/g)!.join('-'),
    );
    user.mfaRecoveryCodesHash = recoveryCodes.map(hashCode).join(',');
    user.mfaEnabled = true;
    user.tokenVersion = (user.tokenVersion ?? 1) + 1; // invalidate other sessions
    await this.users.save(user);
    await this.audit.record({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'mfa.enabled',
      entity: 'user',
      entityId: user.id,
      ipAddress: ip,
    });
    return { recoveryCodes };
  }

  async disable(user: User, code: string, ip?: string): Promise<void> {
    if (!user.mfaEnabled || !user.mfaSecret) {
      throw new BadRequestException('MFA not enabled');
    }
    if (this.isRequired(user)) {
      throw new BadRequestException('MFA is mandatory for this role and cannot be disabled');
    }
    if (!this.consumeCodeOrRecovery(user, code)) {
      throw new BadRequestException('invalid code');
    }
    user.mfaSecret = null;
    user.mfaEnabled = false;
    user.mfaRecoveryCodesHash = null;
    user.tokenVersion = (user.tokenVersion ?? 1) + 1;
    await this.users.save(user);
    await this.audit.record({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'mfa.disabled',
      entity: 'user',
      entityId: user.id,
      ipAddress: ip,
    });
  }

  /**
   * Verify a code against the user's TOTP secret OR one of their unspent
   * recovery codes. On recovery-code use, the code is removed from the row
   * so it cannot be reused. Returns true on success.
   */
  private consumeCodeOrRecovery(user: User, code: string): boolean {
    if (!user.mfaSecret) return false;
    const clean = code.replace(/\s|-/g, '').toUpperCase();
    // TOTP first
    if (
      /^\d{6,8}$/.test(clean) &&
      verifySync({ ...TOTP_OPTS, token: clean, secret: user.mfaSecret })
    ) {
      return true;
    }
    // Recovery code
    if (user.mfaRecoveryCodesHash) {
      const provided = hashCode(code);
      const hashes = user.mfaRecoveryCodesHash.split(',').filter(Boolean);
      const idx = hashes.indexOf(provided);
      if (idx >= 0) {
        hashes.splice(idx, 1);
        user.mfaRecoveryCodesHash = hashes.join(',');
        return true;
      }
    }
    return false;
  }

  async challenge(user: User, code: string, ip?: string): Promise<void> {
    if (!user.mfaEnabled) return; // not required
    if (!code) throw new UnauthorizedException('mfa code required');
    // Consume attempt (may spend a recovery code).
    const ok = this.consumeCodeOrRecovery(user, code);
    if (!ok) throw new UnauthorizedException('invalid mfa code');
    await this.users.save(user); // persist recovery-code consumption
    await this.audit.record({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'mfa.challenge_passed',
      entity: 'user',
      entityId: user.id,
      ipAddress: ip,
    });
  }
}
