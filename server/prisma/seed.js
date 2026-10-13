/* eslint-disable */
// 习惯库种子：幂等 upsert 12 个中文习惯模板。
// 纯 JS，容器内直接 `node prisma/seed.js` 执行（无需 ts-node）。
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const templates = [
  { id: 'read-30min', title: '阅读30分钟', icon: 'book', color: 0x4f46e5, category: '学习', defaultGoalType: 0, defaultTargetValue: 30, defaultUnit: '分钟', frequency: 0, sortOrder: 1 },
  { id: 'drink-water-8', title: '喝水8杯', icon: 'water', color: 0x0ea5e9, category: '健康', defaultGoalType: 0, defaultTargetValue: 8, defaultUnit: '杯', frequency: 0, sortOrder: 2 },
  { id: 'exercise-30min', title: '锻炼30分钟', icon: 'dumbbell', color: 0xef4444, category: '运动', defaultGoalType: 0, defaultTargetValue: 30, defaultUnit: '分钟', frequency: 0, sortOrder: 3 },
  { id: 'early-rise', title: '早起', icon: 'sunrise', color: 0xf59e0b, category: '作息', defaultGoalType: 1, defaultTargetValue: 1, defaultUnit: null, frequency: 0, sortOrder: 4 },
  { id: 'meditation', title: '冥想', icon: 'spa', color: 0x8b5cf6, category: '健康', defaultGoalType: 0, defaultTargetValue: 10, defaultUnit: '分钟', frequency: 0, sortOrder: 5 },
  { id: 'running', title: '跑步', icon: 'run', color: 0x10b981, category: '运动', defaultGoalType: 0, defaultTargetValue: 3, defaultUnit: '公里', frequency: 0, sortOrder: 6 },
  { id: 'memorize-words', title: '背单词', icon: 'abc', color: 0x6366f1, category: '学习', defaultGoalType: 0, defaultTargetValue: 20, defaultUnit: '个', frequency: 0, sortOrder: 7 },
  { id: 'early-sleep', title: '早睡', icon: 'moon', color: 0x3b82f6, category: '作息', defaultGoalType: 1, defaultTargetValue: 1, defaultUnit: null, frequency: 0, sortOrder: 8 },
  { id: 'journal', title: '写日记', icon: 'pencil', color: 0xec4899, category: '生活', defaultGoalType: 1, defaultTargetValue: 1, defaultUnit: null, frequency: 0, sortOrder: 9 },
  { id: 'eat-fruit', title: '吃水果', icon: 'apple', color: 0xf97316, category: '健康', defaultGoalType: 0, defaultTargetValue: 2, defaultUnit: '份', frequency: 0, sortOrder: 10 },
  { id: 'walk-10k', title: '走1万步', icon: 'walk', color: 0x14b8a6, category: '运动', defaultGoalType: 0, defaultTargetValue: 10000, defaultUnit: '步', frequency: 0, sortOrder: 11 },
  { id: 'no-milk-tea', title: '不喝奶茶', icon: 'ban', color: 0x9333ea, category: '健康', defaultGoalType: 1, defaultTargetValue: 1, defaultUnit: null, frequency: 0, sortOrder: 12 },
];

async function main() {
  for (const t of templates) {
    await prisma.habitTemplate.upsert({ where: { id: t.id }, create: t, update: t });
  }
  console.log(`[tickflow] seeded ${templates.length} habit templates`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('[tickflow] seed failed', e);
    await prisma.$disconnect();
    process.exit(1);
  });