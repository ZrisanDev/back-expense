import dataSource from '../data-source.js';
import { Category } from '../categories/entities/category.entity.js';

const DEFAULT_CATEGORIES = [
  { name: 'Food & Dining', icon: '🍔' },
  { name: 'Transportation', icon: '🚗' },
  { name: 'Housing', icon: '🏠' },
  { name: 'Entertainment', icon: '🎬' },
  { name: 'Shopping', icon: '🛍️' },
  { name: 'Health', icon: '💊' },
  { name: 'Education', icon: '📚' },
  { name: 'Travel', icon: '✈️' },
  { name: 'Utilities', icon: '💡' },
  { name: 'Subscriptions', icon: '📱' },
  { name: 'Clothing', icon: '👕' },
  { name: 'Personal Care', icon: '💇' },
  { name: 'Gifts', icon: '🎁' },
  { name: 'Savings', icon: '💰' },
  { name: 'Other', icon: '📋' },
] as const;

async function seed() {
  console.log('🌱 Seeding default categories...');

  await dataSource.initialize();
  const categoryRepo = dataSource.getRepository(Category);

  let existingCount = 0;
  let createdCount = 0;

  for (const { name, icon } of DEFAULT_CATEGORIES) {
    const existing = await categoryRepo.findOne({
      where: { name, isDefault: true },
    });

    if (existing) {
      existingCount++;
    } else {
      await categoryRepo.save(
        categoryRepo.create({
          name,
          icon,
          isDefault: true,
          userId: null,
        }),
      );
      createdCount++;
      console.log(`  ✅ Created: ${name}`);
    }
  }

  const total = await categoryRepo.count({
    where: { isDefault: true },
  });

  console.log('\n📊 Seed summary:');
  console.log(`  Already existed: ${existingCount}`);
  console.log(`  Newly created:   ${createdCount}`);
  console.log(`  Total default categories: ${total}`);
  console.log('\n✨ Done!');
}

seed()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });
