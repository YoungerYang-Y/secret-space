import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  await prisma.tip.create({ data: { text: '你知道吗？果果3岁时学会了骑车！' } })
  await prisma.tip.create({ data: { text: '果果最喜欢的颜色是粉色。' } })
  await prisma.tip.create({ data: { text: '果果每天都会和猫咪说晚安。' } })

  const ownerHash = await bcrypt.hash('guoguo123', 10)
  const visitorHash = await bcrypt.hash('visitor666', 10)
  await prisma.config.upsert({ where: { key: 'owner_password_hash' }, update: { value: ownerHash }, create: { key: 'owner_password_hash', value: ownerHash } })
  await prisma.config.upsert({ where: { key: 'visitor_password_hash' }, update: { value: visitorHash }, create: { key: 'visitor_password_hash', value: visitorHash } })
}

main().finally(() => prisma.$disconnect())
