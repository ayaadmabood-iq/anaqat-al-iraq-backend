#!/usr/bin/env ts-node
/**
 * Bootstraps (or rotates the password of) the single owner account.
 *
 * The trigger installed by RoleHardening1720000000100 refuses any INSERT/UPDATE
 * that produces a `super_admin` unless the session variable
 * `qasdiya.bootstrap = on` is set. This script is the only supported way to
 * set it. Nothing in the runtime application ever sets it — a compromised
 * admin API therefore cannot escalate itself into super_admin.
 *
 * Usage:
 *   ADMIN_EMAIL=owner@example.com ADMIN_PASSWORD='strong-pass' \
 *   ADMIN_FULL_NAME='Full Name' npm run bootstrap:owner
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';
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
    await AppDataSource.transaction(async (tx) => {
      await tx.query(`SET LOCAL qasdiya.bootstrap = 'on'`);
      const users = tx.getRepository(User);
      const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
      const hash = await bcrypt.hash(password, rounds);

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
        });
        await users.save(row);
        console.log(`✔ owner bootstrapped: ${email}`);
      }
    });
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
