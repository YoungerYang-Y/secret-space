import { Prisma } from '@prisma/client'

/**
 * 判断错误是否为交互式事务超时/已关闭。
 *
 * Prisma 没有专用的超时错误码：查询引擎超时通常以
 * PrismaClientUnknownRequestError 抛出（消息含
 * "Timed out during query execution"），部分版本/场景会先抛出
 * P2028（事务已关闭）或 P2034（写冲突/死锁）。
 * 集中在此判断，避免调用方散落字符串匹配。
 */
export function isTransactionTimeout(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P2028' || error.code === 'P2034'
  }
  return (
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    error instanceof Error
  ) && error.message.includes('Timed out during query execution')
}
