import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as path from 'path';
import {
  ALL_ENTITIES,
  BankAccount,
  Book,
  Setting,
  User,
} from './index';

dotenv.config();

async function main() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'qasdiya_platform',
    entities: ALL_ENTITIES,
    synchronize: true,
    logging: false,
  });
  await ds.initialize();
  console.log('▶ connected');

  /* ─── Bootstrap admin ─────────────────────────────── */
  const users = ds.getRepository(User);
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@qasdiya.local').toLowerCase();
  let admin = await users.findOne({ where: { email: adminEmail } });
  if (!admin) {
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    admin = users.create({
      fullName: process.env.ADMIN_FULL_NAME || 'المدير العام',
      email: adminEmail,
      passwordHash: await bcrypt.hash(
        process.env.ADMIN_PASSWORD || 'change-me-now',
        rounds,
      ),
      role: 'admin',
      preferredLang: 'ar',
      emailVerified: true,
      isActive: true,
      privacyAccepted: true,
      termsAccepted: true,
      acceptedAt: new Date(),
    });
    await users.save(admin);
    console.log(`✔ admin created: ${adminEmail}`);
  } else {
    console.log(`• admin already present: ${adminEmail}`);
  }

  /* ─── Launch bank accounts (Rafidain + TBI) ───────── */
  const banks = ds.getRepository(BankAccount);
  const seedBanks = [
    {
      bankName: 'مصرف الرافدين',
      accountHolder: 'د. إياد محمد عبود',
      accountNumber: '0000000000',
      currency: 'IQD',
      displayOrder: 1,
      notes: 'يرجى ذكر رقم الطلب في حقل الملاحظات عند الحوالة.',
    },
    {
      bankName: 'Trade Bank of Iraq (TBI)',
      accountHolder: 'Dr. Iyad Muhammad Abood',
      accountNumber: '0000000000',
      currency: 'USD',
      displayOrder: 2,
      notes: 'Please include the order number in the transfer memo.',
    },
  ];
  for (const b of seedBanks) {
    const exists = await banks.findOne({
      where: { bankName: b.bankName, accountNumber: b.accountNumber },
    });
    if (!exists) {
      await banks.save(banks.create(b));
      console.log(`✔ seeded bank account: ${b.bankName}`);
    }
  }

  /* ─── Launch books (§3) ───────────────────────────── */
  const books = ds.getRepository(Book);
  const launchBooks = [
    {
      slug: 'min-teen-wa-nafkha',
      title: { ar: 'من طين ونفخة', en: 'Of Clay and a Breath' },
      author: {
        ar: 'د. إياد محمد عبود',
        en: 'Dr. Iyad Muhammad Abood',
      },
      description: {
        ar: 'قراءة قصدية في نشأة الإنسان وتكوينه.',
        en: 'A purposive reading of the origin and constitution of the human being.',
      },
      priceUsd: '15.00',
      priceIqd: '20000',
      masterPdfPath: 'min-teen-wa-nafkha/master.pdf',
    },
    {
      slug: 'hiwar-al-quran-maa-al-gharb',
      title: {
        ar: 'حوار القرآن مع الغرب',
        en: 'The Qur’an in Dialogue with the West',
      },
      author: { ar: 'د. إياد محمد عبود', en: 'Dr. Iyad Muhammad Abood' },
      description: {
        ar: 'مساءلة قرآنية قصدية لأسس الفكر الغربي الحديث.',
        en: 'A purposive Qur’anic interrogation of modern Western thought.',
      },
      priceUsd: '18.00',
      priceIqd: '24000',
      masterPdfPath: 'hiwar-al-quran-maa-al-gharb/master.pdf',
    },
    {
      slug: 'al-siraa-al-wujudi-lil-insan',
      title: {
        ar: 'الصراع الوجودي للإنسان مع إبليس والشياطين',
        en: 'The Existential Struggle of Humanity with Iblīs and the Devils',
      },
      author: { ar: 'د. إياد محمد عبود', en: 'Dr. Iyad Muhammad Abood' },
      description: {
        ar: 'دراسة قصدية للصراع الوجودي كما يعرّفه القرآن.',
        en: 'A purposive study of the existential struggle as defined by the Qur’an.',
      },
      priceUsd: '17.00',
      priceIqd: '22000',
      masterPdfPath: 'al-siraa-al-wujudi-lil-insan/master.pdf',
    },
  ];
  for (const b of launchBooks) {
    const exists = await books.findOne({ where: { slug: b.slug } });
    if (!exists) {
      await books.save(
        books.create({
          slug: b.slug,
          title: b.title,
          author: b.author,
          description: b.description,
          masterPdfPath: b.masterPdfPath,
          priceUsd: b.priceUsd,
          priceIqd: b.priceIqd,
          status: 'published',
          publishedAt: new Date(),
        }),
      );
      console.log(`✔ seeded book: ${b.slug}`);
    }
  }

  /* ─── Settings: agreement text, contact info ──────── */
  const settings = ds.getRepository(Setting);
  const defaults: Record<string, unknown> = {
    'purchase.agreement': {
      ar:
        'أوافق على أن النسخة التي سأتسلّمها نسخة شخصية لا يجوز نشرها أو ' +
        'إعادة توزيعها بأي وسيلة، وأن كل نسخة تحمل بصمة رقمية فريدة تعرّفني.',
      en:
        'I agree that the copy I will receive is personal, may not be ' +
        'republished or redistributed by any means, and that every copy ' +
        'carries a unique fingerprint identifying me.',
    },
    'contact.info': {
      email: 'contact@qasdiya.local',
      whatsapp: null,
    },
    'platform.owner': {
      ar: 'د. إياد محمد عبود',
      en: 'Dr. Iyad Muhammad Abood',
    },
  };
  for (const [key, value] of Object.entries(defaults)) {
    const exists = await settings.findOne({ where: { key } });
    if (!exists) {
      await settings.save(settings.create({ key, value }));
      console.log(`✔ seeded setting: ${key}`);
    }
  }

  await ds.destroy();
  console.log('▶ done');
  console.log('');
  console.log('Storage layout expected:');
  console.log('  ' + path.join(process.env.STORAGE_ROOT || 'storage', 'books', '<slug>', 'master.pdf'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
