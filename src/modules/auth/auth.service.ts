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
import { User, EmailVerificationToken } from '@/database';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { MailService } from '@/modules/mail/mail.service';
import { AuditService } from '@/modules/audit/audit.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(EmailVerificationToken)
    private readonly tokens: Repository<EmailVerificationToken>,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
  ) {}

  async register(dto: RegisterDto, ip?: string) {
    if (!dto.privacyAccepted || !dto.termsAccepted) {
      throw new BadRequestException(
        'يجب الموافقة على سياسة الخصوصية وشروط الاستخدام قبل التسجيل',
      );
    }

    const emailLc = dto.email.toLowerCase().trim();
    const existing = await this.users.findOne({ where: { email: emailLc } });
    if (existing) throw new ConflictException('البريد الإلكتروني مسجّل مسبقًا');

    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    const passwordHash = await bcrypt.hash(dto.password, rounds);

    const user = this.users.create({
      fullName: dto.fullName.trim(),
      email: emailLc,
      passwordHash,
      phone: dto.phone ?? null,
      country: dto.country ?? null,
      city: dto.city ?? null,
      preferredLang: dto.preferredLang ?? 'ar',
      role: 'user',
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
      actorRole: 'user',
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
      actorRole: 'user',
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
}
