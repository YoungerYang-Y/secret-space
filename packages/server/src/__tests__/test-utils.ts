import { Test } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { AppModule } from '../app.module'

export async function createTestApp(options?: { validation?: boolean }) {
  const module = await Test.createTestingModule({ imports: [AppModule] }).compile()
  const app = module.createNestApplication()
  app.setGlobalPrefix('api', { exclude: ['health'] })
  if (options?.validation !== false) {
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  }
  await app.init()
  return { app, module }
}
