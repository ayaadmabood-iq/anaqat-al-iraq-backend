import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as path from 'path';
import * as dotenv from 'dotenv';
import {
  Store,
  User,
  UserRole,
  ClothingCategory,
  ClothingItem,
  AudienceTag,
  SizeStock,
  Sale,
  SaleLine,
  CustomerSession,
  OutfitRecommendation,
  OutfitRecommendationItem,
  AiProcessingJob,
  AuditLog,
} from './index';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'anaqat_iraq',
    entities: [
      Store,
      User,
      ClothingCategory,
      ClothingItem,
      SizeStock,
      Sale,
      SaleLine,
      CustomerSession,
      OutfitRecommendation,
      OutfitRecommendationItem,
      AiProcessingJob,
      AuditLog,
    ],
    synchronize: true,
    dropSchema: false,
  });

  await dataSource.initialize();
  console.log('Database connection established');

  try {
    // Clear existing data
    await dataSource.dropDatabase();
    await dataSource.synchronize();
    console.log('Database schema synchronized');

    // Create demo store
    const storeRepository = dataSource.getRepository(Store);
    const store = storeRepository.create({
      name: 'متجر الأناقة',
      address: 'بغداد، العراق',
      phone: '+964123456789',
      isActive: true,
    });
    await storeRepository.save(store);
    console.log(`Created store: ${store.name} (${store.id})`);

    // Create demo users
    const userRepository = dataSource.getRepository(User);
    const passwordHash = await bcrypt.hash('demo123', 10);

    const ownerUser = userRepository.create({
      username: 'owner',
      passwordHash,
      fullName: 'مالك المتجر',
      role: UserRole.OWNER,
      storeId: store.id,
      isActive: true,
    });
    await userRepository.save(ownerUser);
    console.log(`Created user: owner (OWNER)`);

    const managerUser = userRepository.create({
      username: 'manager',
      passwordHash,
      fullName: 'مدير المتجر',
      role: UserRole.MANAGER,
      storeId: store.id,
      isActive: true,
    });
    await userRepository.save(managerUser);
    console.log(`Created user: manager (MANAGER)`);

    const salesUser = userRepository.create({
      username: 'sales',
      passwordHash,
      fullName: 'موظف المبيعات',
      role: UserRole.SALES_STAFF,
      storeId: store.id,
      isActive: true,
    });
    await userRepository.save(salesUser);
    console.log(`Created user: sales (SALES_STAFF)`);

    const inventoryUser = userRepository.create({
      username: 'inventory',
      passwordHash,
      fullName: 'موظف المخزون',
      role: UserRole.INVENTORY_STAFF,
      storeId: store.id,
      isActive: true,
    });
    await userRepository.save(inventoryUser);
    console.log(`Created user: inventory (INVENTORY_STAFF)`);

    // Create clothing categories
    const categoryRepository = dataSource.getRepository(ClothingCategory);

    const categories = [
      { nameAr: 'قميص', nameEn: 'Shirt' },
      { nameAr: 'بنطلون', nameEn: 'Trousers' },
      { nameAr: 'جاكيت', nameEn: 'Jacket' },
      { nameAr: 'فستان', nameEn: 'Dress' },
      { nameAr: 'عباية', nameEn: 'Abaya' },
      { nameAr: 'تيشيرت', nameEn: 'T-Shirt' },
      { nameAr: 'جينز', nameEn: 'Jeans' },
      { nameAr: 'تنورة', nameEn: 'Skirt' },
      { nameAr: 'هودي', nameEn: 'Hoodie' },
      { nameAr: 'سويتر', nameEn: 'Sweater' },
      { nameAr: 'معطف', nameEn: 'Coat' },
      { nameAr: 'بدلة', nameEn: 'Suit' },
      { nameAr: 'بولو', nameEn: 'Polo' },
    ];

    const createdCategories: ClothingCategory[] = [];

    for (const catData of categories) {
      const category = categoryRepository.create({
        ...catData,
        isActive: true,
      });
      await categoryRepository.save(category);
      createdCategories.push(category);
      console.log(`Created category: ${catData.nameAr} (${catData.nameEn})`);
    }

    // Create sample clothing items
    const itemRepository = dataSource.getRepository(ClothingItem);
    const sizeStockRepository = dataSource.getRepository(SizeStock);

    const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '36', '38', '40', '42', '44'];

    const sampleItems = [
      {
        categoryId: createdCategories[0].id, // Shirt
        primaryColor: 'أبيض',
        secondaryColor: 'أزرق',
        colorFamily: 'أزرق فاتح',
        styleTag: 'رسمي',
        audienceTag: AudienceTag.MEN,
        price: 50000,
      },
      {
        categoryId: createdCategories[1].id, // Trousers
        primaryColor: 'أسود',
        secondaryColor: '',
        colorFamily: 'محايد',
        styleTag: 'رسمي',
        audienceTag: AudienceTag.MEN,
        price: 75000,
      },
      {
        categoryId: createdCategories[4].id, // Abaya
        primaryColor: 'أسود',
        secondaryColor: 'ذهبي',
        colorFamily: 'محايد',
        styleTag: 'تقليدي',
        audienceTag: AudienceTag.WOMEN,
        price: 120000,
      },
      {
        categoryId: createdCategories[5].id, // T-Shirt
        primaryColor: 'أحمر',
        secondaryColor: '',
        colorFamily: 'أحمر',
        styleTag: 'كاجوال',
        audienceTag: AudienceTag.UNISEX,
        price: 25000,
      },
      {
        categoryId: createdCategories[6].id, // Jeans
        primaryColor: 'أزرق',
        secondaryColor: '',
        colorFamily: 'أزرق داكن',
        styleTag: 'كاجوال',
        audienceTag: AudienceTag.UNISEX,
        price: 60000,
      },
    ];

    for (const itemData of sampleItems) {
      const item = itemRepository.create({
        ...itemData,
        storeId: store.id,
        isActive: true,
      });
      await itemRepository.save(item);
      console.log(`Created item: ${item.primaryColor} - ${item.styleTag}`);

      // Add sizes with stock
      for (const size of sizes.slice(0, 5)) {
        const sizeStock = sizeStockRepository.create({
          clothingItemId: item.id,
          size,
          quantity: Math.floor(Math.random() * 20) + 5,
        });
        await sizeStockRepository.save(sizeStock);
      }
    }

    console.log('\nSeed data created successfully!');
    console.log('\nDemo credentials:');
    console.log('  Owner - username: owner, password: demo123');
    console.log('  Manager - username: manager, password: demo123');
    console.log('  Sales - username: sales, password: demo123');
    console.log('  Inventory - username: inventory, password: demo123');
    console.log(`\nStore ID: ${store.id}`);
  } catch (error) {
    console.error('Seed failed:', error);
    throw error;
  } finally {
    await dataSource.destroy();
  }
}

seed().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
