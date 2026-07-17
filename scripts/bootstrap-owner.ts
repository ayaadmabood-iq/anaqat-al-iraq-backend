#!/usr/bin/env ts-node
/**
 * Bootstraps (or rotates) the single owner account.
 *
 * The `qasdiya_guard_super_admin` trigger refuses any INSERT/UPDATE that
 * produces `super_admin` unless the session variable `qasdiya.bootstrap = 'on'`
 * is set. This script is the only supported way to set it. Runtime code cannot
 * escalate to super_admin.
 *
 * MFA is enabled as part of bootstrap: the secret is generated, mfaEnabled is
 * set to true, and both the otpauth URL and 8 one-time recovery codes are
 * printed ONCE to stdout. The owner scans the URL into their authenticator
 * app; from that point every login of the super_admin requires a TOTP code.
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { generateSecret as otplibGenerateSecret, generateURI } from 'otplib';
import { AppDataSource } from '@/database/data-source';
import { User } from '@/database';

async function main() {
  dotenv.config();
  const email = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || '';
  const fullName = process.env.ADMIN_FULL_NAME || 'المدير الأعلى';

  if (!email || !password) {
    console.error('ERROR: ADMIN_EMAIL and ADMIN_PASSWORD are required');
    process.exit(2);
  }
  if (password.length < 12) {
    console.error('ERROR: refusing to bootstrap owner with password < 12 chars');
    process.exit(2);
  }

  await AppDataSource.initialize();
  try {
    let secret = '';
    const recoveryCodes = Array.from({ length: 8 }, () =>
      randomBytes(5).toString('hex').toUpperCase().match(/.{1,5}/g)!.join('-'),
    );
    const hashedRecovery = recoveryCodes
      .map((c) => createHash('sha256').update(c.toUpperCase(), 'utf8').digest('hex'))
      .join(',');

    await AppDataSource.transaction(async (tx) => {
      await tx.query(`SET LOCAL qasdiya.bootstrap = 'on'`);
      const users = tx.getRepository(User);
      const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
      const hash = await bcrypt.hash(password, rounds);
      secret = otplibGenerateSecret({ length: 20 });

      const existing = await users.findOne({ where: { email } });
      if (existing) {
        existing.role = 'super_admin';
        existing.passwordHash = hash;
        existing.fullName = fullName;
        existing.emailVerified = true;
        existing.isActive = true;
        existing.privacyAccepted = true;
        existing.termsAccepted = true;
        existing.acceptedAt = existing.acceptedAt ?? new Date();
        existing.tokenVersion = (existing.tokenVersion ?? 1) + 1;
        existing.mfaSecret = secret;
        existing.mfaEnabled = true;
        existing.mfaRecoveryCodesHash = hashedRecovery;
        await users.save(existing);
        console.log(`↺ owner rotated: ${email}`);
      } else {
        const row = users.create({
          fullName,
          email,
          passwordHash: hash,
          role: 'super_admin',
          preferredLang: 'ar',
          emailVerified: true,
          isActive: true,
          privacyAccepted: true,
          termsAccepted: true,
          acceptedAt: new Date(),
          tokenVersion: 1,
          mfaSecret: secret,
          mfaEnabled: true,
          mfaRecoveryCodesHash: hashedRecovery,
        });
        await users.save(row);
        console.log(`✔ owner bootstrapped: ${email}`);
      }
    });

    const otpauth = generateURI({
      algorithm: 'sha1',
      digits: 6,
      period: 30,
      label: email,
      issuer: 'Purposive Reading Platform',
      secret,
    });
    console.log('');
    console.log('MFA ENROLMENT — save these values in a password manager, they are shown ONCE:');
    console.log(`  otpauth URL   : ${otpauth}`);
    console.log(`  TOTP secret   : ${secret}`);
    console.log(`  recovery codes:`);
    for (const c of recoveryCodes) console.log(`    ${c}`);
    console.log('');
    console.log('Scan the otpauth URL into an authenticator app (Google Authenticator, 1Password, Authy…).');
    console.log('At every login send `mfaCode` alongside email/password.');
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
