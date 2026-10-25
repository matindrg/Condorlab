const { prisma } = require('../packages/database/dist/index.js');

async function main() {
  console.log('🌱 در حال تزریق داده‌های اولیه (Seed Data) به پایگاه داده Supabase...');

  // ۱. افزودن آزمون‌های کاتالوگ المپیاد زیست‌شناسی
  const exams = [
    {
      slug: 'campbell-vol1-vol2-pilot-1',
      title: 'شبیه‌ساز جامع جلد ۱ و ۲ بیولوژی کمپبل (پایلوت ۱)',
      category: 'campbell',
      labels: ['سرفصلی بیولوژی کمپبل', 'جلد ۱ و ۲: شیمی حیات و سلول'],
      campbellVolumes: [1, 2],
      status: 'Published',
      startTime: new Date(Date.now() + 5 * 24 * 3600 * 1000),
      endTime: new Date(Date.now() + 6 * 24 * 3600 * 1000),
      durationMinutes: 120,
      price: 0,
      capacity: 500,
      isCapacityVisible: true,
      officialEnrolledCount: 382,
    },
    {
      slug: 'biology-olympiad-stage-1-pilot-2',
      title: 'آزمون شبیه‌ساز مرحله اول المپیاد زیست‌شناسی (پایلوت ۲)',
      category: 'stage1',
      labels: ['شبیه‌ساز مرحله اول المپیاد', 'استاندارد کشوری', 'جامع ۵ جلد کمپبل'],
      campbellVolumes: [1, 2, 3, 4, 5],
      status: 'Published',
      startTime: new Date(Date.now() + 14 * 24 * 3600 * 1000),
      endTime: new Date(Date.now() + 15 * 24 * 3600 * 1000),
      durationMinutes: 150,
      price: 180000,
      capacity: 200,
      isCapacityVisible: false,
      officialEnrolledCount: 84,
    },
    {
      slug: 'advanced-molecular-genetics',
      title: 'شبیه‌ساز تخصصی ژنتیک مولکولی و مهندسی ژنتیک (مرحله ۲)',
      category: 'stage2',
      labels: ['مرحله دوم و تخصصی', 'ژنتیک مولکولی', 'مسئله‌محور'],
      campbellVolumes: [2],
      status: 'Published',
      startTime: new Date(Date.now() + 25 * 24 * 3600 * 1000),
      endTime: new Date(Date.now() + 26 * 24 * 3600 * 1000),
      durationMinutes: 90,
      price: 220000,
      capacity: 150,
      isCapacityVisible: false,
      officialEnrolledCount: 42,
    },
    {
      slug: 'campbell-vip-masterclass',
      title: 'کارگاه فشرده المپیاد زیست‌شناسی (تک‌ظرفیتی VIP)',
      category: 'campbell',
      labels: ['کارگاه فشرده', 'تک‌ظرفیتی VIP'],
      campbellVolumes: [1],
      status: 'Closed',
      startTime: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      endTime: new Date(Date.now() + 8 * 24 * 3600 * 1000),
      durationMinutes: 90,
      price: 50000,
      capacity: 2,
      isCapacityVisible: true,
      officialEnrolledCount: 2,
    },
  ];

  for (const exam of exams) {
    const created = await prisma.exam.upsert({
      where: { slug: exam.slug },
      update: {
        title: exam.title,
        category: exam.category,
        labels: exam.labels,
        campbellVolumes: exam.campbellVolumes,
        price: exam.price,
        capacity: exam.capacity,
      },
      create: exam,
    });
    console.log(`✅ آزمون ایجاد شد: ${created.title} (${created.id})`);
  }

  // ۲. افزودن کدهای تخفیف استاندارد
  const coupons = [
    {
      code: 'CAMPBELL50',
      discountPercent: 50,
      maxUses: 50,
      isHunterCoupon: true,
    },
    {
      code: 'CONDOR20',
      discountPercent: 20,
      maxUses: 200,
      isHunterCoupon: false,
    },
    {
      code: 'OLYMPIAD100',
      discountPercent: 100,
      maxUses: 20,
      isHunterCoupon: false,
    },
  ];

  for (const coupon of coupons) {
    const createdCoupon = await prisma.coupon.upsert({
      where: { code: coupon.code },
      update: {
        discountPercent: coupon.discountPercent,
        maxUses: coupon.maxUses,
      },
      create: coupon,
    });
    console.log(`🎟️ کد تخفیف ثبت شد: ${createdCoupon.code}`);
  }

  console.log('✨ تمام داده‌های اولیه با موفقیت در Supabase ذخیره شدند.');
}

main()
  .catch((e) => {
    console.error('❌ خطا در عملیات Seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
