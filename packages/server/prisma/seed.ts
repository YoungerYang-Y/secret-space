import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  const tips = [
    '你知道吗？果果3岁时学会了骑车！',
    '果果最喜欢的颜色是粉色。',
    '果果每天都会和猫咪说晚安。',
  ]
  for (const text of tips) {
    await prisma.tip.upsert({ where: { id: tips.indexOf(text) + 1 }, update: {}, create: { text } })
  }

  const ownerPwd = process.env.OWNER_PASSWORD || 'guoguo123'
  const visitorPwd = process.env.VISITOR_PASSWORD || 'visitor666'
  const ownerHash = await bcrypt.hash(ownerPwd, 10)
  const visitorHash = await bcrypt.hash(visitorPwd, 10)
  await prisma.config.upsert({ where: { key: 'owner_password_hash' }, update: { value: ownerHash }, create: { key: 'owner_password_hash', value: ownerHash } })
  await prisma.config.upsert({ where: { key: 'visitor_password_hash' }, update: { value: visitorHash }, create: { key: 'visitor_password_hash', value: visitorHash } })
}

main().finally(() => prisma.$disconnect())
