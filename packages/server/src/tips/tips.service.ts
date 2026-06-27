import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class TipsService {
  constructor(private prisma: PrismaService) {}

  async findRandom() {
    const count = await this.prisma.tip.count()
    if (count === 0) return { text: '欢迎来到果果的秘密空间！' }
    const skip = Math.floor(Math.random() * count)
    const tip = await this.prisma.tip.findFirst({ skip })
    return { text: tip?.text ?? '欢迎来到果果的秘密空间！' }
  }
}
