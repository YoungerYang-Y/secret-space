import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.tip.create({ data: { text: '你知道吗？果果3岁时学会了骑车！' } })
  await prisma.tip.create({ data: { text: '果果最喜欢的颜色是粉色。' } })
  await prisma.tip.create({ data: { text: '果果每天都会和猫咪说晚安。' } })
}

main().finally(() => prisma.$disconnect())
