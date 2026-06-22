import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

const provinces = [
  { code: 'anhui', name: '安徽' },
  { code: 'beijing', name: '北京' },
  { code: 'chongqing', name: '重庆' },
  { code: 'fujian', name: '福建' },
  { code: 'gansu', name: '甘肃' },
  { code: 'guangdong', name: '广东' },
  { code: 'guangxi', name: '广西' },
  { code: 'guizhou', name: '贵州' },
  { code: 'hainan', name: '海南' },
  { code: 'hebei', name: '河北' },
  { code: 'heilongjiang', name: '黑龙江' },
  { code: 'henan', name: '河南' },
  { code: 'hubei', name: '湖北' },
  { code: 'hunan', name: '湖南' },
  { code: 'jiangsu', name: '江苏' },
  { code: 'jiangxi', name: '江西' },
  { code: 'jilin', name: '吉林' },
  { code: 'liaoning', name: '辽宁' },
  { code: 'neimenggu', name: '内蒙古' },
  { code: 'ningxia', name: '宁夏' },
  { code: 'qinghai', name: '青海' },
  { code: 'shaanxi', name: '陕西' },
  { code: 'shandong', name: '山东' },
  { code: 'shanghai', name: '上海' },
  { code: 'shanxi', name: '山西' },
  { code: 'sichuan', name: '四川' },
  { code: 'taiwan', name: '台湾' },
  { code: 'tianjin', name: '天津' },
  { code: 'xinjiang', name: '新疆' },
  { code: 'xizang', name: '西藏' },
  { code: 'yunnan', name: '云南' },
  { code: 'zhejiang', name: '浙江' },
  { code: 'hongkong', name: '香港' },
  { code: 'macau', name: '澳门' },
]

const visitedCodes = ['hunan', 'guangxi', 'hebei', 'guangdong']

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
  const adminPwd = process.env.ADMIN_PASSWORD || 'admin888'
  const ownerHash = await bcrypt.hash(ownerPwd, 10)
  const visitorHash = await bcrypt.hash(visitorPwd, 10)
  const adminHash = await bcrypt.hash(adminPwd, 10)
  await prisma.config.upsert({ where: { key: 'owner_password_hash' }, update: { value: ownerHash }, create: { key: 'owner_password_hash', value: ownerHash } })
  await prisma.config.upsert({ where: { key: 'visitor_password_hash' }, update: { value: visitorHash }, create: { key: 'visitor_password_hash', value: visitorHash } })
  await prisma.config.upsert({ where: { key: 'admin_password_hash' }, update: { value: adminHash }, create: { key: 'admin_password_hash', value: adminHash } })

  for (const p of provinces) {
    await prisma.province.upsert({
      where: { code: p.code },
      update: {},
      create: { code: p.code, name: p.name, visited: visitedCodes.includes(p.code) },
    })
  }
}

main().finally(() => prisma.$disconnect())
