import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
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

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(EmailVerificationToken)
    private readonly tokens: Repository<EmailVerificationToken>,
    @InjectRepository(PasswordResetToken)
    private readonly resets: Repository<PasswordResetToken>,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
  ) {}

  private bcryptRounds() {
    return parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
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
      role: 'customer',
      emailVerified: false,
      isActive: true,
      privacyAccepted: true,
      termsAccepted: true,
      acceptedAt: new Date(),
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
    const token = randomBytes(48).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 48); // 48h
    await this.tokens.save(
      this.tokens.create({ userId: user.id, token, expiresAt: expires }),
    );
    await this.mail.sendVerificationEmail({
      to: user.email,
      fullName: user.fullName,
      token,
    });
  }

  async verifyEmail(token: string) {
    if (!token) throw new BadRequestException('missing token');
    const row = await this.tokens.findOne({ where: { token } });
    if (!row || row.consumedAt || row.expiresAt < new Date()) {
      throw new BadRequestException('رابط التحقق غير صالح أو انتهت صلاحيته');
    }
    row.consumedAt = new Date();
    await this.tokens.save(row);

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

    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      role: user.role,
      email: user.email,
    });

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
   * IRPB file 2 §5 — "استعادة كلمة المرور". We always return `ok: true` so
   * callers cannot use the endpoint to enumerate registered addresses.
   */
  async forgotPassword(dto: ForgotPasswordDto, ip?: string) {
    const emailLc = dto.email.toLowerCase().trim();
    const user = await this.users.findOne({ where: { email: emailLc } });
    if (user && user.isActive) {
      const token = randomBytes(48).toString('hex');
      const expires = new Date(Date.now() + 1000 * 60 * 60); // 1h
      await this.resets.save(
        this.resets.create({
          userId: user.id,
          token,
          expiresAt: expires,
          requestIp: ip ?? null,
        }),
      );
      await this.mail.sendPasswordResetEmail({
        to: user.email,
        fullName: user.fullName,
        token,
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
    const row = await this.resets.findOne({ where: { token: dto.token } });
    if (!row || row.consumedAt || row.expiresAt < new Date()) {
      throw new BadRequestException('رابط الاستعادة غير صالح أو انتهت صلاحيته');
    }
    const user = await this.users.findOne({ where: { id: row.userId } });
    if (!user) throw new BadRequestException('user missing');

    user.passwordHash = await bcrypt.hash(dto.newPassword, this.bcryptRounds());
    row.consumedAt = new Date();
    await this.resets.save(row);
    await this.users.save(user);

    await this.audit.record({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'user.password_reset_completed',
      entity: 'user',
      entityId: user.id,
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
