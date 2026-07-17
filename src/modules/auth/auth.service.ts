import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import {
  EmailVerificationToken,
  PasswordResetToken,
  User,
} from '@/database';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/forgot-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { MailService } from '@/modules/mail/mail.service';
import { AuditService } from '@/modules/audit/audit.service';
import { MfaService } from './mfa/mfa.service';

function hashToken(plain: string): string {
  return createHash('sha256').update(plain, 'utf8').digest('hex');
}

/**
 * Constant-time equality on hex strings of the same length. Guards the
 * token-hash lookup against timing side channels even though we already
 * hash both sides.
 */
function safeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  return timingSafeEqual(ab, bb);
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(EmailVerificationToken)
    private readonly emailTokens: Repository<EmailVerificationToken>,
    @InjectRepository(PasswordResetToken)
    private readonly resets: Repository<PasswordResetToken>,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly mfa: MfaService,
  ) {}

  private bcryptRounds() {
    return parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
  }

  private signJwt(user: User) {
    return this.jwt.signAsync({
      sub: user.id,
      role: user.role,
      email: user.email,
      tv: user.tokenVersion ?? 1,
    });
  }

  async register(dto: RegisterDto, ip?: string) {
    if (!dto.privacyAccepted || !dto.termsAccepted) {
      throw new BadRequestException(
        'يجب الموافقة على سياسة الخصوصية وشروط الاستخدام قبل التسجيل',
      );
    }

    const emailLc = dto.email.toLowerCase().trim();
    const existing = await this.users.findOne({ where: { email: emailLc } });
    if (existing) throw new ConflictException('البريد الإلكتروني مسجّل مسبقًا');

    const passwordHash = await bcrypt.hash(dto.password, this.bcryptRounds());

    const user = this.users.create({
      fullName: dto.fullName.trim(),
      email: emailLc,
      passwordHash,
      phone: dto.phone ?? null,
      country: dto.country ?? null,
      city: dto.city ?? null,
      preferredLang: dto.preferredLang ?? 'ar',
      // Runtime signup is ALWAYS a customer. Role escalation is only allowed
      // through the migration-gated bootstrap path (see docs/RBAC.md and
      // migrations/*RoleHardening*.ts).
      role: 'customer',
      emailVerified: false,
      isActive: true,
      privacyAccepted: true,
      termsAccepted: true,
      acceptedAt: new Date(),
      tokenVersion: 1,
    });
    await this.users.save(user);

    await this.issueVerificationToken(user);

    await this.audit.record({
      actorUserId: user.id,
      actorRole: 'customer',
      action: 'user.registered',
      entity: 'user',
      entityId: user.id,
      ipAddress: ip,
    });

    return { id: user.id, email: user.email, verificationRequired: true };
  }

  async issueVerificationToken(user: User) {
    const plain = randomBytes(48).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 48); // 48h
    await this.emailTokens.save(
      this.emailTokens.create({
        userId: user.id,
        tokenHash: hashToken(plain),
        expiresAt: expires,
      }),
    );
    await this.mail.sendVerificationEmail({
      to: user.email,
      fullName: user.fullName,
      token: plain,
    });
  }

  async verifyEmail(token: string) {
    if (!token || typeof token !== 'string') {
      throw new BadRequestException('missing token');
    }
    const row = await this.emailTokens.findOne({
      where: { tokenHash: hashToken(token) },
    });
    if (!row || row.consumedAt || row.expiresAt < new Date()) {
      throw new BadRequestException('رابط التحقق غير صالح أو انتهت صلاحيته');
    }
    if (!safeHexEqual(row.tokenHash, hashToken(token))) {
      throw new BadRequestException('invalid token');
    }
    row.consumedAt = new Date();
    await this.emailTokens.save(row);

    const user = await this.users.findOne({ where: { id: row.userId } });
    if (!user) throw new BadRequestException('user missing');
    user.emailVerified = true;
    await this.users.save(user);

    await this.audit.record({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'user.email_verified',
      entity: 'user',
      entityId: user.id,
    });
    return { ok: true };
  }

  async login(dto: LoginDto, ip?: string) {
    const emailLc = dto.email.toLowerCase().trim();
    const user = await this.users.findOne({ where: { email: emailLc } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    if (!user.emailVerified) {
      throw new UnauthorizedException('يرجى تأكيد البريد الإلكتروني أولاً');
    }

    // A super_admin MUST have MFA before it is allowed to log in. Other
    // accounts pass through only the MFA check for enabled users.
    if (this.mfa.isRequired(user) && !user.mfaEnabled) {
      throw new UnauthorizedException(
        'MFA required for super_admin: enrol via /auth/mfa/setup + /auth/mfa/enable using a temporary session bootstrapped by the owner script',
      );
    }
    if (user.mfaEnabled) {
      await this.mfa.challenge(user, dto.mfaCode || '', ip);
    }

    const accessToken = await this.signJwt(user);

    await this.audit.record({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'user.login',
      entity: 'user',
      entityId: user.id,
      ipAddress: ip,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        preferredLang: user.preferredLang,
      },
    };
  }

  /**
   * Always returns `{ ok: true }` regardless of whether the address exists —
   * prevents account enumeration. Rate-limited at the controller.
   */
  async forgotPassword(dto: ForgotPasswordDto, ip?: string) {
    const emailLc = dto.email.toLowerCase().trim();
    const user = await this.users.findOne({ where: { email: emailLc } });
    if (user && user.isActive) {
      const plain = randomBytes(48).toString('hex');
      const expires = new Date(Date.now() + 1000 * 60 * 60); // 1h
      await this.resets.save(
        this.resets.create({
          userId: user.id,
          tokenHash: hashToken(plain),
          expiresAt: expires,
          requestIp: ip ?? null,
        }),
      );
      await this.mail.sendPasswordResetEmail({
        to: user.email,
        fullName: user.fullName,
        token: plain,
      });
      await this.audit.record({
        actorUserId: user.id,
        actorRole: user.role,
        action: 'user.password_reset_requested',
        entity: 'user',
        entityId: user.id,
        ipAddress: ip,
      });
    }
    return { ok: true };
  }

  async resetPassword(dto: ResetPasswordDto, ip?: string) {
    if (!dto.token || typeof dto.token !== 'string') {
      throw new BadRequestException('missing token');
    }
    const row = await this.resets.findOne({
      where: { tokenHash: hashToken(dto.token) },
    });
    if (!row || row.consumedAt || row.expiresAt < new Date()) {
      throw new BadRequestException('رابط الاستعادة غير صالح أو انتهت صلاحيته');
    }
    if (!safeHexEqual(row.tokenHash, hashToken(dto.token))) {
      throw new BadRequestException('invalid token');
    }
    const user = await this.users.findOne({ where: { id: row.userId } });
    if (!user) throw new BadRequestException('user missing');

    user.passwordHash = await bcrypt.hash(dto.newPassword, this.bcryptRounds());
    user.tokenVersion = (user.tokenVersion ?? 1) + 1;
    row.consumedAt = new Date();

    // Best-effort cleanup: every other outstanding reset for this user is
    // consumed too, so a link sent earlier cannot still be redeemed.
    await this.resets
      .createQueryBuilder()
      .update()
      .set({ consumedAt: new Date() })
      .where('userId = :uid AND consumedAt IS NULL', { uid: user.id })
      .execute();

    await this.resets.save(row);
    await this.users.save(user);

    await this.audit.record({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'user.password_reset_completed',
      entity: 'user',
      entityId: user.id,
      metadata: { tokenVersion: user.tokenVersion },
      ipAddress: ip,
    });
    return { ok: true };
  }

  async changePassword(user: User, dto: ChangePasswordDto, ip?: string) {
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) throw new BadRequestException('كلمة المرور الحالية غير صحيحة');
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'كلمة المرور الجديدة يجب أن تختلف عن الحالية',
      );
    }
    user.passwordHash = await bcrypt.hash(dto.newPassword, this.bcryptRounds());
    user.tokenVersion = (user.tokenVersion ?? 1) + 1;
    await this.users.save(user);
    await this.audit.record({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'user.password_changed',
      entity: 'user',
      entityId: user.id,
      ipAddress: ip,
    });
    return { ok: true };
  }

  async updateProfile(user: User, dto: UpdateProfileDto, ip?: string) {
    // Role is never touchable through the runtime API — see the schema-level
    // guardrail in migrations/*RoleHardening*.ts.
    if ('role' in (dto as Record<string, unknown>)) {
      throw new ForbiddenException('role changes are not permitted here');
    }
    if (dto.fullName !== undefined) user.fullName = dto.fullName.trim();
    if (dto.phone !== undefined) user.phone = dto.phone;
    if (dto.country !== undefined) user.country = dto.country;
    if (dto.city !== undefined) user.city = dto.city;
    if (dto.preferredLang !== undefined) user.preferredLang = dto.preferredLang;
    await this.users.save(user);
    await this.audit.record({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'user.profile_updated',
      entity: 'user',
      entityId: user.id,
      metadata: dto as unknown as Record<string, unknown>,
      ipAddress: ip,
    });
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      country: user.country,
      city: user.city,
      preferredLang: user.preferredLang,
    };
  }
}
